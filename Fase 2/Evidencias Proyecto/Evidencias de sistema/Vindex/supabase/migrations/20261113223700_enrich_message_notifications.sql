CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

UPDATE public.notifications
SET
  title = format('Tienes un nuevo mensaje de: %s', COALESCE(NULLIF(btrim(sender.full_name), ''), 'Usuario')),
  body = COALESCE(NULLIF(btrim(product.name), ''), 'Producto no disponible'),
  href = format('/messages/%s', conversation.id)
FROM public.messages AS message
JOIN public.conversations AS conversation ON conversation.id = message.conversation_id
LEFT JOIN public.profiles AS sender ON sender.id = message.sender_id
LEFT JOIN public.products AS product ON product.id = conversation.product_id
WHERE public.notifications.type = 'message'
  AND public.notifications.event_key = format(
    'message:%s:recipient:%s',
    message.id,
    public.notifications.user_id
  );
