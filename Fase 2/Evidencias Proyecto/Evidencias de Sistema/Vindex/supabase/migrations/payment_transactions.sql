create table public.payment_transactions (
  id uuid not null default gen_random_uuid (),
  order_id bigint not null,
  mall_buy_order text not null,
  transbank_token text null,
  total_amount bigint not null,
  status text not null,
  response jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  committed_at timestamp with time zone null,
  constraint payment_transactions_pkey primary key (id),
  constraint payment_transactions_order_id_key unique (order_id),
  constraint payment_transactions_mall_buy_order_key unique (mall_buy_order),
  constraint payment_transactions_transbank_token_key unique (transbank_token),
  constraint payment_transactions_order_id_fkey foreign KEY (order_id) references orders (id),
  constraint payment_transactions_status_check check (
    (
      status = any (
        array[
          'created'::text,
          'initiated'::text,
          'processing'::text,
          'authorized'::text,
          'partially_authorized'::text,
          'rejected'::text,
          'cancelled'::text,
          'payment_review'::text,
          'communication_error'::text
        ]
      )
    )
  ),
  constraint payment_transactions_total_amount_check check ((total_amount > 0))
) TABLESPACE pg_default;