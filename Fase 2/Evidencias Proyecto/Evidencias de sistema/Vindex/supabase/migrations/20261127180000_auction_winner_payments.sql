ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auction_product_id bigint REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS auction_final_price numeric,
  ADD COLUMN IF NOT EXISTS auction_guarantee_amount numeric,
  ADD COLUMN IF NOT EXISTS auction_amount_due numeric,
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz;

DO $block$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_auction_payment_amounts_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_auction_payment_amounts_check
      CHECK (
        (
          auction_product_id IS NULL
          AND auction_final_price IS NULL
          AND auction_guarantee_amount IS NULL
          AND auction_amount_due IS NULL
          AND payment_due_at IS NULL
        )
        OR (
          auction_product_id IS NOT NULL
          AND auction_final_price IS NOT NULL
          AND auction_guarantee_amount IS NOT NULL
          AND auction_amount_due IS NOT NULL
          AND payment_due_at IS NOT NULL
          AND auction_final_price > 0
          AND auction_guarantee_amount > 0
          AND auction_amount_due > 0
          AND auction_final_price = trunc(auction_final_price)
          AND auction_guarantee_amount = trunc(auction_guarantee_amount)
          AND auction_amount_due = trunc(auction_amount_due)
          AND auction_final_price = auction_guarantee_amount + auction_amount_due
        )
      );
  END IF;
END;
$block$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_auction_product_id_key
  ON public.orders (auction_product_id)
  WHERE auction_product_id IS NOT NULL;

DO $block$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.payment_transactions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) = 'UNIQUE (order_id)'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.payment_transactions DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END;
$block$;

