
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
