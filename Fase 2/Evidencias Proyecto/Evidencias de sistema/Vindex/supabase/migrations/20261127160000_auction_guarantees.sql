ALTER TABLE public.auction_guarantees
  ADD COLUMN IF NOT EXISTS applied_to_price boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.place_bid(p_product_id bigint, p_bid_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_reference_bid numeric;
  v_min_bid numeric;
  v_max_bid numeric;
  v_guarantee_amount numeric;
  v_wallet_balance numeric;
  v_guarantee_locked boolean := false;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Debes iniciar sesión para ofertar.');
  END IF;

  IF p_bid_amount IS NULL OR p_bid_amount <= 0 OR p_bid_amount <> trunc(p_bid_amount) THEN
    RETURN jsonb_build_object('success', false, 'message', 'La puja debe ser un monto entero positivo.');
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No se encontró la subasta.');
  END IF;
  IF v_product.sale_type IS DISTINCT FROM 'auction' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este producto no está en subasta.');
  END IF;
  IF v_product.seller_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'No puedes pujar en tu propia subasta.');
  END IF;
  IF v_product.auction_ends_at IS NULL OR v_product.auction_ends_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'La subasta ha finalizado.');
  END IF;
  IF v_product.starting_price IS NULL OR v_product.starting_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'La subasta no tiene un precio base válido.');
  END IF;

  v_reference_bid := COALESCE(NULLIF(v_product.current_bid, 0), v_product.starting_price);
  v_min_bid := CASE
    WHEN v_product.current_bid IS NULL OR v_product.current_bid = 0 THEN v_product.starting_price
    ELSE v_product.current_bid + COALESCE(v_product.bid_increment, 1000)
  END;
  v_max_bid := GREATEST(FLOOR(v_reference_bid * 1.5), v_min_bid);

  IF p_bid_amount < v_min_bid OR p_bid_amount > v_max_bid THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('La puja debe estar entre %s y %s CLP.', v_min_bid, v_max_bid)
    );
  END IF;

  v_guarantee_amount := CEIL(v_product.starting_price * 0.10);

  IF NOT EXISTS (
    SELECT 1
    FROM public.auction_guarantees
    WHERE auction_id = p_product_id
      AND user_id = v_caller_id
      AND status = 'locked'
  ) THEN
    INSERT INTO public.user_wallets (user_id, balance, locked_balance)
    VALUES (v_caller_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance
    INTO v_wallet_balance
    FROM public.user_wallets
    WHERE user_id = v_caller_id
    FOR UPDATE;

    IF v_wallet_balance < v_guarantee_amount THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format(
          'Saldo insuficiente. Necesitas %s CLP disponibles para la garantía del 10%%.',
          v_guarantee_amount
        ),
        'guarantee_amount', v_guarantee_amount
      );
    END IF;

    UPDATE public.user_wallets
    SET balance = balance - v_guarantee_amount,
        locked_balance = locked_balance + v_guarantee_amount,
        updated_at = now()
    WHERE user_id = v_caller_id;

    INSERT INTO public.auction_guarantees (auction_id, user_id, amount, status)
    VALUES (p_product_id, v_caller_id, v_guarantee_amount, 'locked');
    v_guarantee_locked := true;
  END IF;

  INSERT INTO public.bids (product_id, bidder_id, amount)
  VALUES (p_product_id, v_caller_id, p_bid_amount);

  UPDATE public.products
  SET current_bid = p_bid_amount,
      winner_id = v_caller_id
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Puja registrada exitosamente.',
    'new_bid', p_bid_amount,
    'guarantee_amount', v_guarantee_amount,
    'guarantee_locked', v_guarantee_locked
  );
END;
$function$;

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
  v_released_count integer := 0;
  v_applied_count integer := 0;
  v_amount_due numeric;
BEGIN
  IF v_caller_id IS NULL AND session_user <> 'postgres' THEN
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

  SELECT *
  INTO v_user_guarantee
  FROM public.auction_guarantees
  WHERE auction_id = p_auction_id
    AND user_id = v_caller_id
  ORDER BY applied_to_price DESC, created_at DESC
  LIMIT 1;

  IF v_caller_id = v_product.winner_id AND FOUND AND v_user_guarantee.applied_to_price THEN
    v_amount_due := GREATEST(
      COALESCE(v_product.current_bid, v_product.starting_price) - v_user_guarantee.amount,
      0
    );
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
    'amount_due', v_amount_due
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
  FOR v_auction_id IN
    SELECT DISTINCT p.id
    FROM public.products AS p
    JOIN public.auction_guarantees AS g ON g.auction_id = p.id
    WHERE p.sale_type = 'auction'
      AND p.auction_ends_at <= now()
      AND g.status = 'locked'
    ORDER BY p.id
  LOOP
    v_result := public.settle_auction_guarantees(v_auction_id);
    IF COALESCE((v_result ->> 'success')::boolean, false) THEN
      v_settled_count := v_settled_count + 1;
    END IF;
  END LOOP;

  RETURN v_settled_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.place_bid(bigint, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_auction_guarantees(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_expired_auction_guarantees() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid(bigint, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_auction_guarantees(bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.lock_auction_guarantee(uuid, bigint, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_auction_guarantees(bigint, uuid) FROM PUBLIC, anon, authenticated;

DO $block$
DECLARE
  v_job_exists boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = $1)'
    INTO v_job_exists
    USING 'vindex-settle-auction-guarantees';

    IF NOT v_job_exists THEN
      EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING
        'vindex-settle-auction-guarantees',
        '* * * * *',
        'SELECT public.settle_expired_auction_guarantees();';
    END IF;
  ELSE
    RAISE NOTICE 'Enable pg_cron to settle guarantees in the background; auction rooms also settle on close.';
  END IF;
END;
$block$;
