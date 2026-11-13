CREATE OR REPLACE FUNCTION public.resolve_failed_webpay_checkout(
  p_user_id uuid,
  p_order_id bigint,
  p_final_status text,
  p_provider_response jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.resolve_failed_webpay_checkout(uuid, bigint, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_failed_webpay_checkout(uuid, bigint, text, jsonb) TO service_role;
