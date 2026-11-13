CREATE OR REPLACE FUNCTION public.prevent_multi_seller_pickup_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
