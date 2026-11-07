export const featuredPlans = [
  { days: 1, price: 1990 },
  { days: 3, price: 4990 },
  { days: 7, price: 9990 },
  { days: 14, price: 16990 },
] as const;

export async function startAdvertisingPayment(productId: number, durationDays: number) {
  const response = await fetch("/api/payments/advertising/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, durationDays }),
  });
  const result = await response.json() as {
    message?: unknown;
    paymentUrl?: unknown;
    token?: unknown;
  };

  if (
    !response.ok
    || typeof result.paymentUrl !== "string"
    || typeof result.token !== "string"
  ) {
    throw new Error(
      typeof result.message === "string"
        ? result.message
        : "No se pudo iniciar el pago de publicidad con Transbank.",
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
}
