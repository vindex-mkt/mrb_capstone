
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
