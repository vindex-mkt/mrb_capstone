CREATE OR REPLACE FUNCTION public.cancel_product_ad_payment(p_user_id uuid, p_token text, p_buy_order text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.product_ad_transactions%ROWTYPE;
BEGIN
  SELECT ad.*
  INTO v_payment
  FROM public.product_ad_transactions ad
  WHERE ad.seller_id = p_user_id
    AND (
      (p_token IS NOT NULL AND ad.transbank_token = p_token)
      OR (p_buy_order IS NOT NULL AND ad.buy_order = p_buy_order)
    )
  ORDER BY ad.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status <> 'initiated' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'transaction_id', v_payment.id,
      'product_id', v_payment.product_id,
      'payment_status', v_payment.status
    );
  END IF;

  UPDATE public.product_ad_transactions
  SET status = 'cancelled', updated_at = now()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'processed',
    'transaction_id', v_payment.id,
    'product_id', v_payment.product_id,
    'payment_status', 'cancelled'
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.cancel_webpay_checkout(p_user_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transaction public.payment_transactions%ROWTYPE;
BEGIN
  SELECT pt.*
  INTO v_transaction
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.transbank_token = p_token
    AND o.buyer_id = p_user_id
  FOR UPDATE OF pt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_transaction.status <> 'initiated' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'order_id', v_transaction.order_id,
      'payment_status', v_transaction.status
    );
  END IF;

  UPDATE public.payment_subtransactions
  SET status = 'cancelled', updated_at = now()
  WHERE payment_transaction_id = v_transaction.id;

  UPDATE public.payment_transactions
  SET status = 'cancelled', updated_at = now(), committed_at = now()
  WHERE id = v_transaction.id;

  UPDATE public.orders SET status = 'payment_failed' WHERE id = v_transaction.order_id;
  RETURN jsonb_build_object(
    'success', true,
    'state', 'processed',
    'order_id', v_transaction.order_id,
    'payment_status', 'cancelled'
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.claim_product_ad_commit(p_user_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.product_ad_transactions%ROWTYPE;
BEGIN
  SELECT ad.*
  INTO v_payment
  FROM public.product_ad_transactions ad
  WHERE ad.transbank_token = p_token
    AND ad.seller_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status = 'initiated' THEN
    UPDATE public.product_ad_transactions
    SET status = 'processing', updated_at = now()
    WHERE id = v_payment.id;

    RETURN jsonb_build_object(
      'success', true,
      'state', 'claimed',
      'transaction_id', v_payment.id,
      'product_id', v_payment.product_id,
      'buy_order', v_payment.buy_order,
      'amount', v_payment.amount
    );
  END IF;

  IF v_payment.status IN ('authorized', 'rejected', 'cancelled', 'payment_review') THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'transaction_id', v_payment.id,
      'product_id', v_payment.product_id,
      'payment_status', v_payment.status
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'already_processing',
    'transaction_id', v_payment.id,
    'product_id', v_payment.product_id,
    'payment_status', v_payment.status
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.claim_webpay_commit(p_user_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_transaction public.payment_transactions%ROWTYPE;
  v_details jsonb;
BEGIN
  SELECT pt.*
  INTO v_transaction
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.transbank_token = p_token
    AND o.buyer_id = p_user_id
  FOR UPDATE OF pt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_transaction.status = 'initiated' THEN
    UPDATE public.payment_transactions
    SET status = 'processing', updated_at = now()
    WHERE id = v_transaction.id;

    SELECT jsonb_agg(jsonb_build_object(
      'amount', ps.amount,
      'commerceCode', ps.commerce_code,
      'buyOrder', ps.child_buy_order
    ) ORDER BY ps.commerce_key)
    INTO v_details
    FROM public.payment_subtransactions ps
    WHERE ps.payment_transaction_id = v_transaction.id;

    RETURN jsonb_build_object(
      'success', true,
      'state', 'claimed',
      'transaction_id', v_transaction.id,
      'order_id', v_transaction.order_id,
      'mall_buy_order', v_transaction.mall_buy_order,
      'details', coalesce(v_details, '[]'::jsonb)
    );
  END IF;

  IF v_transaction.status IN ('authorized', 'partially_authorized', 'rejected', 'cancelled', 'payment_review') THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'order_id', v_transaction.order_id,
      'payment_status', v_transaction.status
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'already_processing',
    'order_id', v_transaction.order_id,
    'payment_status', v_transaction.status
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.create_message_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
  v_product_name text;
BEGIN
  SELECT
    CASE
      WHEN conversations.buyer_id = NEW.sender_id THEN conversations.seller_id
      WHEN conversations.seller_id = NEW.sender_id THEN conversations.buyer_id
      ELSE NULL
    END,
    COALESCE(NULLIF(btrim(profiles.full_name), ''), 'Usuario'),
    COALESCE(NULLIF(btrim(products.name), ''), 'Producto no disponible')
  INTO v_recipient_id, v_sender_name, v_product_name
  FROM public.conversations
  LEFT JOIN public.profiles ON profiles.id = NEW.sender_id
  LEFT JOIN public.products ON products.id = conversations.product_id
  WHERE conversations.id = NEW.conversation_id;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
    VALUES (
      v_recipient_id,
      'message',
      format('Tienes un nuevo mensaje de: %s', v_sender_name),
      v_product_name,
      format('/messages/%s', NEW.conversation_id),
      format('message:%s:recipient:%s', NEW.id, v_recipient_id)
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.create_order_item_sale_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = NEW.order_id
      AND status IN ('paid', 'completed')
  ) THEN
    INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
    SELECT
      NEW.seller_id,
      'sale',
      'Nueva venta',
      format('Recibiste una compra en la orden #%s.', NEW.order_id),
      '/profile',
      format('order:%s:sale:%s', NEW.order_id, NEW.seller_id)
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.create_order_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_seller record;
BEGIN
  IF NEW.status NOT IN ('paid', 'completed') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('paid', 'completed') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
  VALUES (
    NEW.buyer_id,
    'purchase',
    'Compra confirmada',
    format('Tu compra de la orden #%s fue confirmada.', NEW.id),
    '/profile',
    format('order:%s:purchase:%s', NEW.id, NEW.buyer_id)
  )
  ON CONFLICT (event_key) DO NOTHING;

  FOR v_seller IN
    SELECT DISTINCT order_items.seller_id
    FROM public.order_items
    WHERE order_items.order_id = NEW.id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
    VALUES (
      v_seller.seller_id,
      'sale',
      'Nueva venta',
      format('Recibiste una compra en la orden #%s.', NEW.id),
      '/profile',
      format('order:%s:sale:%s', NEW.id, v_seller.seller_id)
    )
    ON CONFLICT (event_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.create_pickup_order_escrows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid'
    AND NEW.shipping_method = 'pickup'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    INSERT INTO public.order_escrows (order_id, buyer_id, seller_id, amount)
    SELECT NEW.id, NEW.buyer_id, order_items.seller_id,
      sum(order_items.unit_price * order_items.quantity)
    FROM public.order_items
    WHERE order_items.order_id = NEW.id
    GROUP BY order_items.seller_id
    HAVING sum(order_items.unit_price * order_items.quantity) > 0
    ON CONFLICT (order_id, seller_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.create_product_ad_payment(p_user_id uuid, p_product_id bigint, p_duration_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_transaction_id uuid := gen_random_uuid();
  v_buy_order text := 'A' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_amount bigint;
BEGIN
  IF p_user_id IS NULL
    OR (auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  v_amount := CASE p_duration_days
    WHEN 1 THEN 1990
    WHEN 3 THEN 4990
    WHEN 7 THEN 9990
    WHEN 14 THEN 16990
    ELSE NULL
  END;
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'INVALID_AD_PLAN' USING ERRCODE = '22023';
  END IF;

  SELECT p.*
  INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.seller_id = p_user_id
    AND lower(coalesce(p.status::text, '')) IN ('true', 'active', 'published')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PUBLISHED_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_ad_transactions ad
    WHERE ad.product_id = p_product_id
      AND ad.status IN ('created', 'initiated', 'processing', 'communication_error', 'payment_review')
  ) THEN
    RAISE EXCEPTION 'PENDING_AD_PAYMENT_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.product_ad_transactions (
    id,
    product_id,
    seller_id,
    buy_order,
    duration_days,
    amount,
    status
  )
  VALUES (
    v_transaction_id,
    p_product_id,
    p_user_id,
    v_buy_order,
    p_duration_days,
    v_amount,
    'created'
  );

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'product_id', p_product_id,
    'buy_order', v_buy_order,
    'duration_days', p_duration_days,
    'amount', v_amount
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.create_webpay_checkout(p_user_id uuid, p_shipping_address text, p_shipping_method text, p_child_commerce_codes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cart_id uuid;
  v_order_id bigint;
  v_transaction_id uuid := gen_random_uuid();
  v_mall_buy_order text := 'M' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_shipping_cost numeric;
  v_subtotal numeric;
  v_total numeric;
  v_merchant_count integer;
  v_merchant_index integer := 0;
  v_group record;
  v_commerce_code text;
  v_child_buy_order text;
  v_child_amount bigint;
  v_shipping_share numeric;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL
    OR (auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF p_shipping_method IS NULL OR p_shipping_method NOT IN ('standard', 'pickup') THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_METHOD' USING ERRCODE = '22023';
  END IF;
  IF p_child_commerce_codes IS NULL
    OR cardinality(p_child_commerce_codes) <> 2
    OR p_child_commerce_codes[1] IS NULL
    OR p_child_commerce_codes[2] IS NULL
    OR p_child_commerce_codes[1] = p_child_commerce_codes[2] THEN
    RAISE EXCEPTION 'INVALID_TEST_MERCHANT_ASSIGNMENT' USING ERRCODE = '22023';
  END IF;
  IF p_shipping_method = 'standard' AND (
    p_shipping_address IS NULL OR length(btrim(p_shipping_address)) < 5
    OR length(p_shipping_address) > 500
  ) THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_ADDRESS' USING ERRCODE = '22023';
  END IF;

  v_shipping_cost := CASE WHEN p_shipping_method = 'standard' THEN 3990 ELSE 0 END;

  SELECT c.id INTO v_cart_id
  FROM public.carts c
  WHERE c.user_id = p_user_id
  FOR UPDATE;
  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_transactions pt
    JOIN public.orders o ON o.id = pt.order_id
    WHERE o.buyer_id = p_user_id
      AND pt.status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
  ) THEN
    RAISE EXCEPTION 'PENDING_PAYMENT_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM p.id
  FROM public.products p
  JOIN public.cart_items ci ON ci.product_id = p.id
  WHERE ci.cart_id = v_cart_id
  ORDER BY p.id
  FOR UPDATE OF p, ci;

  IF NOT EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.cart_id = v_cart_id) THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    LEFT JOIN public.stores st ON st.id = p.store_id
    WHERE ci.cart_id = v_cart_id
      AND (
        ci.quantity <= 0
          OR p.stock IS NULL
          OR p.stock - coalesce((
            SELECT sum(oi.quantity)
            FROM public.order_items oi
            JOIN public.payment_subtransactions ps
              ON (
                (ps.store_id IS NOT NULL AND oi.store_id = ps.store_id)
                OR (ps.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = ps.seller_id)
              )
            JOIN public.payment_transactions pt ON pt.id = ps.payment_transaction_id
            JOIN public.orders reserved_order ON reserved_order.id = pt.order_id
            WHERE oi.product_id = p.id
              AND (
                (
                  ps.status IN ('pending', 'verification_error', 'communication_error')
                  AND pt.status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
                )
                OR (
                  ps.status = 'authorized'
                  AND ps.inventory_processed = false
                  AND reserved_order.shipping_address = 'Acordar con el vendedor'
                  AND reserved_order.delivery_status <> 'completed'
                  AND pt.status IN ('authorized', 'partially_authorized', 'payment_review')
                )
                OR (
                  ps.status = 'authorized'
                  AND ps.inventory_processed = false
                  AND pt.status = 'payment_review'
                )
              )
          ), 0) < ci.quantity
          OR lower(coalesce(p.status::text, '')) NOT IN ('active', 'true')
          OR coalesce(p.sale_type, '') NOT IN ('direct', 'fixed_price')
        OR p.seller_id IS NULL
        OR (p.store_id IS NOT NULL AND (st.id IS NULL OR st.owner_id IS DISTINCT FROM p.seller_id))
        OR coalesce(
          CASE
            WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
            ELSE p.price
          END,
          -1
        ) < 0
      )
  ) THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(DISTINCT CASE
    WHEN p.store_id IS NOT NULL THEN 'store:' || p.store_id::text
    ELSE 'seller:' || p.seller_id::text
  END)
  INTO v_merchant_count
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart_id;

  IF v_merchant_count > 2 THEN
    RAISE EXCEPTION 'CART_SELLER_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant_count = 0 THEN
    RAISE EXCEPTION 'INVALID_MERCHANT' USING ERRCODE = 'P0001';
  END IF;

  SELECT sum(
    (CASE
      WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
      ELSE p.price
    END) * ci.quantity
  )
  INTO v_subtotal
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart_id;

  IF v_subtotal IS NULL OR v_subtotal <= 0 OR v_subtotal <> trunc(v_subtotal) THEN
    RAISE EXCEPTION 'INVALID_CLP_AMOUNT' USING ERRCODE = 'P0001';
  END IF;
  v_total := v_subtotal + v_shipping_cost;

  INSERT INTO public.orders (
    buyer_id,
    status,
    shipping_address,
    shipping_cost,
    subtotal,
    total,
    payment_method
  )
  VALUES (
    p_user_id,
    'pending_payment',
    CASE WHEN p_shipping_method = 'pickup' THEN 'Acordar con el vendedor' ELSE btrim(p_shipping_address) END,
    v_shipping_cost,
    v_subtotal,
    v_total,
    'webpay_plus_mall'
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
  SELECT
    v_order_id,
    p.id,
    p.store_id,
    p.seller_id,
    CASE
      WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
      ELSE p.price
    END,
    ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart_id;

  INSERT INTO public.payment_transactions (
    id,
    order_id,
    mall_buy_order,
    total_amount,
    status
  )
  VALUES (v_transaction_id, v_order_id, v_mall_buy_order, v_total::bigint, 'created');

  FOR v_group IN
    SELECT
      CASE
        WHEN p.store_id IS NOT NULL THEN 'store:' || p.store_id::text
        ELSE 'seller:' || p.seller_id::text
      END AS commerce_key,
      p.store_id,
      p.seller_id,
      sum(
        (CASE
          WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
          ELSE p.price
        END) * ci.quantity
      ) AS merchant_subtotal
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id
    GROUP BY
      CASE
        WHEN p.store_id IS NOT NULL THEN 'store:' || p.store_id::text
        ELSE 'seller:' || p.seller_id::text
      END,
      p.store_id,
      p.seller_id
    ORDER BY commerce_key
  LOOP
    v_merchant_index := v_merchant_index + 1;
    IF v_group.merchant_subtotal <> trunc(v_group.merchant_subtotal) THEN
      RAISE EXCEPTION 'INVALID_CLP_AMOUNT' USING ERRCODE = 'P0001';
    END IF;

    v_commerce_code := p_child_commerce_codes[v_merchant_index];
    IF v_commerce_code IS NULL THEN
      RAISE EXCEPTION 'CART_SELLER_LIMIT' USING ERRCODE = 'P0001';
    END IF;

    v_shipping_share := floor(v_shipping_cost / v_merchant_count);
    IF v_merchant_index = 1 THEN
      v_shipping_share := v_shipping_share + (v_shipping_cost - v_shipping_share * v_merchant_count);
    END IF;
    v_child_amount := (v_group.merchant_subtotal + v_shipping_share)::bigint;
    IF v_child_amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_CLP_AMOUNT' USING ERRCODE = 'P0001';
    END IF;

    v_child_buy_order := 'C' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
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
      v_group.commerce_key,
      v_commerce_code,
      v_child_buy_order,
      v_group.seller_id,
      v_group.store_id,
      v_child_amount
    );

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'amount', v_child_amount,
      'commerceCode', v_commerce_code,
      'buyOrder', v_child_buy_order
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'order_id', v_order_id,
    'mall_buy_order', v_mall_buy_order,
    'total_amount', v_total::bigint,
    'details', v_details
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.decrement_stock_after_pickup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.delivery_status IS DISTINCT FROM 'completed'
    AND NEW.delivery_status = 'completed'
    AND (
      NEW.shipping_address ILIKE '%Acordar con el vendedor%'
      OR NEW.shipping_address ILIKE 'retiro en tienda%'
    )
  THEN
    UPDATE public.products AS product
    SET
      stock = GREATEST(COALESCE(product.stock, 0) - items.quantity, 0),
      updated_at = now()
    FROM (
      SELECT product_id, SUM(quantity) AS quantity
      FROM public.order_items
      WHERE order_id = NEW.id
        AND product_id IS NOT NULL
      GROUP BY product_id
    ) AS items
    WHERE product.id = items.product_id;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.enforce_auction_bid_limits()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_starting_price numeric;
  v_bid_increment numeric;
  v_sale_type text;
  v_status text;
  v_previous_bid numeric;
  v_reference_amount numeric;
  v_minimum_bid numeric;
  v_maximum_bid numeric;
BEGIN
  SELECT
    starting_price,
    bid_increment,
    sale_type,
    status::text
  INTO
    v_starting_price,
    v_bid_increment,
    v_sale_type,
    v_status
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La subasta asociada a esta puja no existe.';
  END IF;

  IF v_sale_type IS DISTINCT FROM 'auction' OR v_status IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La publicación no es una subasta activa.';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <> trunc(NEW.amount) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Las pujas deben ser montos enteros en pesos chilenos.';
  END IF;

  SELECT MAX(amount)
  INTO v_previous_bid
  FROM public.bids
  WHERE product_id = NEW.product_id;

  v_reference_amount := COALESCE(v_previous_bid, v_starting_price);
  IF v_starting_price IS NULL OR v_starting_price <= 0
    OR v_starting_price <> trunc(v_starting_price)
    OR v_reference_amount IS NULL OR v_reference_amount <= 0
    OR v_bid_increment IS NULL OR v_bid_increment <= 0
    OR v_bid_increment > floor(v_starting_price * 0.5) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'La subasta no tiene un precio o incremento válido para aceptar pujas.';
  END IF;

  v_minimum_bid := COALESCE(v_previous_bid + v_bid_increment, v_starting_price);
  v_maximum_bid := floor(v_reference_amount * 1.5);

  IF NEW.amount < v_minimum_bid THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('La puja mínima para esta subasta es %s CLP.', v_minimum_bid);
  END IF;

  IF NEW.amount > v_maximum_bid THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format('La puja máxima para este turno es %s CLP.', v_maximum_bid);
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.ensure_pickup_order_chats(p_order_id bigint, p_buyer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_seller record;
  v_conversation_id bigint;
  v_conversations jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_order.buyer_id IS DISTINCT FROM p_buyer_id
    OR v_order.status <> 'paid'
    OR v_order.shipping_method <> 'pickup'
    OR (SELECT count(DISTINCT seller_id) FROM public.order_items WHERE order_id = p_order_id) <> 1
  THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  FOR v_seller IN
    SELECT
      order_items.seller_id,
      min(order_items.product_id) AS product_id,
      string_agg(
        DISTINCT COALESCE(NULLIF(btrim(products.name), ''), 'producto'),
        ', '
        ORDER BY COALESCE(NULLIF(btrim(products.name), ''), 'producto')
      ) AS product_names
    FROM public.order_items
    LEFT JOIN public.products ON products.id = order_items.product_id
    WHERE order_items.order_id = p_order_id
    GROUP BY order_items.seller_id
    ORDER BY order_items.seller_id
  LOOP
    SELECT conversation_id INTO v_conversation_id
    FROM public.order_seller_chats
    WHERE order_id = p_order_id AND seller_id = v_seller.seller_id;

    IF v_conversation_id IS NULL THEN
      INSERT INTO public.conversations (product_id, buyer_id, seller_id)
      VALUES (v_seller.product_id, p_buyer_id, v_seller.seller_id)
      RETURNING id INTO v_conversation_id;

      INSERT INTO public.order_seller_chats (order_id, seller_id, conversation_id)
      VALUES (p_order_id, v_seller.seller_id, v_conversation_id);

      INSERT INTO public.messages (conversation_id, sender_id, content)
      VALUES (
        v_conversation_id,
        p_buyer_id,
        format(
          'Hola, compré: %s · N° Orden #%s. Por favor, confirma por este chat cómo y cuándo realizaremos la entrega. Los fondos quedarán retenidos hasta validar el código OTP al recibir el producto.',
          v_seller.product_names,
          p_order_id
        )
      );
    END IF;

    v_conversations := v_conversations || jsonb_build_array(
      jsonb_build_object('seller_id', v_seller.seller_id, 'conversation_id', v_conversation_id)
    );
    v_conversation_id := NULL;
  END LOOP;

  RETURN jsonb_build_object('success', jsonb_array_length(v_conversations) > 0, 'conversations', v_conversations);
END;
$function$


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
    AND o.status IN ('pending_payment', 'payment_review')
  FOR UPDATE OF pt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status NOT IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error') THEN
    RETURN jsonb_build_object('success', false, 'state', 'already_processed');
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
$function$


CREATE OR REPLACE FUNCTION public.extend_auction_after_late_bid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  observed_at timestamptz := clock_timestamp();
BEGIN
  UPDATE public.products
  SET auction_ends_at = auction_ends_at + interval '5 minutes'
  WHERE id = NEW.product_id
    AND sale_type = 'auction'
    AND status = 'true'
    AND auction_ends_at > observed_at
    AND auction_ends_at <= observed_at + interval '3 minutes 30 seconds';

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.fail_product_ad_payment(p_user_id uuid, p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.product_ad_transactions
  SET status = 'rejected', updated_at = now()
  WHERE id = p_transaction_id
    AND seller_id = p_user_id
    AND status IN ('created', 'initiated');

  RETURN jsonb_build_object('success', FOUND);
END;
$function$


CREATE OR REPLACE FUNCTION public.fail_webpay_checkout(p_user_id uuid, p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id bigint;
BEGIN
  SELECT pt.order_id INTO v_order_id
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.id = p_transaction_id
    AND o.buyer_id = p_user_id
    AND pt.status = 'created'
  FOR UPDATE OF pt;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE public.payment_subtransactions
  SET status = 'rejected', updated_at = now()
  WHERE payment_transaction_id = p_transaction_id;

  UPDATE public.payment_transactions
  SET status = 'rejected', updated_at = now()
  WHERE id = p_transaction_id;

  UPDATE public.orders SET status = 'payment_failed' WHERE id = v_order_id;
  RETURN jsonb_build_object('success', true);
END;
$function$


CREATE OR REPLACE FUNCTION public.finalize_product_ad_payment(p_user_id uuid, p_transaction_id uuid, p_payment_status text, p_response jsonb, p_authorization_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.product_ad_transactions%ROWTYPE;
  v_returned_amount bigint;
  v_returned_response_code integer;
  v_returned_status text;
  v_final_status text;
BEGIN
  SELECT ad.*
  INTO v_payment
  FROM public.product_ad_transactions ad
  WHERE ad.id = p_transaction_id
    AND ad.seller_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status <> 'processing' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'product_id', v_payment.product_id,
      'payment_status', v_payment.status
    );
  END IF;

  v_returned_amount := CASE
    WHEN p_response->>'amount' ~ '^[0-9]+$' THEN (p_response->>'amount')::bigint
    ELSE NULL
  END;
  v_returned_response_code := CASE
    WHEN p_response->>'response_code' ~ '^-?[0-9]+$' THEN (p_response->>'response_code')::integer
    ELSE NULL
  END;
  v_returned_status := p_response->>'status';

  IF p_payment_status IS NULL
    OR p_payment_status NOT IN ('authorized', 'rejected', 'payment_review')
    OR p_response->>'buy_order' IS DISTINCT FROM v_payment.buy_order
    OR v_returned_amount IS DISTINCT FROM v_payment.amount
    OR (p_payment_status = 'authorized'
      AND (v_returned_response_code IS DISTINCT FROM 0 OR v_returned_status IS DISTINCT FROM 'AUTHORIZED'))
    OR (p_payment_status = 'rejected'
      AND (v_returned_response_code IS NULL OR v_returned_response_code = 0 OR v_returned_status = 'AUTHORIZED')) THEN
    v_final_status := 'payment_review';
  ELSE
    v_final_status := p_payment_status;
  END IF;

  UPDATE public.product_ad_transactions
  SET status = v_final_status,
      response = p_response,
      authorization_code = CASE
        WHEN v_final_status = 'authorized' THEN p_authorization_code
        ELSE NULL
      END,
      authorized_at = CASE WHEN v_final_status = 'authorized' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_payment.id;

  IF v_final_status = 'authorized' THEN
    UPDATE public.products
    SET is_featured = true,
        featured_until = greatest(coalesce(featured_until, now()), now())
          + make_interval(days => v_payment.duration_days)
    WHERE id = v_payment.product_id
      AND seller_id = p_user_id
      AND lower(coalesce(status::text, '')) IN ('true', 'active', 'published');

    IF NOT FOUND THEN
      UPDATE public.product_ad_transactions
      SET status = 'payment_review', updated_at = now()
      WHERE id = v_payment.id;
      v_final_status := 'payment_review';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'processed',
    'product_id', v_payment.product_id,
    'payment_status', v_final_status
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.finalize_webpay_commit(p_user_id uuid, p_transaction_id uuid, p_results jsonb, p_raw_response jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id bigint;
  v_transaction_status text;
  v_child public.payment_subtransactions%ROWTYPE;
  v_result jsonb;
  v_returned_amount bigint;
  v_response_code integer;
  v_status text;
  v_has_verification_error boolean := false;
  v_authorized_count integer := 0;
  v_rejected_count integer := 0;
  v_child_count integer := 0;
  v_final_status text;
  v_order_status text;
  v_can_process_inventory boolean;
BEGIN
  SELECT pt.order_id, pt.status INTO v_order_id, v_transaction_status
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.id = p_transaction_id
    AND o.buyer_id = p_user_id
  FOR UPDATE OF pt;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;
  IF v_transaction_status <> 'processing' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'order_id', v_order_id,
      'payment_status', v_transaction_status
    );
  END IF;

  FOR v_child IN
    SELECT ps.*
    FROM public.payment_subtransactions ps
    WHERE ps.payment_transaction_id = p_transaction_id
    FOR UPDATE
  LOOP
    v_child_count := v_child_count + 1;
    SELECT entry INTO v_result
    FROM jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) AS entries(entry)
    WHERE entry->>'expected_buy_order' = v_child.child_buy_order
    LIMIT 1;

    IF v_result IS NULL THEN
      UPDATE public.payment_subtransactions
      SET status = 'verification_error', response = NULL, updated_at = now()
      WHERE id = v_child.id;
      v_has_verification_error := true;
      CONTINUE;
    END IF;

    v_returned_amount := CASE
      WHEN v_result->>'returned_amount' ~ '^[0-9]+$' THEN (v_result->>'returned_amount')::bigint
      ELSE NULL
    END;
    v_response_code := CASE
      WHEN v_result->>'response_code' ~ '^-?[0-9]+$' THEN (v_result->>'response_code')::integer
      ELSE NULL
    END;
    v_status := v_result->>'status';

    IF coalesce((v_result->>'verification_error')::boolean, true)
      OR coalesce((v_result->>'mall_order_matches')::boolean, false) IS NOT TRUE
      OR v_result->>'returned_buy_order' IS DISTINCT FROM v_child.child_buy_order
      OR v_result->>'returned_commerce_code' IS DISTINCT FROM v_child.commerce_code
      OR v_returned_amount IS DISTINCT FROM v_child.amount THEN
      UPDATE public.payment_subtransactions
      SET status = 'verification_error',
          response_code = v_response_code,
          authorization_code = v_result->>'authorization_code',
          response = v_result,
          updated_at = now()
      WHERE id = v_child.id;
      v_has_verification_error := true;
    ELSIF v_response_code = 0 AND v_status = 'AUTHORIZED' THEN
      UPDATE public.payment_subtransactions
      SET status = 'authorized',
          response_code = v_response_code,
          authorization_code = v_result->>'authorization_code',
          authorized_at = CASE
            WHEN v_result->>'authorized_at' IS NOT NULL THEN (v_result->>'authorized_at')::timestamptz
            ELSE now()
          END,
          response = v_result,
          updated_at = now()
      WHERE id = v_child.id;
      v_authorized_count := v_authorized_count + 1;
    ELSE
      UPDATE public.payment_subtransactions
      SET status = 'rejected',
          response_code = v_response_code,
          authorization_code = v_result->>'authorization_code',
          response = v_result,
          updated_at = now()
      WHERE id = v_child.id;
      v_rejected_count := v_rejected_count + 1;
    END IF;
  END LOOP;

  IF v_child_count = 0 THEN
    v_has_verification_error := true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = v_order_id
      AND shipping_address = 'Acordar con el vendedor'
  ) THEN
    FOR v_child IN
      SELECT ps.*
      FROM public.payment_subtransactions ps
      WHERE ps.payment_transaction_id = p_transaction_id
        AND ps.status = 'authorized'
      FOR UPDATE
    LOOP
      PERFORM p.id
      FROM public.products p
      JOIN public.order_items oi ON oi.product_id = p.id
      WHERE oi.order_id = v_order_id
        AND (
          (v_child.store_id IS NOT NULL AND oi.store_id = v_child.store_id)
          OR (v_child.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = v_child.seller_id)
        )
      ORDER BY p.id
      FOR UPDATE OF p;

      SELECT coalesce(bool_and(p.stock >= sold.quantity), false)
      INTO v_can_process_inventory
      FROM (
        SELECT oi.product_id, sum(oi.quantity) AS quantity
        FROM public.order_items oi
        WHERE oi.order_id = v_order_id
          AND (
            (v_child.store_id IS NOT NULL AND oi.store_id = v_child.store_id)
            OR (v_child.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = v_child.seller_id)
          )
        GROUP BY oi.product_id
      ) AS sold
      JOIN public.products p ON p.id = sold.product_id;

      IF v_can_process_inventory THEN
        UPDATE public.products p
        SET stock = p.stock - sold.quantity,
            updated_at = now()
        FROM (
          SELECT oi.product_id, sum(oi.quantity) AS quantity
          FROM public.order_items oi
          WHERE oi.order_id = v_order_id
            AND (
              (v_child.store_id IS NOT NULL AND oi.store_id = v_child.store_id)
              OR (v_child.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = v_child.seller_id)
            )
          GROUP BY oi.product_id
        ) AS sold
        WHERE p.id = sold.product_id;

        UPDATE public.payment_subtransactions
        SET inventory_processed = true, updated_at = now()
        WHERE id = v_child.id;
      ELSE
        v_has_verification_error := true;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.payment_transactions
  SET response = p_raw_response,
      status = CASE
        WHEN v_has_verification_error THEN 'payment_review'
        WHEN v_authorized_count = v_child_count THEN 'authorized'
        WHEN v_authorized_count > 0 THEN 'partially_authorized'
        ELSE 'rejected'
      END,
      committed_at = now(),
      updated_at = now()
  WHERE id = p_transaction_id
  RETURNING status INTO v_final_status;

  v_order_status := CASE v_final_status
    WHEN 'authorized' THEN 'paid'
    WHEN 'partially_authorized' THEN 'partially_paid'
    WHEN 'payment_review' THEN 'payment_review'
    ELSE 'payment_failed'
  END;
  UPDATE public.orders SET status = v_order_status WHERE id = v_order_id;
  IF v_final_status = 'authorized' THEN
    UPDATE public.orders
    SET delivery_code = lpad(floor(random() * 1000000)::integer::text, 6, '0')
    WHERE id = v_order_id
      AND shipping_address = 'Acordar con el vendedor';
  END IF;

  DELETE FROM public.cart_items ci
  USING public.carts c, public.order_items oi, public.payment_subtransactions ps
  WHERE c.user_id = p_user_id
    AND ci.cart_id = c.id
    AND ci.product_id = oi.product_id
    AND oi.order_id = v_order_id
    AND ps.payment_transaction_id = p_transaction_id
    AND ps.status = 'authorized'
    AND (
      (ps.store_id IS NOT NULL AND oi.store_id = ps.store_id)
      OR (ps.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = ps.seller_id)
    )
    AND ci.quantity <= oi.quantity;

  UPDATE public.cart_items ci
  SET quantity = ci.quantity - oi.quantity, updated_at = now()
  FROM public.carts c, public.order_items oi, public.payment_subtransactions ps
  WHERE c.user_id = p_user_id
    AND ci.cart_id = c.id
    AND ci.product_id = oi.product_id
    AND oi.order_id = v_order_id
    AND ps.payment_transaction_id = p_transaction_id
    AND ps.status = 'authorized'
    AND (
      (ps.store_id IS NOT NULL AND oi.store_id = ps.store_id)
      OR (ps.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = ps.seller_id)
    )
    AND ci.quantity > oi.quantity;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'processed',
    'order_id', v_order_id,
    'payment_status', v_final_status,
    'authorized_count', v_authorized_count,
    'rejected_count', v_rejected_count
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.get_buyer_delivery_code(p_order_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_buyer_id UUID := auth.uid();
  v_delivery_code TEXT;
  v_shipping_address TEXT;
BEGIN
  IF v_buyer_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Debes iniciar sesión'
    );
  END IF;

  SELECT o.delivery_code, o.shipping_address
  INTO v_delivery_code, v_shipping_address
  FROM public.orders AS o
  WHERE o.id = p_order_id
    AND o.buyer_id = v_buyer_id;

  IF NOT FOUND
     OR (
       pg_catalog.lower(v_shipping_address) NOT LIKE '%acordar con el vendedor%'
       AND pg_catalog.lower(v_shipping_address) NOT LIKE 'retiro en tienda%'
     ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'No hay un código de retiro disponible para esta orden'
    );
  END IF;

  IF v_delivery_code IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'El código de retiro aún no está disponible'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', TRUE,
    'delivery_code', v_delivery_code
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.get_coordinated_buyer_delivery_code(p_order_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_code jsonb;
  v_expected_sellers integer;
  v_chat_count integer;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND buyer_id = auth.uid();

  IF NOT FOUND OR v_order.shipping_method <> 'pickup' OR v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'El código no está disponible para esta orden.');
  END IF;

  SELECT count(DISTINCT seller_id) INTO v_expected_sellers
  FROM public.order_items
  WHERE order_id = p_order_id;

  SELECT count(*) INTO v_chat_count
  FROM public.order_seller_chats
  WHERE order_id = p_order_id;

  IF v_chat_count <> v_expected_sellers OR EXISTS (
    SELECT 1
    FROM public.order_seller_chats
    WHERE order_id = p_order_id AND seller_replied_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'El vendedor debe confirmar la coordinación por el chat antes de habilitar el código.');
  END IF;

  IF (
    SELECT COALESCE(sum(unit_price * quantity), 0)
    FROM public.order_items
    WHERE order_id = p_order_id
  ) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.order_escrows
    WHERE order_id = p_order_id AND status = 'held'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Los fondos retenidos de esta orden no están disponibles.');
  END IF;

  v_code := to_jsonb(public.get_buyer_delivery_code(p_order_id));
  RETURN v_code;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_product_ad_payment_status(p_user_id uuid, p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment public.product_ad_transactions%ROWTYPE;
BEGIN
  SELECT ad.*
  INTO v_payment
  FROM public.product_ad_transactions ad
  WHERE ad.id = p_transaction_id
    AND ad.seller_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_payment.id,
    'product_id', v_payment.product_id,
    'payment_status', v_payment.status
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.get_server_time()
 RETURNS bigint
 LANGUAGE sql
 STABLE
AS $function$
  SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
$function$


CREATE OR REPLACE FUNCTION public.get_webpay_payment_status(p_user_id uuid, p_order_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_payment_status text;
  v_order_status text;
  v_paid_items jsonb;
BEGIN
  SELECT pt.status, o.status
  INTO v_payment_status, v_order_status
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.order_id = p_order_id
    AND o.buyer_id = p_user_id;

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
    ON ps.payment_transaction_id = (
      SELECT pt.id FROM public.payment_transactions pt WHERE pt.order_id = p_order_id
    )
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
$function$


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user' -- Siempre 'user' por defecto por seguridad
  );
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.profiles 
    WHERE id = auth.uid() 
      AND role = 'admin'
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.lock_auction_guarantee(p_user_id uuid, p_auction_id bigint, p_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- Verificar si el usuario tiene billetera, si no, crearla con 0
    INSERT INTO public.user_wallets (user_id, balance, locked_balance)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Obtener saldo disponible actual
    SELECT balance INTO v_current_balance 
    FROM public.user_wallets 
    WHERE user_id = p_user_id;

    -- Validar si tiene fondos suficientes
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente en la billetera para cubrir la garantía.');
    END IF;

    -- Verificar si ya tiene una garantía activa en esta subasta
    IF EXISTS (SELECT 1 FROM public.auction_guarantees WHERE user_id = p_user_id AND auction_id = p_auction_id AND status = 'locked') THEN
        RETURN jsonb_build_object('success', true, 'message', 'Garantía ya existente para esta subasta.');
    END IF;

    -- Descontar de balance disponible y sumar a balance retenido
    UPDATE public.user_wallets
    SET balance = balance - p_amount,
        locked_balance = locked_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Registrar la garantía retenida
    INSERT INTO public.auction_guarantees (auction_id, user_id, amount, status)
    VALUES (p_auction_id, p_user_id, p_amount, 'locked');

    RETURN jsonb_build_object('success', true, 'message', 'Garantía bloqueada exitosamente.');
END;
$function$


CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$function$


CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  UPDATE public.notifications
  SET read_at = COALESCE(read_at, now())
  WHERE id = p_notification_id
    AND user_id = auth.uid();

  RETURN FOUND;
END;
$function$


CREATE OR REPLACE FUNCTION public.mark_pickup_chat_seller_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.order_seller_chats
  SET seller_replied_at = COALESCE(seller_replied_at, NEW.created_at)
  WHERE conversation_id = NEW.conversation_id
    AND seller_id = NEW.sender_id;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.moderate_product(p_product_id bigint, p_action text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_admin_id uuid := auth.uid();
  v_reason text := NULLIF(BTRIM(p_reason), '');
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión autenticada.'
      USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_admin_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede moderar productos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('approved', 'rejected', 'flagged') THEN
    RAISE EXCEPTION 'La acción de moderación no es válida.'
      USING ERRCODE = '22023';
  END IF;

  IF p_action = 'rejected' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Debes indicar un motivo para rechazar el producto.'
      USING ERRCODE = '22023';
  END IF;

  IF p_action <> 'rejected' AND v_reason IS NULL THEN
    v_reason := CASE p_action
      WHEN 'approved' THEN 'Aprobado por revisión manual.'
      ELSE 'Marcado para revisión prioritaria.'
    END;
  END IF;

  UPDATE public.products
  SET moderation_status = p_action,
      moderation_reason = v_reason,
      moderated_at = now(),
      moderated_by = v_admin_id
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el producto que intentas moderar.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.product_moderation_reviews (
    product_id,
    admin_id,
    action,
    reason,
    detector_type,
    risk_category,
    result,
    reason_details,
    detector_version
  )
  VALUES (
    p_product_id,
    v_admin_id,
    p_action,
    v_reason,
    'manual',
    CASE p_action
      WHEN 'approved' THEN 'clear'
      WHEN 'rejected' THEN 'prohibited'
      ELSE 'flagged'
    END,
    p_action,
    v_reason,
    'manual-review-v1'
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.normalize_order_shipping_method()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(NEW.shipping_address) LIKE '%coordinar con el vendedor%'
    OR lower(NEW.shipping_address) LIKE '%acordar con el vendedor%'
    OR lower(NEW.shipping_address) LIKE 'retiro en tienda%'
  THEN
    NEW.shipping_method := 'pickup';
  ELSIF NEW.shipping_method IS NULL THEN
    NEW.shipping_method := 'standard';
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.order_belongs_to_buyer(p_order_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id = p_order_id
      AND o.buyer_id = (SELECT auth.uid())
  );
$function$


CREATE OR REPLACE FUNCTION public.order_has_seller(p_order_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items AS oi
    WHERE oi.order_id = p_order_id
      AND oi.seller_id = (SELECT auth.uid())
  );
$function$


CREATE OR REPLACE FUNCTION public.place_bid(p_product_id bigint, p_bid_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_product RECORD;
  v_min_bid NUMERIC;
  v_caller_id UUID := auth.uid();
BEGIN
  -- 1. Validar autenticación
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Debes iniciar sesión para ofertar');
  END IF;

  -- 2. Bloquear fila del producto para concurrencia
  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Producto no encontrado');
  END IF;

  -- 3. Validar tipo de venta
  IF v_product.sale_type != 'auction' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este producto no está en subasta');
  END IF;

  -- 4. Validar fecha límite
  IF v_product.auction_ends_at <= NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'La subasta ha finalizado');
  END IF;

  -- 5. Calcular puja mínima requerida
  IF v_product.current_bid IS NULL OR v_product.current_bid = 0 THEN
    v_min_bid := v_product.starting_price;
  ELSE
    v_min_bid := v_product.current_bid + COALESCE(v_product.bid_increment, 1000);
  END IF;

  IF p_bid_amount < v_min_bid THEN
    RETURN jsonb_build_object('success', false, 'message', 'La oferta debe ser de al menos $' || v_min_bid::text);
  END IF;

  -- 6. Insertar en bids (esto disparará automáticamente el trigger extend_auction_after_late_bid)
  INSERT INTO public.bids (product_id, bidder_id, amount)
  VALUES (p_product_id, v_caller_id, p_bid_amount);

  -- 7. Actualizar precio líder y ganador (la extensión de tiempo la hace el trigger)
  UPDATE public.products
  SET 
    current_bid = p_bid_amount,
    winner_id = v_caller_id
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Puja registrada exitosamente',
    'new_bid', p_bid_amount
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.prevent_multi_seller_pickup_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_order_id bigint;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_order_id := NEW.id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = v_order_id AND shipping_method = 'pickup'
  ) AND (
    SELECT count(DISTINCT seller_id)
    FROM public.order_items
    WHERE order_id = v_order_id
  ) > 1 THEN
    RAISE EXCEPTION 'PICKUP_MULTIPLE_SELLERS';
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.prevent_untrusted_order_payment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.status NOT IN ('paid', 'completed', 'delivered')
    AND (
      NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
      OR NEW.delivery_code IS DISTINCT FROM OLD.delivery_code
    ) THEN
    RAISE EXCEPTION 'Delivery can only proceed after payment authorization.'
      USING ERRCODE = '42501';
  END IF;

  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF lower(NEW.status) IN ('completed', 'delivered', 'paid', 'partially_paid') THEN
      RAISE EXCEPTION 'Payment status can only be set by the payment server.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
    OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW.shipping_cost IS DISTINCT FROM OLD.shipping_cost
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW.delivery_code IS DISTINCT FROM OLD.delivery_code
    OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status THEN
    RAISE EXCEPTION 'Payment status and amounts can only be changed by the payment server.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.prevent_untrusted_product_feature_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_featured IS DISTINCT FROM false OR NEW.featured_until IS NOT NULL THEN
      RAISE EXCEPTION 'Product promotion can only be activated by the payment server.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF lower(coalesce(OLD.status::text, '')) IN ('true', 'active', 'published')
    AND lower(coalesce(NEW.status::text, '')) NOT IN ('true', 'active', 'published')
    AND EXISTS (
      SELECT 1
      FROM public.product_ad_transactions ad
      WHERE ad.product_id = OLD.id
        AND ad.status IN ('created', 'initiated', 'processing', 'communication_error', 'payment_review')
    ) THEN
    RAISE EXCEPTION 'A product with a pending advertising payment cannot be unpublished.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
    OR NEW.featured_until IS DISTINCT FROM OLD.featured_until THEN
    RAISE EXCEPTION 'Product promotion can only be changed by the payment server.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.process_mock_checkout(p_shipping_address text, p_shipping_cost numeric, p_payment_method text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_buyer_id UUID := auth.uid();
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_order_id BIGINT;
  v_otp TEXT;
BEGIN
  IF v_buyer_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Debes estar autenticado'
    );
  END IF;

  IF p_shipping_address IS NULL
     OR pg_catalog.btrim(p_shipping_address) = '' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Debes ingresar una dirección de envío'
    );
  END IF;

  IF p_shipping_cost IS NULL OR p_shipping_cost < 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'El costo de envío no es válido'
    );
  END IF;

  IF p_payment_method IS NULL
     OR p_payment_method NOT IN ('webpay', 'mercadopago', 'mock') THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'El método de pago no es válido'
    );
  END IF;

  PERFORM 1
  FROM public.cart_items AS ci
  JOIN public.carts AS c
    ON c.id = ci.cart_id
  WHERE c.user_id = v_buyer_id
  FOR UPDATE OF ci;

  SELECT COALESCE(SUM(p.price * ci.quantity), 0)
  INTO v_subtotal
  FROM public.cart_items AS ci
  JOIN public.carts AS c
    ON c.id = ci.cart_id
  JOIN public.products AS p
    ON p.id = ci.product_id
  WHERE c.user_id = v_buyer_id;

  IF v_subtotal <= 0 THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'El carrito está vacío o no tiene productos válidos'
    );
  END IF;

  v_total := v_subtotal + p_shipping_cost;
  v_otp := pg_catalog.lpad(
    pg_catalog.floor(pg_catalog.random() * 1000000)::BIGINT::TEXT,
    6,
    '0'
  );

  INSERT INTO public.orders (
    buyer_id,
    status,
    shipping_address,
    shipping_cost,
    subtotal,
    total,
    payment_method,
    delivery_code,
    delivery_status
  )
  VALUES (
    v_buyer_id,
    'completed',
    p_shipping_address,
    p_shipping_cost,
    v_subtotal,
    v_total,
    p_payment_method,
    v_otp,
    'pending_pickup'
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
  SELECT
    v_order_id,
    p.id,
    p.store_id,
    p.seller_id,
    p.price,
    ci.quantity
  FROM public.cart_items AS ci
  JOIN public.carts AS c
    ON c.id = ci.cart_id
  JOIN public.products AS p
    ON p.id = ci.product_id
  WHERE c.user_id = v_buyer_id;

  DELETE FROM public.cart_items
  WHERE cart_id IN (
    SELECT c.id
    FROM public.carts AS c
    WHERE c.user_id = v_buyer_id
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', TRUE,
    'order_id', v_order_id,
    'subtotal', v_subtotal,
    'shipping_cost', p_shipping_cost,
    'total', v_total,
    'delivery_code', v_otp,
    'delivery_status', 'pending_pickup'
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.record_commission_for_paid_order_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMISSION_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.payment_method <> 'webpay_plus_mall'
    AND v_order.status IN ('paid', 'completed', 'delivered') THEN
    PERFORM public.record_order_item_commission(NEW.id);
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.record_commissions_for_authorized_subtransaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status <> 'authorized' OR NEW.response_code IS DISTINCT FROM 0 THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status
    AND OLD.response_code IS NOT DISTINCT FROM NEW.response_code THEN
    RETURN NEW;
  END IF;

  PERFORM public.record_commissions_for_payment_subtransaction(NEW.id);

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.record_commissions_for_paid_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_item_id bigint;
  v_subtransaction_id uuid;
BEGIN
  IF NEW.status NOT IN ('paid', 'partially_paid', 'completed', 'delivered') THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_method = 'webpay_plus_mall' THEN
    FOR v_subtransaction_id IN
      SELECT st.id
      FROM public.payment_transactions AS pt
      JOIN public.payment_subtransactions AS st ON st.payment_transaction_id = pt.id
      WHERE pt.order_id = NEW.id
        AND st.status = 'authorized'
        AND st.response_code = 0
      ORDER BY st.id
    LOOP
      PERFORM public.record_commissions_for_payment_subtransaction(v_subtransaction_id);
    END LOOP;
    RETURN NEW;
  END IF;

  FOR v_item_id IN
    SELECT id FROM public.order_items WHERE order_id = NEW.id ORDER BY id
  LOOP
    PERFORM public.record_order_item_commission(v_item_id);
  END LOOP;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.record_commissions_for_payment_subtransaction(p_payment_subtransaction_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_subtransaction record;
  v_order_status text;
  v_order_payment_method text;
  v_item_id bigint;
  v_item_count integer := 0;
BEGIN
  SELECT st.seller_id, st.store_id, st.status, st.response_code, pt.order_id
  INTO v_subtransaction
  FROM public.payment_subtransactions AS st
  JOIN public.payment_transactions AS pt ON pt.id = st.payment_transaction_id
  WHERE st.id = p_payment_subtransaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMISSION_PAYMENT_SUBTRANSACTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_subtransaction.status <> 'authorized' OR v_subtransaction.response_code IS DISTINCT FROM 0 THEN
    RETURN;
  END IF;

  SELECT status, payment_method
  INTO v_order_status, v_order_payment_method
  FROM public.orders
  WHERE id = v_subtransaction.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMISSION_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_order_payment_method <> 'webpay_plus_mall'
    OR v_order_status NOT IN ('paid', 'partially_paid', 'completed', 'delivered') THEN
    RETURN;
  END IF;

  FOR v_item_id IN
    SELECT id
    FROM public.order_items
    WHERE order_id = v_subtransaction.order_id
      AND seller_id = v_subtransaction.seller_id
      AND store_id IS NOT DISTINCT FROM v_subtransaction.store_id
    ORDER BY id
  LOOP
    PERFORM public.record_order_item_commission(v_item_id, p_payment_subtransaction_id);
    v_item_count := v_item_count + 1;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'COMMISSION_ORDER_ITEMS_NOT_FOUND' USING ERRCODE = '23514';
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.record_order_item_commission(p_order_item_id bigint, p_payment_subtransaction_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_item public.order_items%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_subtransaction record;
  v_base_amount bigint;
  v_commission_amount bigint;
BEGIN
  SELECT * INTO v_item
  FROM public.order_items
  WHERE id = p_order_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMISSION_ORDER_ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_item.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMMISSION_ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_payment_subtransaction_id IS NULL THEN
    IF v_order.payment_method = 'webpay_plus_mall'
      OR v_order.status NOT IN ('paid', 'completed', 'delivered') THEN
      RETURN;
    END IF;
  ELSE
    IF v_order.payment_method <> 'webpay_plus_mall'
      OR v_order.status NOT IN ('paid', 'partially_paid', 'completed', 'delivered') THEN
      RETURN;
    END IF;

    SELECT st.seller_id, st.store_id, st.status, st.response_code, pt.order_id
    INTO v_subtransaction
    FROM public.payment_subtransactions AS st
    JOIN public.payment_transactions AS pt ON pt.id = st.payment_transaction_id
    WHERE st.id = p_payment_subtransaction_id;

    IF NOT FOUND
      OR v_subtransaction.status <> 'authorized'
      OR v_subtransaction.response_code <> 0
      OR v_subtransaction.order_id <> v_item.order_id
      OR v_subtransaction.seller_id <> v_item.seller_id
      OR v_subtransaction.store_id IS DISTINCT FROM v_item.store_id THEN
      RAISE EXCEPTION 'COMMISSION_PAYMENT_SUBTRANSACTION_MISMATCH' USING ERRCODE = '23514';
    END IF;
  END IF;

  v_base_amount := pg_catalog.round(v_item.unit_price * v_item.quantity)::bigint;
  IF v_base_amount <= 0 THEN
    RETURN;
  END IF;

  v_commission_amount := pg_catalog.round((v_base_amount::numeric * 500) / 10000)::bigint;

  INSERT INTO public.order_commissions (
    order_id,
    order_item_id,
    payment_subtransaction_id,
    seller_id,
    store_id,
    base_amount,
    commission_rate_bps,
    commission_amount
  )
  VALUES (
    v_item.order_id,
    v_item.id,
    p_payment_subtransaction_id,
    v_item.seller_id,
    v_item.store_id,
    v_base_amount,
    500,
    v_commission_amount
  )
  ON CONFLICT (order_item_id) DO NOTHING;
END;
$function$


CREATE OR REPLACE FUNCTION public.record_product_ad_communication_error(p_user_id uuid, p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.product_ad_transactions
  SET status = 'communication_error', updated_at = now()
  WHERE id = p_transaction_id
    AND seller_id = p_user_id
    AND status = 'processing';

  RETURN jsonb_build_object('success', FOUND);
END;
$function$


CREATE OR REPLACE FUNCTION public.record_webpay_communication_error(p_user_id uuid, p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id bigint;
BEGIN
  UPDATE public.payment_transactions pt
  SET status = 'communication_error', updated_at = now(), committed_at = now()
  FROM public.orders o
  WHERE pt.id = p_transaction_id
    AND pt.order_id = o.id
    AND o.buyer_id = p_user_id
    AND pt.status = 'processing'
  RETURNING pt.order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  UPDATE public.payment_subtransactions
  SET status = 'communication_error', updated_at = now()
  WHERE payment_transaction_id = p_transaction_id
    AND status = 'pending';
  UPDATE public.orders SET status = 'payment_review' WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$function$


CREATE OR REPLACE FUNCTION public.release_auction_guarantees(p_auction_id bigint, p_winner_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    r_guarantee RECORD;
BEGIN
    -- Iterar sobre todas las garantías bloqueadas de esta subasta que NO sean del ganador
    FOR r_guarantee IN 
        SELECT id, user_id, amount 
        FROM public.auction_guarantees 
        WHERE auction_id = p_auction_id 
          AND status = 'locked' 
          AND user_id != p_winner_user_id
    LOOP
        -- Devolver el dinero al balance disponible del usuario
        UPDATE public.user_wallets
        SET balance = balance + r_guarantee.amount,
            locked_balance = locked_balance - r_guarantee.amount,
            updated_at = now()
        WHERE user_id = r_guarantee.user_id;

        -- Marcar garantía como liberada (o eliminarla, según prefieras registrar historial)
        UPDATE public.auction_guarantees
        SET status = 'available',
            updated_at = now()
        WHERE id = r_guarantee.id;
    END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION public.resolve_failed_webpay_checkout(p_user_id uuid, p_order_id bigint, p_final_status text, p_provider_response jsonb)
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
  FOR UPDATE OF pt;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status NOT IN ('initiated', 'processing', 'payment_review', 'communication_error') THEN
    RETURN jsonb_build_object('success', false, 'state', 'already_processed');
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
  WHERE id = v_payment.order_id;

  RETURN jsonb_build_object('success', true, 'state', p_final_status, 'order_id', v_payment.order_id);
END;
$function$


CREATE OR REPLACE FUNCTION public.save_product_ad_token(p_user_id uuid, p_transaction_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'INVALID_TRANSBANK_TOKEN' USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_ad_transactions
  SET transbank_token = p_token,
      status = 'initiated',
      updated_at = now()
  WHERE id = p_transaction_id
    AND seller_id = p_user_id
    AND status = 'created';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AD_PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$


CREATE OR REPLACE FUNCTION public.save_webpay_token(p_user_id uuid, p_transaction_id uuid, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_order_id bigint;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'INVALID_TRANSBANK_TOKEN' USING ERRCODE = '22023';
  END IF;

  UPDATE public.payment_transactions pt
  SET transbank_token = p_token,
      status = 'initiated',
      updated_at = now()
  FROM public.orders o
  WHERE pt.id = p_transaction_id
    AND pt.order_id = o.id
    AND o.buyer_id = p_user_id
    AND pt.status = 'created'
  RETURNING pt.order_id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$function$


CREATE OR REPLACE FUNCTION public.set_product_ad_payment_amount(p_user_id uuid, p_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_transaction public.product_ad_transactions%ROWTYPE;
  v_amount bigint;
BEGIN
  SELECT * INTO v_transaction
  FROM public.product_ad_transactions
  WHERE id = p_transaction_id
    AND seller_id = p_user_id
    AND status = 'created'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AD_TRANSACTION_NOT_PENDING' USING ERRCODE = 'P0002';
  END IF;

  v_amount := CASE v_transaction.duration_days
    WHEN 1 THEN 990
    WHEN 3 THEN 1990
    WHEN 7 THEN 3990
    WHEN 14 THEN 6990
    ELSE NULL
  END;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'INVALID_AD_PLAN' USING ERRCODE = '22023';
  END IF;

  UPDATE public.product_ad_transactions
  SET amount = v_amount,
      updated_at = pg_catalog.now()
  WHERE id = p_transaction_id
  RETURNING * INTO v_transaction;

  RETURN pg_catalog.jsonb_build_object(
    'transaction_id', v_transaction.id,
    'product_id', v_transaction.product_id,
    'buy_order', v_transaction.buy_order,
    'duration_days', v_transaction.duration_days,
    'amount', v_transaction.amount
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.verify_delivery_otp(p_order_id bigint, p_entered_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_seller_id UUID := auth.uid();
  v_order RECORD;
  v_is_seller_of_order BOOLEAN;
BEGIN

  -- Verificar autenticación
  IF v_seller_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Debes iniciar sesión'
    );
  END IF;

  -- Validar parámetros
  IF p_order_id IS NULL
     OR p_entered_code IS NULL
     OR p_entered_code !~ '^[0-9]{6}$' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'El identificador o código OTP no es válido'
    );
  END IF;

  -- Bloquear la orden para evitar confirmaciones simultáneas
  SELECT
    o.id,
    o.delivery_code,
    o.delivery_status
  INTO v_order
  FROM public.orders AS o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Orden no encontrada'
    );
  END IF;

  -- Verificar que el usuario sea vendedor de un ítem de la orden
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items AS oi
    WHERE oi.order_id = p_order_id
      AND oi.seller_id = v_seller_id
  )
  INTO v_is_seller_of_order;

  IF NOT v_is_seller_of_order THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'No tienes permisos para confirmar esta entrega'
    );
  END IF;

  -- Verificar si ya fue entregada
  IF v_order.delivery_status = 'completed' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Esta orden ya fue entregada anteriormente'
    );
  END IF;

  -- Verificar el código OTP
  IF v_order.delivery_code IS NULL
     OR v_order.delivery_code IS DISTINCT FROM p_entered_code THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', FALSE,
      'message', 'Código OTP incorrecto. Verifícalo con el comprador.'
    );
  END IF;

  -- Confirmar entrega
  UPDATE public.orders
  SET delivery_status = 'completed'
  WHERE id = p_order_id;

  -- Devolver confirmación
  RETURN pg_catalog.jsonb_build_object(
    'success', TRUE,
    'order_id', p_order_id,
    'delivery_status', 'completed',
    'message', 'Entrega confirmada con éxito'
  );

END;
$function$


CREATE OR REPLACE FUNCTION public.verify_pickup_otp_and_release_escrow(p_order_id bigint, p_entered_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_order public.orders%ROWTYPE;
  v_expected_sellers integer;
  v_chat_count integer;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND shipping_method = 'pickup'
  FOR UPDATE;

  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = p_order_id AND seller_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permiso para validar esta entrega.');
  END IF;

  SELECT count(DISTINCT seller_id) INTO v_expected_sellers
  FROM public.order_items
  WHERE order_id = p_order_id;

  IF v_expected_sellers <> 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta orden no cumple el requisito de un solo vendedor para liberar fondos con un OTP.');
  END IF;

  SELECT count(*) INTO v_chat_count
  FROM public.order_seller_chats
  WHERE order_id = p_order_id;

  IF v_chat_count <> v_expected_sellers OR EXISTS (
    SELECT 1
    FROM public.order_seller_chats
    WHERE order_id = p_order_id AND seller_replied_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Primero debes confirmar la coordinación de entrega por el chat con el comprador.');
  END IF;

  IF (
    SELECT COALESCE(sum(unit_price * quantity), 0)
    FROM public.order_items
    WHERE order_id = p_order_id
  ) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.order_escrows
    WHERE order_id = p_order_id AND status = 'held'
  ) AND v_order.delivery_status IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Los fondos retenidos de esta orden no están disponibles.');
  END IF;

  v_result := to_jsonb(public.verify_delivery_otp(p_order_id, p_entered_code));
  IF v_result->>'success' IS DISTINCT FROM 'true' THEN
    RETURN v_result;
  END IF;

  WITH released AS (
    UPDATE public.order_escrows
    SET status = 'released', released_at = now()
    WHERE order_id = p_order_id AND status = 'held'
    RETURNING seller_id, amount
  )
  INSERT INTO public.user_wallets (user_id, balance, locked_balance)
  SELECT seller_id, sum(amount), 0
  FROM released
  GROUP BY seller_id
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_wallets.balance + EXCLUDED.balance,
      updated_at = now();

  RETURN v_result || jsonb_build_object('funds_released', true);
END;
$function$