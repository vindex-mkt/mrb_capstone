import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyMallTransactionStatus,
  validateMallCommitResponse,
} from "./payment-validation.ts";

const firstExpected = {
  amount: 10000,
  commerceCode: "597055555536",
  buyOrder: "Cchild-order-1",
};
const secondExpected = {
  amount: 20000,
  commerceCode: "597055555537",
  buyOrder: "Cchild-order-2",
};
const expected = {
  mallBuyOrder: "Mmall-order",
  details: [firstExpected, secondExpected],
};

const child = (expectedDetail: typeof firstExpected, overrides: Record<string, unknown> = {}) => ({
  amount: expectedDetail.amount,
  commerce_code: expectedDetail.commerceCode,
  buy_order: expectedDetail.buyOrder,
  status: "AUTHORIZED",
  response_code: 0,
  authorization_code: "TEST01",
  ...overrides,
});

test("accepts details only when each expected merchant and amount match", () => {
  const result = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    transaction_date: "2026-11-05T20:00:00Z",
    details: [child(firstExpected), child(secondExpected)],
  });

  assert.equal(result.results.length, 2);
  assert.equal(result.results.every((detail) => !detail.verification_error), true);
  assert.equal(result.results.every((detail) => detail.response_code === 0), true);
});

test("retains a rejected child independently from an authorized child", () => {
  const result = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    transaction_date: "2026-11-05T20:00:00Z",
    details: [child(firstExpected), child(secondExpected, { status: "FAILED", response_code: -1 })],
  });

  assert.equal(result.results[0]?.status, "AUTHORIZED");
  assert.equal(result.results[1]?.status, "FAILED");
  assert.equal(result.results[1]?.response_code, -1);
});

test("flags incorrect child amounts, commerce codes, and Mall orders for review", () => {
  const result = validateMallCommitResponse(expected, {
    buy_order: "another-order",
    details: [
      child(firstExpected, { amount: 9999, commerce_code: "597055555537" }),
      child(secondExpected),
    ],
  });

  assert.equal(result.results.every((detail) => detail.verification_error), true);
});

test("flags missing or unexpected subtransactions instead of treating the payment as complete", () => {
  const missing = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    details: [child(firstExpected)],
  });
  const unexpected = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    details: [
      child(firstExpected),
      child(secondExpected),
      child(secondExpected, { buy_order: "unexpected" }),
    ],
  });

  assert.equal(missing.results[1]?.verification_error, true);
  assert.equal(unexpected.results.every((detail) => detail.verification_error), true);
});

test("classifies only verified, terminal Mall status responses as retryable", () => {
  const authorized = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    details: [child(firstExpected), child(secondExpected)],
  });
  const declined = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    details: [
      child(firstExpected, { status: "FAILED", response_code: -1 }),
      child(secondExpected, { status: "REJECTED", response_code: 5 }),
    ],
  });
  const initialized = validateMallCommitResponse(expected, {
    buy_order: expected.mallBuyOrder,
    details: [
      child(firstExpected, { status: "INITIALIZED", response_code: null }),
      child(secondExpected, { status: "INITIALIZED", response_code: null }),
    ],
  });
  const mismatched = validateMallCommitResponse(expected, {
    buy_order: "another-order",
    details: [child(firstExpected), child(secondExpected)],
  });

  assert.equal(classifyMallTransactionStatus(authorized.results), "authorized");
  assert.equal(classifyMallTransactionStatus(declined.results), "rejected");
  assert.equal(classifyMallTransactionStatus(initialized.results), "not_authorized");
  assert.equal(classifyMallTransactionStatus(mismatched.results), "unresolved");
});
