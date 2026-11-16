const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ExpectedMallTransaction = {
  mallBuyOrder: string;
  details: {
    amount: number;
    commerceCode: string;
    buyOrder: string;
  }[];
};

export type ValidatedMallDetail = {
  expected_buy_order: string;
  returned_buy_order: string | null;
  returned_commerce_code: string | null;
  returned_amount: number | null;
  status: string | null;
  response_code: number | null;
  authorization_code: string | null;
  authorized_at: string | null;
  mall_order_matches: boolean;
  verification_error: boolean;
};

export type MallTransactionStatusClassification =
  | "authorized"
  | "rejected"
  | "not_authorized"
  | "unresolved";

export const classifyMallTransactionStatus = (
  details: readonly ValidatedMallDetail[],
): MallTransactionStatusClassification => {
  if (details.length === 0 || details.some((detail) => detail.verification_error)) {
    return "unresolved";
  }
  if (details.some((detail) => detail.status === "AUTHORIZED" && detail.response_code === 0)) {
    return "authorized";
  }
  if (details.every((detail) =>
    ["FAILED", "REJECTED"].includes(detail.status ?? "")
    && detail.response_code !== null
    && detail.response_code !== 0
  )) {
    return "rejected";
  }
  if (details.every((detail) => detail.status === "INITIALIZED")) {
    return "not_authorized";
  }
  return "unresolved";
};

const asString = (value: unknown) => typeof value === "string" ? value : null;
const asInteger = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null;

const asIsoDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const validateMallCommitResponse = (
  expected: ExpectedMallTransaction,
  response: unknown,
) => {
  const payload = isRecord(response) ? response : null;
  const returnedMallOrder = asString(payload?.buy_order);
  const details = Array.isArray(payload?.details) ? payload.details : [];
  const mallOrderMatches =
    returnedMallOrder === expected.mallBuyOrder && details.length === expected.details.length;
  const usedDetails = new Set<number>();

  const results: ValidatedMallDetail[] = expected.details.map((expectedDetail) => {
    const matchingIndex = details.findIndex((detail, index) => {
      if (usedDetails.has(index) || !isRecord(detail)) return false;
      return detail.buy_order === expectedDetail.buyOrder;
    });

    if (matchingIndex < 0 || !isRecord(details[matchingIndex])) {
      return {
        expected_buy_order: expectedDetail.buyOrder,
        returned_buy_order: null,
        returned_commerce_code: null,
        returned_amount: null,
        status: null,
        response_code: null,
        authorization_code: null,
        authorized_at: null,
        mall_order_matches: mallOrderMatches,
        verification_error: true,
      };
    }

    usedDetails.add(matchingIndex);
    const detail = details[matchingIndex] as Record<string, unknown>;
    const returnedBuyOrder = asString(detail.buy_order);
    const returnedCommerceCode = asString(detail.commerce_code);
    const returnedAmount = asInteger(detail.amount);

    return {
      expected_buy_order: expectedDetail.buyOrder,
      returned_buy_order: returnedBuyOrder,
      returned_commerce_code: returnedCommerceCode,
      returned_amount: returnedAmount,
      status: asString(detail.status),
      response_code: asInteger(detail.response_code),
      authorization_code: asString(detail.authorization_code),
      authorized_at: asIsoDate(payload?.transaction_date),
      mall_order_matches: mallOrderMatches,
      verification_error:
        !mallOrderMatches
        || returnedBuyOrder !== expectedDetail.buyOrder
        || returnedCommerceCode !== expectedDetail.commerceCode
        || returnedAmount !== expectedDetail.amount,
    };
  });

  return { results, rawResponse: response };
};
