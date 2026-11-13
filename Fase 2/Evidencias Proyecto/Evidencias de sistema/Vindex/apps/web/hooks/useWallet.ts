"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type WalletBalances = {
  available: number;
  locked: number;
  buyerEscrow: number;
  sellerEscrow: number;
};

type WalletState = {
  userId: string | null;
  balances: WalletBalances | null;
  loading: boolean;
  error: string | null;
};

const parseBalance = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

export function useWallet() {
  const [supabase] = useState(createClient);
  const [wallet, setWallet] = useState<WalletState>({
    userId: null,
    balances: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isCurrent = true;
    let requestId = 0;

    const loadWallet = async (userId: string | null) => {
      const currentRequest = ++requestId;
      if (!isCurrent) return;

      setWallet((current) => ({
        ...current,
        userId,
        loading: true,
        error: null,
      }));

      if (!userId) {
        setWallet({ userId: null, balances: null, loading: false, error: null });
        return;
      }

      const [{ data, error }, { data: escrows, error: escrowError }] = await Promise.all([
        supabase
          .from("user_wallets")
          .select("balance, locked_balance")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("order_escrows")
          .select("buyer_id, seller_id, amount")
          .eq("status", "held")
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
      ]);

      if (!isCurrent || currentRequest !== requestId) return;

      if (error || escrowError) {
        setWallet({
          userId,
          balances: null,
          loading: false,
          error: error?.message ?? escrowError?.message ?? "No se pudo consultar la custodia de las órdenes.",
        });
        return;
      }

      const heldEscrows = escrows ?? [];
      const escrowAmounts = heldEscrows.map((escrow) => parseBalance(escrow.amount));
      if (escrowAmounts.some((amount) => amount === null)) {
        setWallet({
          userId,
          balances: null,
          loading: false,
          error: "La billetera contiene un monto en custodia inválido.",
        });
        return;
      }
      const buyerEscrow = heldEscrows
        .reduce((total, escrow, index) => total + (
          escrow.buyer_id === userId ? escrowAmounts[index] ?? 0 : 0
        ), 0);
      const sellerEscrow = heldEscrows
        .reduce((total, escrow, index) => total + (
          escrow.seller_id === userId ? escrowAmounts[index] ?? 0 : 0
        ), 0);

      if (!data) {
        setWallet({
          userId,
          balances: { available: 0, locked: 0, buyerEscrow, sellerEscrow },
          loading: false,
          error: null,
        });
        return;
      }

      const available = parseBalance(data.balance);
      const locked = parseBalance(data.locked_balance);
      if (available === null || locked === null) {
        setWallet({
          userId,
          balances: null,
          loading: false,
          error: "La billetera contiene un saldo inválido.",
        });
        return;
      }

      setWallet({
        userId,
        balances: { available, locked, buyerEscrow, sellerEscrow },
        loading: false,
        error: null,
      });
    };

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!isCurrent) return;
      if (error) {
        requestId += 1;
        setWallet({
          userId: null,
          balances: null,
          loading: false,
          error: error.message,
        });
        return;
      }
      await loadWallet(data.user?.id ?? null);
    };

    void loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadWallet(session?.user.id ?? null);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return wallet;
}
