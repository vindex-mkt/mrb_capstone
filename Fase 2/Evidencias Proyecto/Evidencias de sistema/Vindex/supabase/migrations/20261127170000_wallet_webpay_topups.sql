CREATE TABLE public.wallet_topup_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  buy_order text NOT NULL UNIQUE,
  transbank_token text UNIQUE,
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 999999999),
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

CREATE INDEX wallet_topup_transactions_user_created_idx
  ON public.wallet_topup_transactions (user_id, created_at DESC);

ALTER TABLE public.wallet_topup_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wallet_topup_transactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.wallet_topup_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.create_wallet_topup(p_user_id uuid, p_amount bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_transaction_id uuid := gen_random_uuid();
  v_buy_order text := 'W' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_pending_id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 999999999 THEN
    RAISE EXCEPTION 'INVALID_WALLET_TOPUP_AMOUNT' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_wallets (user_id, balance, locked_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1
  FROM public.user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  SELECT id
  INTO v_pending_id
  FROM public.wallet_topup_transactions
  WHERE user_id = p_user_id
    AND status IN ('created', 'initiated', 'processing', 'communication_error', 'payment_review')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'PENDING_WALLET_TOPUP_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.wallet_topup_transactions (id, user_id, buy_order, amount, status)
  VALUES (v_transaction_id, p_user_id, v_buy_order, p_amount, 'created');

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'buy_order', v_buy_order,
    'amount', p_amount
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_wallet_topup_token(
  p_user_id uuid,
  p_transaction_id uuid,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 128 THEN
    RAISE EXCEPTION 'INVALID_TRANSBANK_TOKEN' USING ERRCODE = '22023';
  END IF;

  UPDATE public.wallet_topup_transactions
  SET transbank_token = p_token,
      status = 'initiated',
      updated_at = now()
  WHERE id = p_transaction_id
    AND user_id = p_user_id
    AND status = 'created';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_TOPUP_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_wallet_topup_review(
  p_user_id uuid,
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.wallet_topup_transactions
  SET status = 'payment_review',
      updated_at = now()
  WHERE id = p_transaction_id
    AND user_id = p_user_id
    AND status IN ('created', 'initiated', 'processing', 'communication_error');

  RETURN jsonb_build_object('success', FOUND);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_wallet_topup_commit(p_user_id uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_payment public.wallet_topup_transactions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.wallet_topup_transactions
  WHERE user_id = p_user_id
    AND transbank_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status IN ('authorized', 'rejected', 'cancelled', 'payment_review', 'communication_error') THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'transaction_id', v_payment.id,
      'amount', v_payment.amount,
      'payment_status', v_payment.status
    );
  END IF;

  IF v_payment.status = 'processing' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processing',
      'transaction_id', v_payment.id,
      'amount', v_payment.amount
    );
  END IF;

  IF v_payment.status <> 'initiated' THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  UPDATE public.wallet_topup_transactions
  SET status = 'processing',
      updated_at = now()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'claimed',
    'transaction_id', v_payment.id,
    'buy_order', v_payment.buy_order,
    'amount', v_payment.amount
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_wallet_topup(
  p_user_id uuid,
  p_token text,
  p_buy_order text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_payment public.wallet_topup_transactions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.wallet_topup_transactions
  WHERE user_id = p_user_id
    AND (
      (p_token IS NOT NULL AND transbank_token = p_token)
      OR (p_buy_order IS NOT NULL AND buy_order = p_buy_order)
    )
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  IF v_payment.status IN ('created', 'initiated') THEN
    UPDATE public.wallet_topup_transactions
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = v_payment.id;
    v_payment.status := 'cancelled';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'processed',
    'transaction_id', v_payment.id,
    'amount', v_payment.amount,
    'payment_status', v_payment.status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_wallet_topup(
  p_user_id uuid,
  p_transaction_id uuid,
  p_payment_status text,
  p_response jsonb,
  p_authorization_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_payment public.wallet_topup_transactions%ROWTYPE;
  v_returned_amount bigint;
  v_response_code integer;
  v_returned_status text;
  v_final_status text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.wallet_topup_transactions
  WHERE id = p_transaction_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;
  IF v_payment.status = 'authorized' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'payment_status', v_payment.status,
      'amount', v_payment.amount
    );
  END IF;
  IF v_payment.status <> 'processing' THEN
    RETURN jsonb_build_object(
      'success', true,
      'state', 'processed',
      'payment_status', v_payment.status,
      'amount', v_payment.amount
    );
  END IF;

  v_returned_amount := CASE
    WHEN p_response->>'amount' ~ '^[0-9]+$' THEN (p_response->>'amount')::bigint
    ELSE NULL
  END;
  v_response_code := CASE
    WHEN p_response->>'response_code' ~ '^-?[0-9]+$' THEN (p_response->>'response_code')::integer
    ELSE NULL
  END;
  v_returned_status := p_response->>'status';

  IF p_payment_status IS NULL
    OR p_payment_status NOT IN ('authorized', 'rejected', 'payment_review')
    OR p_response->>'buy_order' IS DISTINCT FROM v_payment.buy_order
    OR v_returned_amount IS DISTINCT FROM v_payment.amount
    OR (p_payment_status = 'authorized'
      AND (v_response_code IS DISTINCT FROM 0 OR v_returned_status IS DISTINCT FROM 'AUTHORIZED'))
    OR (p_payment_status = 'rejected'
      AND (v_response_code IS NULL OR v_response_code = 0 OR v_returned_status = 'AUTHORIZED')) THEN
    v_final_status := 'payment_review';
  ELSE
    v_final_status := p_payment_status;
  END IF;

  IF v_final_status = 'authorized' THEN
    UPDATE public.user_wallets
    SET balance = balance + v_payment.amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WALLET_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.wallet_topup_transactions
  SET status = v_final_status,
      response = p_response,
      authorization_code = CASE
        WHEN v_final_status = 'authorized' THEN p_authorization_code
        ELSE NULL
      END,
      authorized_at = CASE WHEN v_final_status = 'authorized' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'success', true,
    'state', 'processed',
    'payment_status', v_final_status,
    'amount', v_payment.amount
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_wallet_topup_status(p_user_id uuid, p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_payment public.wallet_topup_transactions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.wallet_topup_transactions
  WHERE id = p_transaction_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'state', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_payment.id,
    'amount', v_payment.amount,
    'payment_status', v_payment.status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_wallet_topup(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_wallet_topup_token(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_wallet_topup_review(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_wallet_topup_commit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_wallet_topup(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_wallet_topup(uuid, uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_wallet_topup_status(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_wallet_topup(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_wallet_topup_token(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_wallet_topup_review(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_wallet_topup_commit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_wallet_topup(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_wallet_topup(uuid, uuid, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_wallet_topup_status(uuid, uuid) TO service_role;
