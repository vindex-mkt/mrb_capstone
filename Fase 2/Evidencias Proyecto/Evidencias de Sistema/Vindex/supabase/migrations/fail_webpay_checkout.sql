
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
