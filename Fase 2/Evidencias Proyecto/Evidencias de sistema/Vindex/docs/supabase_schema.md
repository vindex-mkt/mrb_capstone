-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

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
  store_category_id bigint,
  category_id uuid,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT fk_products_profiles FOREIGN KEY (seller_id) REFERENCES public.profiles(id),
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