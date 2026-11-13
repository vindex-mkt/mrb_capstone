export const PENDING_PAYMENT_MAX_AGE_MS = 5 * 60 * 1000;

export const isPendingPaymentExpired = (createdAt: string, now = Date.now()) => {
  const createdAtMs = Date.parse(createdAt);
  return Number.isFinite(createdAtMs) && now - createdAtMs >= PENDING_PAYMENT_MAX_AGE_MS;
};
