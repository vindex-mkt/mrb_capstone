-- 1. Crear tipo ENUM para los estados de la garantía / transacción
CREATE TYPE public.guarantee_status AS ENUM (
    'available',    -- Saldo libre en billetera
    'locked',       -- Garantía congelada por participar en una subasta
    'paid',         -- Garantía aplicada como pago parcial al ganar
    'forfeited'     -- Garantía incautada por incumplimiento (no pagar a tiempo)
);

-- 2. Tabla de Billetera / Créditos de Usuario
CREATE TABLE public.user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    locked_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_wallet UNIQUE (user_id)
);

-- 3. Tabla de Registro de Garantías en Subastas
CREATE TABLE public.auction_guarantees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id BIGINT NOT NULL, -- O UUID según el tipo de ID de tus subastas/productos
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status public.guarantee_status NOT NULL DEFAULT 'locked',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Habilitar RLS (Row Level Security)
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_guarantees ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad: Los usuarios solo pueden ver su propia billetera y garantías
CREATE POLICY "Users can view their own wallet" 
    ON public.user_wallets FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own guarantees" 
    ON public.auction_guarantees FOR SELECT 
    USING (auth.uid() = user_id);

-- Permisos SQL necesarios además de RLS para consultar desde el cliente autenticado
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.user_wallets TO authenticated;


-- 5. FUNCIÓN RPC: Bloquear Garantía para participar en Subasta
CREATE OR REPLACE FUNCTION public.lock_auction_guarantee(
    p_user_id UUID,
    p_auction_id BIGINT,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- Verificar si el usuario tiene billetera, si no, crearla con 0
    INSERT INTO public.user_wallets (user_id, balance, locked_balance)
    VALUES (p_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Obtener saldo disponible actual
    SELECT balance INTO v_current_balance 
    FROM public.user_wallets 
    WHERE user_id = p_user_id;

    -- Validar si tiene fondos suficientes
    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente en la billetera para cubrir la garantía.');
    END IF;

    -- Verificar si ya tiene una garantía activa en esta subasta
    IF EXISTS (SELECT 1 FROM public.auction_guarantees WHERE user_id = p_user_id AND auction_id = p_auction_id AND status = 'locked') THEN
        RETURN jsonb_build_object('success', true, 'message', 'Garantía ya existente para esta subasta.');
    END IF;

    -- Descontar de balance disponible y sumar a balance retenido
    UPDATE public.user_wallets
    SET balance = balance - p_amount,
        locked_balance = locked_balance + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;

    -- Registrar la garantía retenida
    INSERT INTO public.auction_guarantees (auction_id, user_id, amount, status)
    VALUES (p_auction_id, p_user_id, p_amount, 'locked');

    RETURN jsonb_build_object('success', true, 'message', 'Garantía bloqueada exitosamente.');
END;
$$;


-- 6. FUNCIÓN RPC: Liberar Garantías al Perdedor de una Subasta
CREATE OR REPLACE FUNCTION public.release_auction_guarantees(
    p_auction_id BIGINT,
    p_winner_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_guarantee RECORD;
BEGIN
    -- Iterar sobre todas las garantías bloqueadas de esta subasta que NO sean del ganador
    FOR r_guarantee IN 
        SELECT id, user_id, amount 
        FROM public.auction_guarantees 
        WHERE auction_id = p_auction_id 
          AND status = 'locked' 
          AND user_id != p_winner_user_id
    LOOP
        -- Devolver el dinero al balance disponible del usuario
        UPDATE public.user_wallets
        SET balance = balance + r_guarantee.amount,
            locked_balance = locked_balance - r_guarantee.amount,
            updated_at = now()
        WHERE user_id = r_guarantee.user_id;

        -- Marcar garantía como liberada (o eliminarla, según prefieras registrar historial)
        UPDATE public.auction_guarantees
        SET status = 'available',
            updated_at = now()
        WHERE id = r_guarantee.id;
    END LOOP;
END;
$$;