ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_method text;

UPDATE public.orders
SET shipping_method = CASE
  WHEN lower(shipping_address) LIKE '%coordinar con el vendedor%'
    OR lower(shipping_address) LIKE '%acordar con el vendedor%'
    OR lower(shipping_address) LIKE 'retiro en tienda%'
  THEN 'pickup'
  ELSE 'standard'
END
WHERE shipping_method IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN shipping_method SET DEFAULT 'standard',
  ALTER COLUMN shipping_method SET NOT NULL;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_method_check
  CHECK (shipping_method IN ('standard', 'pickup'));

CREATE OR REPLACE FUNCTION public.normalize_order_shipping_method()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF lower(NEW.shipping_address) LIKE '%coordinar con el vendedor%'
    OR lower(NEW.shipping_address) LIKE '%acordar con el vendedor%'
    OR lower(NEW.shipping_address) LIKE 'retiro en tienda%'
  THEN
    NEW.shipping_method := 'pickup';
  ELSIF NEW.shipping_method IS NULL THEN
    NEW.shipping_method := 'standard';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER normalize_order_shipping_method
BEFORE INSERT OR UPDATE OF shipping_address, shipping_method
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_order_shipping_method();

CREATE OR REPLACE FUNCTION public.prevent_multi_seller_pickup_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order_id bigint;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    v_order_id := NEW.id;
  ELSE
    v_order_id := NEW.order_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = v_order_id AND shipping_method = 'pickup'
  ) AND (
    SELECT count(DISTINCT seller_id)
    FROM public.order_items
    WHERE order_id = v_order_id
  ) > 1 THEN
    RAISE EXCEPTION 'PICKUP_MULTIPLE_SELLERS';
  END IF;
  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER enforce_single_seller_pickup_order_items
AFTER INSERT OR UPDATE ON public.order_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.prevent_multi_seller_pickup_order();

CREATE CONSTRAINT TRIGGER enforce_single_seller_pickup_order
AFTER INSERT OR UPDATE ON public.orders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.prevent_multi_seller_pickup_order();

CREATE TABLE public.order_escrows (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id),
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  UNIQUE (order_id, seller_id),
  CHECK ((status = 'held' AND released_at IS NULL) OR (status = 'released' AND released_at IS NOT NULL))
);

CREATE INDEX order_escrows_buyer_status_idx ON public.order_escrows (buyer_id, status);
CREATE INDEX order_escrows_seller_status_idx ON public.order_escrows (seller_id, status);

ALTER TABLE public.order_escrows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_escrows FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_escrows TO authenticated;
GRANT ALL ON TABLE public.order_escrows TO service_role;

CREATE POLICY "Order participants can view their escrow"
ON public.order_escrows
FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE TABLE public.order_seller_chats (
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(id),
  conversation_id bigint NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  seller_replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, seller_id)
);

CREATE INDEX order_seller_chats_seller_order_idx ON public.order_seller_chats (seller_id, order_id);

ALTER TABLE public.order_seller_chats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_seller_chats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_seller_chats TO authenticated;
GRANT ALL ON TABLE public.order_seller_chats TO service_role;

