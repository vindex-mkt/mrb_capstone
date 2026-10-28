"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type WalletBalances = {
  available: number;
  locked: number;
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

      const { data, error } = await supabase
        .from("user_wallets")
        .select("balance, locked_balance")
        .eq("user_id", userId)
        .maybeSingle();

      if (!isCurrent || currentRequest !== requestId) return;

      if (error) {
        setWallet({ userId, balances: null, loading: false, error: error.message });
        return;
      }

      if (!data) {
        setWallet({
          userId,
          balances: { available: 0, locked: 0 },
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
        balances: { available, locked },
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
