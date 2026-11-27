
CREATE TABLE public.products (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  store_id bigint,
  legacy_category_id bigint,
  name text,
  slug text,
  description text,
  price numeric,
  stock numeric,
  condition text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  images json,
  sale_type text,
  is_auction boolean,
  shipping_available boolean,
  seller_id uuid,
  is_featured boolean NOT NULL DEFAULT false,
  featured_until timestamp with time zone,
  discount_price numeric DEFAULT NULL::numeric,
  offer_ends_at timestamp with time zone,
  starting_price numeric DEFAULT 0,
  current_bid numeric DEFAULT 0,
  bid_increment numeric DEFAULT 1000,
  auction_ends_at timestamp with time zone,
  winner_id uuid,
  auction_mode text NOT NULL DEFAULT 'standard',
  store_category_id bigint,
  category_id uuid,
  moderation_status text NOT NULL DEFAULT 'pending_review'::text CHECK (moderation_status = ANY (ARRAY['pending_review'::text, 'approved'::text, 'rejected'::text, 'flagged'::text])),
  moderation_reason text,
  moderated_at timestamp with time zone,
  moderated_by uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT fk_products_profiles FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT products_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES public.profiles(id),
  CONSTRAINT products_store_category_id_fkey FOREIGN KEY (store_category_id) REFERENCES public.store_categories(id),
  CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id),
  CONSTRAINT products_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES auth.users(id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'user'::app_role,
  full_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  region text,
  city text,
  commune text,
  street text,
  street_number text,
  references text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  slug character varying NOT NULL UNIQUE,
  description text,
  icon text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.carts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT carts_pkey PRIMARY KEY (id),
  CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL,
  product_id bigint NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id),
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.bids (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  bidder_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bids_pkey PRIMARY KEY (id),
  CONSTRAINT bids_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT fk_bids_profiles FOREIGN KEY (bidder_id) REFERENCES public.profiles(id),
  CONSTRAINT bids_bidder_id_fkey FOREIGN KEY (bidder_id) REFERENCES auth.users(id)
);
CREATE TABLE public.favorites (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  product_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.stores (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  banner_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT stores_pkey PRIMARY KEY (id),
  CONSTRAINT stores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.store_categories (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  store_id bigint NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT store_categories_pkey PRIMARY KEY (id),
  CONSTRAINT store_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.reviews (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  store_id bigint,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT reviews_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT reviews_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.conversations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  product_id bigint,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id),
  CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  conversation_id bigint NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  buyer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'completed'::text,
  shipping_address text NOT NULL,
  shipping_cost numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL,
  total numeric NOT NULL,
  payment_method text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  delivery_code text,
  delivery_status text NOT NULL DEFAULT 'pending_pickup'::text,
  shipping_method text NOT NULL DEFAULT 'standard'::text CHECK (shipping_method = ANY (ARRAY['standard'::text, 'pickup'::text])),
  auction_product_id bigint UNIQUE REFERENCES public.products(id),
  auction_final_price numeric,
  auction_guarantee_amount numeric,
  auction_amount_due numeric,
  payment_due_at timestamp with time zone,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  product_id bigint,
  store_id bigint,
  seller_id uuid NOT NULL,
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT order_items_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.user_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0.00 CHECK (balance >= 0::numeric),
  locked_balance numeric NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_wallets_pkey PRIMARY KEY (id),
  CONSTRAINT user_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.wallet_topup_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  buy_order text NOT NULL UNIQUE,
  transbank_token text UNIQUE,
  amount bigint NOT NULL CHECK (amount > 0 AND amount <= 999999999),
  status text NOT NULL CHECK (status = ANY (ARRAY['created'::text, 'initiated'::text, 'processing'::text, 'authorized'::text, 'rejected'::text, 'cancelled'::text, 'communication_error'::text, 'payment_review'::text])),
  response jsonb,
  authorization_code text,
  authorized_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wallet_topup_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT wallet_topup_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.auction_guarantees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auction_id bigint NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status USER-DEFINED NOT NULL DEFAULT 'locked'::guarantee_status,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT auction_guarantees_pkey PRIMARY KEY (id),
  CONSTRAINT auction_guarantees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.auction_guarantee_forfeitures (
  order_id bigint NOT NULL,
  auction_id bigint NOT NULL,
  winner_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  guarantee_amount numeric NOT NULL CHECK (guarantee_amount > 0),
  seller_credit numeric NOT NULL CHECK (seller_credit >= 0),
  platform_amount numeric NOT NULL CHECK (platform_amount >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT auction_guarantee_forfeitures_pkey PRIMARY KEY (order_id),
  CONSTRAINT auction_guarantee_forfeitures_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT auction_guarantee_forfeitures_auction_id_fkey FOREIGN KEY (auction_id) REFERENCES public.products(id),
  CONSTRAINT auction_guarantee_forfeitures_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES auth.users(id),
  CONSTRAINT auction_guarantee_forfeitures_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES auth.users(id),
  CONSTRAINT auction_guarantee_forfeitures_amounts_check CHECK (seller_credit + platform_amount = guarantee_amount)
);
CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id bigint NOT NULL,
  mall_buy_order text NOT NULL UNIQUE,
  transbank_token text UNIQUE,
  total_amount bigint NOT NULL CHECK (total_amount > 0),
  status text NOT NULL CHECK (status = ANY (ARRAY['created'::text, 'initiated'::text, 'processing'::text, 'authorized'::text, 'partially_authorized'::text, 'rejected'::text, 'cancelled'::text, 'payment_review'::text, 'communication_error'::text])),
  response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  committed_at timestamp with time zone,
  CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.payment_subtransactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NOT NULL,
  commerce_key text NOT NULL,
  commerce_code text NOT NULL,
  child_buy_order text NOT NULL UNIQUE,
  seller_id uuid NOT NULL,
  store_id bigint,
  amount bigint NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'authorized'::text, 'rejected'::text, 'cancelled'::text, 'verification_error'::text, 'communication_error'::text])),
  response_code integer,
  authorization_code text,
  authorized_at timestamp with time zone,
  response jsonb,
  inventory_processed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_subtransactions_pkey PRIMARY KEY (id),
  CONSTRAINT payment_subtransactions_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id),
  CONSTRAINT payment_subtransactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT payment_subtransactions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.product_ad_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  seller_id uuid NOT NULL,
  buy_order text NOT NULL UNIQUE,
  transbank_token text UNIQUE,
  duration_days integer NOT NULL,
  amount bigint NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['created'::text, 'initiated'::text, 'processing'::text, 'authorized'::text, 'rejected'::text, 'cancelled'::text, 'communication_error'::text, 'payment_review'::text])),
  response jsonb,
  authorization_code text,
  authorized_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_ad_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT product_ad_transactions_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_ad_transactions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_escrows (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  status text NOT NULL DEFAULT 'held'::text CHECK (status = ANY (ARRAY['held'::text, 'released'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  released_at timestamp with time zone,
  CONSTRAINT order_escrows_pkey PRIMARY KEY (id),
  CONSTRAINT order_escrows_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_escrows_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.profiles(id),
  CONSTRAINT order_escrows_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_seller_chats (
  order_id bigint NOT NULL,
  seller_id uuid NOT NULL,
  conversation_id bigint NOT NULL UNIQUE,
  seller_replied_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT order_seller_chats_pkey PRIMARY KEY (order_id, seller_id),
  CONSTRAINT order_seller_chats_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_seller_chats_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT order_seller_chats_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
CREATE TABLE public.notifications (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['purchase'::text, 'sale'::text, 'message'::text])),
  title text NOT NULL,
  body text NOT NULL,
  href text NOT NULL,
  event_key text NOT NULL UNIQUE,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.product_moderation_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  admin_id uuid,
  action text NOT NULL CHECK (action = ANY (ARRAY['approved'::text, 'rejected'::text, 'flagged'::text, 'resubmitted'::text])),
  reason text,
  detector_type text,
  risk_category text,
  result text,
  reason_details text,
  match_score numeric,
  detector_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_moderation_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT product_moderation_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_moderation_reviews_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.product_detection_results (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  detector_type text NOT NULL CHECK (detector_type = ANY (ARRAY['text'::text, 'image'::text, 'category'::text, 'manual'::text])),
  risk_category text,
  result text,
  reason text,
  match_score numeric,
  detector_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_detection_results_pkey PRIMARY KEY (id),
  CONSTRAINT product_detection_results_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  is_resolved boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT product_reports_pkey PRIMARY KEY (id),
  CONSTRAINT product_reports_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id),
  CONSTRAINT product_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_commissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id bigint NOT NULL,
  order_item_id bigint NOT NULL UNIQUE,
  payment_subtransaction_id uuid,
  seller_id uuid NOT NULL,
  store_id bigint,
  base_amount bigint NOT NULL CHECK (base_amount > 0),
  commission_rate_bps smallint NOT NULL DEFAULT 500 CHECK (commission_rate_bps > 0 AND commission_rate_bps <= 10000),
  commission_amount bigint NOT NULL CHECK (commission_amount >= 0),
  status text NOT NULL DEFAULT 'pending_settlement'::text CHECK (status = ANY (ARRAY['pending_settlement'::text, 'collected'::text, 'reversed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  collected_at timestamp with time zone,
  CONSTRAINT order_commissions_pkey PRIMARY KEY (id),
  CONSTRAINT order_commissions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_commissions_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES public.order_items(id),
  CONSTRAINT order_commissions_payment_subtransaction_id_fkey FOREIGN KEY (payment_subtransaction_id) REFERENCES public.payment_subtransactions(id),
  CONSTRAINT order_commissions_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
  CONSTRAINT order_commissions_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);