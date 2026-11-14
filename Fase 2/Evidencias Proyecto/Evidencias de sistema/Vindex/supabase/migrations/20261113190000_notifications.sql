CREATE TABLE public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'sale', 'message')),
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  event_key text NOT NULL UNIQUE,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_at_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX notifications_unread_user_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.mark_notification_read(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_order_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

CREATE TRIGGER create_order_notifications
AFTER INSERT OR UPDATE OF status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_order_notifications();

CREATE OR REPLACE FUNCTION public.create_order_item_sale_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
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
$$;

CREATE TRIGGER create_order_item_sale_notification
AFTER INSERT
ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.create_order_item_sale_notification();

CREATE OR REPLACE FUNCTION public.create_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_recipient_id uuid;
BEGIN
  SELECT CASE
    WHEN conversations.buyer_id = NEW.sender_id THEN conversations.seller_id
    WHEN conversations.seller_id = NEW.sender_id THEN conversations.buyer_id
    ELSE NULL
  END
  INTO v_recipient_id
  FROM public.conversations
  WHERE conversations.id = NEW.conversation_id;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, href, event_key)
    VALUES (
      v_recipient_id,
      'message',
      'Nuevo mensaje',
      'Tienes un nuevo mensaje en Vindex.',
      '/messages',
      format('message:%s:recipient:%s', NEW.id, v_recipient_id)
    )
    ON CONFLICT (event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER create_message_notification
AFTER INSERT
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.create_message_notification();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'La publicación supabase_realtime no existe.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END;
$$;