CREATE POLICY "Order participants can view coordination chats"
ON public.order_seller_chats
FOR SELECT
TO authenticated
USING (
  auth.uid() = seller_id
  OR EXISTS (
    SELECT 1
    FROM public.orders
    WHERE orders.id = order_seller_chats.order_id
      AND orders.buyer_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.create_pickup_order_escrows()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid'
    AND NEW.shipping_method = 'pickup'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    INSERT INTO public.order_escrows (order_id, buyer_id, seller_id, amount)
    SELECT NEW.id, NEW.buyer_id, order_items.seller_id,
      sum(order_items.unit_price * order_items.quantity)
    FROM public.order_items
    WHERE order_items.order_id = NEW.id
    GROUP BY order_items.seller_id
    HAVING sum(order_items.unit_price * order_items.quantity) > 0
    ON CONFLICT (order_id, seller_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_pickup_order_escrows
AFTER INSERT OR UPDATE OF status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_pickup_order_escrows();

INSERT INTO public.order_escrows (order_id, buyer_id, seller_id, amount)
SELECT orders.id, orders.buyer_id, order_items.seller_id,
  sum(order_items.unit_price * order_items.quantity)
FROM public.orders
JOIN public.order_items ON order_items.order_id = orders.id
WHERE orders.status = 'paid'
  AND orders.shipping_method = 'pickup'
  AND orders.delivery_status IS DISTINCT FROM 'completed'
GROUP BY orders.id, orders.buyer_id, order_items.seller_id
HAVING sum(order_items.unit_price * order_items.quantity) > 0
ON CONFLICT (order_id, seller_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mark_pickup_chat_seller_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.order_seller_chats
  SET seller_replied_at = COALESCE(seller_replied_at, NEW.created_at)
  WHERE conversation_id = NEW.conversation_id
    AND seller_id = NEW.sender_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_pickup_chat_seller_reply
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.mark_pickup_chat_seller_reply();

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
    SELECT order_items.seller_id, min(order_items.product_id) AS product_id
    FROM public.order_items
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
          'Hola, pagué la orden #%s con entrega a coordinar. Por favor, confirma por este chat cómo y cuándo realizaremos la entrega. Los fondos quedarán retenidos hasta validar el código OTP al recibir el producto.',
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

CREATE OR REPLACE FUNCTION public.get_coordinated_buyer_delivery_code(p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_code jsonb;
  v_expected_sellers integer;
  v_chat_count integer;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND buyer_id = auth.uid();

  IF NOT FOUND OR v_order.shipping_method <> 'pickup' OR v_order.status <> 'paid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'El código no está disponible para esta orden.');
  END IF;

  SELECT count(DISTINCT seller_id) INTO v_expected_sellers
  FROM public.order_items
  WHERE order_id = p_order_id;

  SELECT count(*) INTO v_chat_count
  FROM public.order_seller_chats
  WHERE order_id = p_order_id;

  IF v_chat_count <> v_expected_sellers OR EXISTS (
    SELECT 1
    FROM public.order_seller_chats
    WHERE order_id = p_order_id AND seller_replied_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'El vendedor debe confirmar la coordinación por el chat antes de habilitar el código.');
  END IF;

  IF (
    SELECT COALESCE(sum(unit_price * quantity), 0)
    FROM public.order_items
    WHERE order_id = p_order_id
  ) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.order_escrows
    WHERE order_id = p_order_id AND status = 'held'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Los fondos retenidos de esta orden no están disponibles.');
  END IF;

  v_code := to_jsonb(public.get_buyer_delivery_code(p_order_id));
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_pickup_otp_and_release_escrow(
  p_order_id bigint,
  p_entered_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_order public.orders%ROWTYPE;
  v_expected_sellers integer;
  v_chat_count integer;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND shipping_method = 'pickup'
  FOR UPDATE;

  IF NOT FOUND OR NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_id = p_order_id AND seller_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'No tienes permiso para validar esta entrega.');
  END IF;

  SELECT count(DISTINCT seller_id) INTO v_expected_sellers
  FROM public.order_items
  WHERE order_id = p_order_id;

  IF v_expected_sellers <> 1 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta orden no cumple el requisito de un solo vendedor para liberar fondos con un OTP.');
  END IF;

  SELECT count(*) INTO v_chat_count
  FROM public.order_seller_chats
  WHERE order_id = p_order_id;

  IF v_chat_count <> v_expected_sellers OR EXISTS (
    SELECT 1
    FROM public.order_seller_chats
    WHERE order_id = p_order_id AND seller_replied_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Primero debes confirmar la coordinación de entrega por el chat con el comprador.');
  END IF;

  IF (
    SELECT COALESCE(sum(unit_price * quantity), 0)
    FROM public.order_items
    WHERE order_id = p_order_id
  ) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.order_escrows
    WHERE order_id = p_order_id AND status = 'held'
  ) AND v_order.delivery_status IS DISTINCT FROM 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Los fondos retenidos de esta orden no están disponibles.');
  END IF;

  v_result := to_jsonb(public.verify_delivery_otp(p_order_id, p_entered_code));
  IF v_result->>'success' IS DISTINCT FROM 'true' THEN
    RETURN v_result;
  END IF;

  WITH released AS (
    UPDATE public.order_escrows
    SET status = 'released', released_at = now()
    WHERE order_id = p_order_id AND status = 'held'
    RETURNING seller_id, amount
  )
  INSERT INTO public.user_wallets (user_id, balance, locked_balance)
  SELECT seller_id, sum(amount), 0
  FROM released
  GROUP BY seller_id
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.user_wallets.balance + EXCLUDED.balance,
      updated_at = now();

  RETURN v_result || jsonb_build_object('funds_released', true);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_pickup_order_chats(bigint, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_coordinated_buyer_delivery_code(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_pickup_otp_and_release_escrow(bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_buyer_delivery_code(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_delivery_otp(bigint, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_pickup_order_chats(bigint, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_coordinated_buyer_delivery_code(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pickup_otp_and_release_escrow(bigint, text) TO authenticated;
