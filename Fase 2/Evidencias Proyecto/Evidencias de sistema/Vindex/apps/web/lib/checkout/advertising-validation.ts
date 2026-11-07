export type AdvertisingPaymentStatus = "authorized" | "rejected" | "payment_review";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateAdvertisingCommitResponse = (
  value: unknown,
  expectedBuyOrder: string,
  expectedAmount: number,
): AdvertisingPaymentStatus => {
  if (
    !isRecord(value)
    || value.buy_order !== expectedBuyOrder
    || typeof value.amount !== "number"
    || !Number.isSafeInteger(value.amount)
    || value.amount !== expectedAmount
    || typeof value.response_code !== "number"
    || !Number.isSafeInteger(value.response_code)
    || typeof value.status !== "string"
  ) return "payment_review";

  if (value.response_code === 0 && value.status === "AUTHORIZED") return "authorized";
  if (value.response_code !== 0 && value.status !== "AUTHORIZED") return "rejected";
  return "payment_review";
};
