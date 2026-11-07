CREATE TABLE IF NOT EXISTS public.product_ad_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL REFERENCES public.products(id),
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  buy_order text NOT NULL UNIQUE,
  transbank_token text UNIQUE,
  duration_days integer NOT NULL,
  amount bigint NOT NULL,
  CHECK (
    (duration_days = 1 AND amount = 1990)
    OR (duration_days = 3 AND amount = 4990)
    OR (duration_days = 7 AND amount = 9990)
    OR (duration_days = 14 AND amount = 16990)
  ),
  status text NOT NULL CHECK (status IN (
    'created',
    'initiated',
    'processing',
    'authorized',
    'rejected',
    'cancelled',
    'communication_error',
    'payment_review'
  )),
  response jsonb,
  authorization_code text,
  authorized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_ad_transactions_seller_created_idx
  ON public.product_ad_transactions (seller_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS product_ad_transactions_pending_product_idx
  ON public.product_ad_transactions (product_id)
  WHERE status IN ('created', 'initiated', 'processing', 'communication_error', 'payment_review');

ALTER TABLE public.product_ad_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_ad_transactions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_untrusted_product_feature_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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
$$;

DROP TRIGGER IF EXISTS prevent_untrusted_product_feature_changes ON public.products;
CREATE TRIGGER prevent_untrusted_product_feature_changes
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.prevent_untrusted_product_feature_changes();

CREATE OR REPLACE FUNCTION public.create_product_ad_payment(
  p_user_id uuid,
  p_product_id bigint,
  p_duration_days integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.save_product_ad_token(
  p_user_id uuid,
  p_transaction_id uuid,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.fail_product_ad_payment(
  p_user_id uuid,
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.product_ad_transactions
  SET status = 'rejected', updated_at = now()
  WHERE id = p_transaction_id
    AND seller_id = p_user_id
    AND status IN ('created', 'initiated');

  RETURN jsonb_build_object('success', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_product_ad_commit(
  p_user_id uuid,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.finalize_product_ad_payment(
  p_user_id uuid,
  p_transaction_id uuid,
  p_payment_status text,
  p_response jsonb,
  p_authorization_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.cancel_product_ad_payment(
  p_user_id uuid,
  p_token text,
  p_buy_order text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.record_product_ad_communication_error(
  p_user_id uuid,
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.product_ad_transactions
  SET status = 'communication_error', updated_at = now()
  WHERE id = p_transaction_id
    AND seller_id = p_user_id
    AND status = 'processing';

  RETURN jsonb_build_object('success', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_ad_payment_status(
  p_user_id uuid,
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.create_product_ad_payment(uuid, bigint, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_product_ad_token(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_product_ad_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_product_ad_commit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_product_ad_payment(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_product_ad_payment(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_product_ad_communication_error(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_product_ad_payment_status(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_product_ad_payment(uuid, bigint, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_product_ad_token(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_product_ad_payment(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_product_ad_commit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_product_ad_payment(uuid, uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_product_ad_payment(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_product_ad_communication_error(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_product_ad_payment_status(uuid, uuid) TO service_role;
