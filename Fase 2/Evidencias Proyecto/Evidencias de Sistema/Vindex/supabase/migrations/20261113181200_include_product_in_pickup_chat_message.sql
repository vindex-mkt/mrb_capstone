CREATE OR REPLACE FUNCTION public.ensure_pickup_order_chats(
  p_order_id bigint,
  p_buyer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

UPDATE public.messages
SET content = format(
  'Hola, compré: %s · N° Orden #%s. Por favor, confirma por este chat cómo y cuándo realizaremos la entrega. Los fondos quedarán retenidos hasta validar el código OTP al recibir el producto.',
  product_names.names,
  orders.id
)
FROM public.order_seller_chats
JOIN public.orders ON orders.id = order_seller_chats.order_id
CROSS JOIN LATERAL (
  SELECT string_agg(
    DISTINCT COALESCE(NULLIF(btrim(products.name), ''), 'producto'),
    ', '
    ORDER BY COALESCE(NULLIF(btrim(products.name), ''), 'producto')
  ) AS names
  FROM public.order_items
  LEFT JOIN public.products ON products.id = order_items.product_id
  WHERE order_items.order_id = orders.id
) AS product_names
WHERE messages.conversation_id = order_seller_chats.conversation_id
  AND messages.sender_id = orders.buyer_id
  AND messages.content LIKE 'Hola, pagué la orden #% con entrega a coordinar.%'
  AND product_names.names IS NOT NULL;