CREATE INDEX IF NOT EXISTS payment_transactions_order_created_idx
  ON public.payment_transactions (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.auction_guarantee_forfeitures (
  order_id bigint PRIMARY KEY REFERENCES public.orders(id),
  auction_id bigint NOT NULL REFERENCES public.products(id),
  winner_id uuid NOT NULL REFERENCES auth.users(id),
  seller_id uuid NOT NULL REFERENCES auth.users(id),
  guarantee_amount numeric NOT NULL CHECK (guarantee_amount > 0),
  seller_credit numeric NOT NULL CHECK (seller_credit >= 0),
  platform_amount numeric NOT NULL CHECK (platform_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seller_credit + platform_amount = guarantee_amount)
);

ALTER TABLE public.auction_guarantee_forfeitures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auction_guarantee_forfeitures FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auction_guarantee_forfeitures TO service_role;

CREATE OR REPLACE FUNCTION public.settle_auction_guarantees(p_auction_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_guarantee record;
  v_user_guarantee record;
  v_winner_guarantee record;
  v_released_count integer := 0;
  v_applied_count integer := 0;
  v_amount_due numeric;
  v_final_price numeric;
  v_payment_due_at timestamptz;
  v_order_id bigint;
BEGIN
  IF v_caller_id IS NULL
    AND auth.role() IS DISTINCT FROM 'service_role'
    AND session_user <> 'postgres'
  THEN
    RETURN jsonb_build_object('success', false, 'message', 'Debes iniciar sesión para liquidar garantías.');
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND OR v_product.sale_type IS DISTINCT FROM 'auction' THEN
    RETURN jsonb_build_object('success', false, 'message', 'No se encontró la subasta.');
  END IF;
  IF v_product.auction_ends_at IS NULL OR v_product.auction_ends_at > now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'La subasta todavía no ha finalizado.');
  END IF;

  FOR v_guarantee IN
    SELECT id, user_id, amount
    FROM public.auction_guarantees
    WHERE auction_id = p_auction_id
      AND status = 'locked'
    ORDER BY user_id, id
    FOR UPDATE
  LOOP
    IF v_guarantee.user_id IS NOT DISTINCT FROM v_product.winner_id THEN
      UPDATE public.user_wallets
      SET locked_balance = locked_balance - v_guarantee.amount,
          updated_at = now()
      WHERE user_id = v_guarantee.user_id;
      v_applied_count := v_applied_count + 1;
    ELSE
      UPDATE public.user_wallets
      SET balance = balance + v_guarantee.amount,
          locked_balance = locked_balance - v_guarantee.amount,
          updated_at = now()
      WHERE user_id = v_guarantee.user_id;
      v_released_count := v_released_count + 1;
    END IF;

    UPDATE public.auction_guarantees
    SET status = 'available',
        applied_to_price = (v_guarantee.user_id IS NOT DISTINCT FROM v_product.winner_id),
        updated_at = now()
    WHERE id = v_guarantee.id;
  END LOOP;

  SELECT id, amount, status, applied_to_price
  INTO v_user_guarantee
  FROM public.auction_guarantees
  WHERE auction_id = p_auction_id
    AND user_id = v_caller_id
  ORDER BY applied_to_price DESC, created_at DESC
  LIMIT 1;

  IF v_caller_id = v_product.winner_id
    AND FOUND
    AND v_user_guarantee.applied_to_price
  THEN
    v_amount_due := GREATEST(
      COALESCE(v_product.current_bid, v_product.starting_price) - v_user_guarantee.amount,
      0
    );
  END IF;

  IF v_product.winner_id IS NOT NULL THEN
    SELECT id, amount
    INTO v_winner_guarantee
    FROM public.auction_guarantees
    WHERE auction_id = p_auction_id
      AND user_id = v_product.winner_id
      AND status = 'available'
      AND applied_to_price = true
    ORDER BY created_at DESC
    LIMIT 1;

    v_final_price := COALESCE(v_product.current_bid, v_product.starting_price);
    IF FOUND
      AND v_final_price > v_winner_guarantee.amount
      AND v_final_price = trunc(v_final_price)
    THEN
      v_amount_due := v_final_price - v_winner_guarantee.amount;
      v_payment_due_at := v_product.auction_ends_at + interval '24 hours';

      SELECT id
      INTO v_order_id
      FROM public.orders
      WHERE auction_product_id = p_auction_id
      FOR UPDATE;

      IF v_order_id IS NULL THEN
        INSERT INTO public.orders (
          buyer_id,
          status,
          shipping_address,
          shipping_cost,
          subtotal,
          total,
          payment_method,
          delivery_status,
          shipping_method,
          auction_product_id,
          auction_final_price,
          auction_guarantee_amount,
          auction_amount_due,
          payment_due_at
        )
        VALUES (
          v_product.winner_id,
          'pending_payment',
          'Acordar con el vendedor',
          0,
          v_final_price,
          v_final_price,
          'webpay_plus_mall',
          'pending_pickup',
          'pickup',
          p_auction_id,
          v_final_price,
          v_winner_guarantee.amount,
          v_amount_due,
          v_payment_due_at
        )
        RETURNING id INTO v_order_id;

        INSERT INTO public.order_items (
          order_id,
          product_id,
          store_id,
          seller_id,
          unit_price,
          quantity
        )
        VALUES (
          v_order_id,
          v_product.id,
          v_product.store_id,
          v_product.seller_id,
          v_final_price,
          1
        );

        INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
        VALUES (
          v_product.winner_id,
          'purchase',
          'Ganaste la subasta',
          format(
            'Paga el saldo restante de %s CLP antes del %s para completar tu compra.',
            to_char(v_amount_due, 'FM999,999,999,990'),
            to_char(v_payment_due_at AT TIME ZONE 'America/Santiago', 'DD/MM/YYYY HH24:MI')
          ),
          format('/profile?tab=purchases&auctionOrderId=%s', v_order_id),
          format('auction:%s:winner-payment:%s', p_auction_id, v_product.winner_id)
        )
        ON CONFLICT (event_key) DO NOTHING;
      ELSE
        SELECT payment_due_at
        INTO v_payment_due_at
        FROM public.orders
        WHERE id = v_order_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released_count,
    'applied_count', v_applied_count,
    'user_guarantee_released',
      COALESCE(v_user_guarantee.status = 'available' AND NOT v_user_guarantee.applied_to_price, false),
    'user_guarantee_applied',
      COALESCE(v_user_guarantee.applied_to_price, false),
    'user_guarantee_amount',
      v_user_guarantee.amount,
    'amount_due', v_amount_due,
    'order_id', v_order_id,
    'payment_due_at', v_payment_due_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_expired_auction_guarantees()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_auction_id bigint;
  v_result jsonb;
  v_settled_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND session_user <> 'postgres'
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  FOR v_auction_id IN
    SELECT DISTINCT product.id
    FROM public.products product
    JOIN public.auction_guarantees guarantee ON guarantee.auction_id = product.id
    WHERE product.sale_type = 'auction'
      AND product.auction_ends_at <= now()
      AND guarantee.status = 'locked'
    ORDER BY product.id
  LOOP
    v_result := public.settle_auction_guarantees(v_auction_id);
    IF COALESCE((v_result ->> 'success')::boolean, false) THEN
      v_settled_count := v_settled_count + 1;
    END IF;
  END LOOP;

  RETURN v_settled_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_auction_payment_transaction(
  p_user_id uuid,
  p_order_id bigint,
  p_commerce_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item public.order_items%ROWTYPE;
  v_transaction_id uuid := gen_random_uuid();
  v_mall_buy_order text := 'M' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_child_buy_order text := 'C' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_commerce_key text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_user_id IS NULL
    OR p_order_id IS NULL
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF p_commerce_code IS NULL OR length(btrim(p_commerce_code)) = 0 THEN
    RAISE EXCEPTION 'INVALID_COMMERCE_CODE' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND buyer_id = p_user_id
    AND auction_product_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUCTION_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status NOT IN ('pending_payment', 'payment_failed')
    OR v_order.payment_due_at IS NULL
    OR v_order.payment_due_at <= now()
  THEN
    RAISE EXCEPTION 'AUCTION_PAYMENT_WINDOW_CLOSED' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.auction_amount_due IS NULL
    OR v_order.auction_amount_due <= 0
    OR v_order.auction_amount_due <> trunc(v_order.auction_amount_due)
  THEN
    RAISE EXCEPTION 'INVALID_AUCTION_PAYMENT_AMOUNT' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.payment_transactions
    WHERE order_id = p_order_id
      AND status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
  ) THEN
    RAISE EXCEPTION 'PENDING_PAYMENT_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_item
  FROM public.order_items
  WHERE order_id = p_order_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_item.product_id IS DISTINCT FROM v_order.auction_product_id THEN
    RAISE EXCEPTION 'AUCTION_ORDER_ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_commerce_key := CASE
    WHEN v_item.store_id IS NOT NULL THEN 'store:' || v_item.store_id::text
    ELSE 'seller:' || v_item.seller_id::text
  END;

  INSERT INTO public.payment_transactions (
    id,
    order_id,
    mall_buy_order,
    total_amount,
    status
  )
  VALUES (
    v_transaction_id,
    p_order_id,
    v_mall_buy_order,
    v_order.auction_amount_due::bigint,
    'created'
  );

  INSERT INTO public.payment_subtransactions (
    payment_transaction_id,
    commerce_key,
    commerce_code,
    child_buy_order,
    seller_id,
    store_id,
    amount
  )
  VALUES (
    v_transaction_id,
    v_commerce_key,
    btrim(p_commerce_code),
    v_child_buy_order,
    v_item.seller_id,
    v_item.store_id,
    v_order.auction_amount_due::bigint
  );

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'order_id', p_order_id,
    'mall_buy_order', v_mall_buy_order,
    'total_amount', v_order.auction_amount_due::bigint,
    'details', jsonb_build_array(jsonb_build_object(
      'amount', v_order.auction_amount_due::bigint,
      'commerceCode', btrim(p_commerce_code),
      'buyOrder', v_child_buy_order
    ))
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.fail_auction_payment_initiation(
  p_user_id uuid,
  p_transaction_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order_id bigint;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payment_transactions pt
  SET status = 'cancelled',
      committed_at = now(),
      updated_at = now()
  FROM public.orders o
  WHERE pt.id = p_transaction_id
    AND pt.order_id = o.id
    AND o.buyer_id = p_user_id
    AND o.auction_product_id IS NOT NULL
    AND pt.status = 'created'
  RETURNING pt.order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.payment_subtransactions
  SET status = 'cancelled',
      updated_at = now()
  WHERE payment_transaction_id = p_transaction_id
    AND status = 'pending';

  UPDATE public.orders
  SET status = 'payment_failed'
  WHERE id = v_order_id
    AND status = 'pending_payment';

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_unpaid_auction_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order record;
  v_guarantee record;
  v_seller_credit numeric;
  v_platform_amount numeric;
  v_forfeited_order_id bigint;
  v_expired_count integer := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    AND session_user <> 'postgres'
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  FOR v_order IN
    SELECT id, auction_product_id, buyer_id
    FROM public.orders
    WHERE auction_product_id IS NOT NULL
      AND payment_due_at <= now()
      AND status IN ('pending_payment', 'payment_failed')
      AND NOT EXISTS (
        SELECT 1
        FROM public.payment_transactions pt
        WHERE pt.order_id = orders.id
          AND pt.status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
      )
    ORDER BY payment_due_at, id
    FOR UPDATE SKIP LOCKED
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.orders
      WHERE id = v_order.id
        AND status NOT IN ('pending_payment', 'payment_failed')
    ) OR EXISTS (
      SELECT 1
      FROM public.payment_transactions
      WHERE order_id = v_order.id
        AND status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
    ) THEN
      CONTINUE;
    END IF;

    SELECT id, amount
    INTO v_guarantee
    FROM public.auction_guarantees
    WHERE auction_id = v_order.auction_product_id
      AND user_id = v_order.buyer_id
      AND status = 'available'
      AND applied_to_price = true
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE public.orders
      SET status = 'payment_review'
      WHERE id = v_order.id;
      CONTINUE;
    END IF;

    v_seller_credit := floor(v_guarantee.amount * 0.70);
    v_platform_amount := v_guarantee.amount - v_seller_credit;

    INSERT INTO public.auction_guarantee_forfeitures (
      order_id,
      auction_id,
      winner_id,
      seller_id,
      guarantee_amount,
      seller_credit,
      platform_amount
    )
    SELECT
      v_order.id,
      product.id,
      v_order.buyer_id,
      product.seller_id,
      v_guarantee.amount,
      v_seller_credit,
      v_platform_amount
    FROM public.products product
    WHERE product.id = v_order.auction_product_id
    ON CONFLICT (order_id) DO NOTHING
    RETURNING order_id INTO v_forfeited_order_id;

    IF v_forfeited_order_id IS NOT NULL THEN
      INSERT INTO public.user_wallets (user_id, balance, locked_balance)
      SELECT product.seller_id, 0, 0
      FROM public.products product
      WHERE product.id = v_order.auction_product_id
      ON CONFLICT (user_id) DO NOTHING;

      UPDATE public.user_wallets wallet
      SET balance = wallet.balance + v_seller_credit,
          updated_at = now()
      FROM public.products product
      WHERE product.id = v_order.auction_product_id
        AND wallet.user_id = product.seller_id;

      INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
      VALUES (
        v_order.buyer_id,
        'purchase',
        'Plazo de pago vencido',
        'La orden de la subasta venció. La garantía aplicada se retuvo según las condiciones de la subasta.',
        format('/profile?tab=purchases&auctionOrderId=%s', v_order.id),
        format('auction:%s:payment-expired:%s', v_order.auction_product_id, v_order.buyer_id)
      )
      ON CONFLICT (event_key) DO NOTHING;

      INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
      SELECT
        product.seller_id,
        'sale',
        'Garantía por subasta no pagada',
        format('Se acreditaron %s CLP a tu wallet por el incumplimiento de pago de la orden #%s.', to_char(v_seller_credit, 'FM999,999,999,990'), v_order.id),
        '/wallet',
        format('auction:%s:forfeiture:%s', v_order.auction_product_id, product.seller_id)
      FROM public.products product
      WHERE product.id = v_order.auction_product_id
      ON CONFLICT (event_key) DO NOTHING;

      v_expired_count := v_expired_count + 1;
    END IF;

    IF v_forfeited_order_id IS NOT NULL
      OR EXISTS (
        SELECT 1
        FROM public.auction_guarantee_forfeitures
        WHERE order_id = v_order.id
      )
    THEN
      UPDATE public.orders
      SET status = 'payment_expired'
      WHERE id = v_order.id;
    END IF;

    v_forfeited_order_id := NULL;
  END LOOP;

  RETURN v_expired_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_webpay_payment_status(p_user_id uuid, p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment_id uuid;
  v_payment_status text;
  v_order_status text;
  v_paid_items jsonb;
BEGIN
  SELECT pt.id, pt.status, o.status
  INTO v_payment_id, v_payment_status, v_order_status
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.order_id = p_order_id
    AND o.buyer_id = p_user_id
  ORDER BY pt.created_at DESC
  LIMIT 1;

  IF v_payment_status IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'quantity', oi.quantity
  )), '[]'::jsonb)
  INTO v_paid_items
  FROM public.order_items oi
  JOIN public.payment_subtransactions ps
    ON ps.payment_transaction_id = v_payment_id
    AND ps.status = 'authorized'
    AND (
      (ps.store_id IS NOT NULL AND oi.store_id = ps.store_id)
      OR (ps.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = ps.seller_id)
    )
  WHERE oi.order_id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'payment_status', v_payment_status,
    'order_status', v_order_status,
    'paid_items', v_paid_items
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_integration_webpay_checkout(p_user_id uuid, p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_user_id IS NULL
    OR p_order_id IS NULL
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED_OR_INVALID_RESULT' USING ERRCODE = '42501';
  END IF;

  SELECT pt.*
  INTO v_payment
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.order_id = p_order_id
    AND o.buyer_id = p_user_id
    AND pt.status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
  ORDER BY pt.created_at DESC
  LIMIT 1
  FOR UPDATE OF pt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.created_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_expired');
  END IF;

  UPDATE public.payment_subtransactions
  SET status = 'cancelled',
      updated_at = now()
  WHERE payment_transaction_id = v_payment.id;

  UPDATE public.payment_transactions
  SET status = 'cancelled',
      response = jsonb_build_object(
        'reason', 'integration_timeout',
        'expired_at', now()
      ),
      updated_at = now(),
      committed_at = now()
  WHERE id = v_payment.id;

  UPDATE public.orders
  SET status = 'payment_failed'
  WHERE id = v_payment.order_id
    AND status = 'pending_payment';

  RETURN jsonb_build_object(
    'success', true,
    'state', 'cancelled',
    'order_id', v_payment.order_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_failed_webpay_checkout(
  p_user_id uuid,
  p_order_id bigint,
  p_final_status text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
  v_detail record;
  v_provider_detail jsonb;
  v_response_code integer;
  v_provider_status text;
  v_detail_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
    OR p_user_id IS NULL
    OR p_order_id IS NULL
    OR p_final_status IS NULL
    OR p_final_status NOT IN ('rejected', 'cancelled')
    OR p_provider_response IS NULL
  THEN
    RAISE EXCEPTION 'UNAUTHORIZED_OR_INVALID_RESULT' USING ERRCODE = '42501';
  END IF;

  SELECT pt.*
  INTO v_payment
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.order_id = p_order_id
    AND o.buyer_id = p_user_id
    AND pt.status IN ('initiated', 'processing', 'payment_review', 'communication_error')
  ORDER BY pt.created_at DESC
  LIMIT 1
  FOR UPDATE OF pt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF p_provider_response->>'buy_order' IS DISTINCT FROM v_payment.mall_buy_order
    OR jsonb_typeof(p_provider_response->'details') IS DISTINCT FROM 'array'
  THEN
    RETURN jsonb_build_object('success', false, 'state', 'verification_error');
  END IF;

  SELECT count(*) INTO v_detail_count
  FROM public.payment_subtransactions
  WHERE payment_transaction_id = v_payment.id;

  IF v_detail_count = 0 OR jsonb_array_length(p_provider_response->'details') <> v_detail_count THEN
    RETURN jsonb_build_object('success', false, 'state', 'verification_error');
  END IF;

  FOR v_detail IN
    SELECT id, child_buy_order, commerce_code, amount
    FROM public.payment_subtransactions
    WHERE payment_transaction_id = v_payment.id
    FOR UPDATE
  LOOP
    SELECT element.value INTO v_provider_detail
    FROM jsonb_array_elements(p_provider_response->'details') AS element(value)
    WHERE element.value->>'buy_order' = v_detail.child_buy_order
    LIMIT 1;

    IF v_provider_detail IS NULL
      OR v_provider_detail->>'commerce_code' IS DISTINCT FROM v_detail.commerce_code
      OR (v_provider_detail->>'amount') !~ '^[0-9]+$'
      OR (v_provider_detail->>'amount')::bigint IS DISTINCT FROM v_detail.amount
    THEN
      RETURN jsonb_build_object('success', false, 'state', 'verification_error');
    END IF;

    v_provider_status := v_provider_detail->>'status';
    IF p_final_status = 'cancelled' AND v_provider_status = 'INITIALIZED' THEN
      NULL;
    ELSIF v_provider_status IN ('FAILED', 'REJECTED')
      AND (v_provider_detail->>'response_code') ~ '^-?[0-9]+$'
    THEN
      v_response_code := (v_provider_detail->>'response_code')::integer;
      IF v_response_code = 0 THEN
        RETURN jsonb_build_object('success', false, 'state', 'verification_error');
      END IF;
    ELSE
      RETURN jsonb_build_object('success', false, 'state', 'verification_error');
    END IF;

    UPDATE public.payment_subtransactions
    SET status = CASE WHEN p_final_status = 'cancelled' THEN 'cancelled' ELSE 'rejected' END,
        updated_at = now()
    WHERE id = v_detail.id;
  END LOOP;

  UPDATE public.payment_transactions
  SET status = p_final_status,
      response = p_provider_response,
      updated_at = now(),
      committed_at = now()
  WHERE id = v_payment.id;

  UPDATE public.orders
  SET status = 'payment_failed'
  WHERE id = v_payment.order_id
    AND status = 'pending_payment';

  RETURN jsonb_build_object('success', true, 'state', p_final_status, 'order_id', v_payment.order_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_auction_payment_transaction(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_auction_payment_transaction(uuid, bigint, text) TO service_role;
REVOKE ALL ON FUNCTION public.fail_auction_payment_initiation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_auction_payment_initiation(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.expire_unpaid_auction_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_auction_orders() TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_auction_guarantees(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.settle_expired_auction_guarantees() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_expired_auction_guarantees() TO service_role;
REVOKE ALL ON FUNCTION public.expire_integration_webpay_checkout(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_integration_webpay_checkout(uuid, bigint) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_failed_webpay_checkout(uuid, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_failed_webpay_checkout(uuid, bigint, text, jsonb) TO service_role;

DO $block$
DECLARE
  v_job_exists boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
    INTO v_job_exists
    USING 'vindex-expire-unpaid-auction-orders';

    IF NOT v_job_exists THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING
        'vindex-expire-unpaid-auction-orders',
        '* * * * *',
        'SELECT public.expire_unpaid_auction_orders();';
    END IF;
  ELSE
    RAISE NOTICE 'Enable pg_cron to forfeit unpaid auction guarantees automatically; the buyer purchases API also checks expired orders.';
  END IF;
END;
$block$;
