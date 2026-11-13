
DECLARE
  v_cart_id uuid;
  v_order_id bigint;
  v_transaction_id uuid := gen_random_uuid();
  v_mall_buy_order text := 'M' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
  v_shipping_cost numeric;
  v_subtotal numeric;
  v_total numeric;
  v_merchant_count integer;
  v_merchant_index integer := 0;
  v_group record;
  v_commerce_code text;
  v_child_buy_order text;
  v_child_amount bigint;
  v_shipping_share numeric;
  v_details jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL
    OR (auth.role() IS DISTINCT FROM 'service_role' AND p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;
  IF p_shipping_method IS NULL OR p_shipping_method NOT IN ('standard', 'pickup') THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_METHOD' USING ERRCODE = '22023';
  END IF;
  IF p_child_commerce_codes IS NULL
    OR cardinality(p_child_commerce_codes) <> 2
    OR p_child_commerce_codes[1] IS NULL
    OR p_child_commerce_codes[2] IS NULL
    OR p_child_commerce_codes[1] = p_child_commerce_codes[2] THEN
    RAISE EXCEPTION 'INVALID_TEST_MERCHANT_ASSIGNMENT' USING ERRCODE = '22023';
  END IF;
  IF p_shipping_method = 'standard' AND (
    p_shipping_address IS NULL OR length(btrim(p_shipping_address)) < 5
    OR length(p_shipping_address) > 500
  ) THEN
    RAISE EXCEPTION 'INVALID_SHIPPING_ADDRESS' USING ERRCODE = '22023';
  END IF;

  v_shipping_cost := CASE WHEN p_shipping_method = 'standard' THEN 3990 ELSE 0 END;

  SELECT c.id INTO v_cart_id
  FROM public.carts c
  WHERE c.user_id = p_user_id
  FOR UPDATE;
  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_transactions pt
    JOIN public.orders o ON o.id = pt.order_id
    WHERE o.buyer_id = p_user_id
      AND pt.status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
  ) THEN
    RAISE EXCEPTION 'PENDING_PAYMENT_EXISTS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM p.id
  FROM public.products p
  JOIN public.cart_items ci ON ci.product_id = p.id
  WHERE ci.cart_id = v_cart_id
  ORDER BY p.id
  FOR UPDATE OF p, ci;

  IF NOT EXISTS (SELECT 1 FROM public.cart_items ci WHERE ci.cart_id = v_cart_id) THEN
    RAISE EXCEPTION 'CART_EMPTY' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    LEFT JOIN public.stores st ON st.id = p.store_id
    WHERE ci.cart_id = v_cart_id
      AND (
        ci.quantity <= 0
          OR p.stock IS NULL
          OR p.stock - coalesce((
            SELECT sum(oi.quantity)
            FROM public.order_items oi
            JOIN public.payment_subtransactions ps
              ON (
                (ps.store_id IS NOT NULL AND oi.store_id = ps.store_id)
                OR (ps.store_id IS NULL AND oi.store_id IS NULL AND oi.seller_id = ps.seller_id)
              )
            JOIN public.payment_transactions pt ON pt.id = ps.payment_transaction_id
            JOIN public.orders reserved_order ON reserved_order.id = pt.order_id
            WHERE oi.product_id = p.id
              AND (
                (
                  ps.status IN ('pending', 'verification_error', 'communication_error')
                  AND pt.status IN ('created', 'initiated', 'processing', 'payment_review', 'communication_error')
                )
                OR (
                  ps.status = 'authorized'
                  AND ps.inventory_processed = false
                  AND reserved_order.shipping_address = 'Acordar con el vendedor'
                  AND reserved_order.delivery_status <> 'completed'
                  AND pt.status IN ('authorized', 'partially_authorized', 'payment_review')
                )
                OR (
                  ps.status = 'authorized'
                  AND ps.inventory_processed = false
                  AND pt.status = 'payment_review'
                )
              )
          ), 0) < ci.quantity
          OR lower(coalesce(p.status::text, '')) NOT IN ('active', 'true')
          OR coalesce(p.sale_type, '') NOT IN ('direct', 'fixed_price')
        OR p.seller_id IS NULL
        OR (p.store_id IS NOT NULL AND (st.id IS NULL OR st.owner_id IS DISTINCT FROM p.seller_id))
        OR coalesce(
          CASE
            WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
            ELSE p.price
          END,
          -1
        ) < 0
      )
  ) THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(DISTINCT CASE
    WHEN p.store_id IS NOT NULL THEN 'store:' || p.store_id::text
    ELSE 'seller:' || p.seller_id::text
  END)
  INTO v_merchant_count
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart_id;

  IF v_merchant_count > 2 THEN
    RAISE EXCEPTION 'CART_SELLER_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant_count = 0 THEN
    RAISE EXCEPTION 'INVALID_MERCHANT' USING ERRCODE = 'P0001';
  END IF;

  SELECT sum(
    (CASE
      WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
      ELSE p.price
    END) * ci.quantity
  )
  INTO v_subtotal
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart_id;

  IF v_subtotal IS NULL OR v_subtotal <= 0 OR v_subtotal <> trunc(v_subtotal) THEN
    RAISE EXCEPTION 'INVALID_CLP_AMOUNT' USING ERRCODE = 'P0001';
  END IF;
  v_total := v_subtotal + v_shipping_cost;

  INSERT INTO public.orders (
    buyer_id,
    status,
    shipping_address,
    shipping_cost,
    subtotal,
    total,
    payment_method
  )
  VALUES (
    p_user_id,
    'pending_payment',
    CASE WHEN p_shipping_method = 'pickup' THEN 'Acordar con el vendedor' ELSE btrim(p_shipping_address) END,
    v_shipping_cost,
    v_subtotal,
    v_total,
    'webpay_plus_mall'
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.order_items (
    order_id,
    product_id,
    store_id,
    seller_id,
    unit_price,
    quantity
  )
  SELECT
    v_order_id,
    p.id,
    p.store_id,
    p.seller_id,
    CASE
      WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
      ELSE p.price
    END,
    ci.quantity
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE ci.cart_id = v_cart_id;

  INSERT INTO public.payment_transactions (
    id,
    order_id,
    mall_buy_order,
    total_amount,
    status
  )
  VALUES (v_transaction_id, v_order_id, v_mall_buy_order, v_total::bigint, 'created');

  FOR v_group IN
    SELECT
      CASE
        WHEN p.store_id IS NOT NULL THEN 'store:' || p.store_id::text
        ELSE 'seller:' || p.seller_id::text
      END AS commerce_key,
      p.store_id,
      p.seller_id,
      sum(
        (CASE
          WHEN p.discount_price IS NOT NULL AND p.offer_ends_at > now() THEN p.discount_price
          ELSE p.price
        END) * ci.quantity
      ) AS merchant_subtotal
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id
    GROUP BY
      CASE
        WHEN p.store_id IS NOT NULL THEN 'store:' || p.store_id::text
        ELSE 'seller:' || p.seller_id::text
      END,
      p.store_id,
      p.seller_id
    ORDER BY commerce_key
  LOOP
    v_merchant_index := v_merchant_index + 1;
    IF v_group.merchant_subtotal <> trunc(v_group.merchant_subtotal) THEN
      RAISE EXCEPTION 'INVALID_CLP_AMOUNT' USING ERRCODE = 'P0001';
    END IF;

    v_commerce_code := p_child_commerce_codes[v_merchant_index];
    IF v_commerce_code IS NULL THEN
      RAISE EXCEPTION 'CART_SELLER_LIMIT' USING ERRCODE = 'P0001';
    END IF;

    v_shipping_share := floor(v_shipping_cost / v_merchant_count);
    IF v_merchant_index = 1 THEN
      v_shipping_share := v_shipping_share + (v_shipping_cost - v_shipping_share * v_merchant_count);
    END IF;
    v_child_amount := (v_group.merchant_subtotal + v_shipping_share)::bigint;
    IF v_child_amount <= 0 THEN
      RAISE EXCEPTION 'INVALID_CLP_AMOUNT' USING ERRCODE = 'P0001';
    END IF;

    v_child_buy_order := 'C' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20);
    INSERT INTO public.payment_subtransactions (
      payment_transaction_id,
      commerce_key,
      commerce_code,
      child_buy_order,
      seller_id,
      store_id,
      amount
    )
    VALUES (
      v_transaction_id,
      v_group.commerce_key,
      v_commerce_code,
      v_child_buy_order,
      v_group.seller_id,
      v_group.store_id,
      v_child_amount
    );

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'amount', v_child_amount,
      'commerceCode', v_commerce_code,
      'buyOrder', v_child_buy_order
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'transaction_id', v_transaction_id,
    'order_id', v_order_id,
    'mall_buy_order', v_mall_buy_order,
    'total_amount', v_total::bigint,
    'details', v_details
  );
END;
