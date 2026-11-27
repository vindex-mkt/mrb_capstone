export const MAX_WALLET_TOPUP_AMOUNT = 999_999_999;

export async function startWalletTopup(amount: number): Promise<string | null> {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_WALLET_TOPUP_AMOUNT) {
    throw new RangeError("El monto de la recarga está fuera del rango permitido.");
  }

  const response = await fetch("/api/payments/wallet/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  const result = await response.json() as {
    message?: unknown;
    paymentUrl?: unknown;
    token?: unknown;
    transactionId?: unknown;
  };

  if (
    !response.ok
    && typeof result.transactionId === "string"
    && /^[0-9a-f-]{36}$/i.test(result.transactionId)
  ) {
    return `/wallet/resultado?transaction_id=${encodeURIComponent(result.transactionId)}&state=payment_review`;
  }

  if (
    !response.ok
    || typeof result.paymentUrl !== "string"
    || typeof result.token !== "string"
  ) {
    throw new Error(
      typeof result.message === "string"
        ? result.message
        : "No se pudo iniciar la recarga con Transbank.",
    );
  }

  const paymentForm = document.createElement("form");
  paymentForm.method = "POST";
  paymentForm.action = result.paymentUrl;
  const tokenInput = document.createElement("input");
  tokenInput.type = "hidden";
  tokenInput.name = "token_ws";
  tokenInput.value = result.token;
  paymentForm.appendChild(tokenInput);
  document.body.appendChild(paymentForm);
  paymentForm.submit();
  return null;
}
