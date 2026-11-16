import assert from "node:assert/strict";
import test from "node:test";
import { featuredPlans } from "../advertising.ts";
import { validateAdvertisingCommitResponse } from "./advertising-validation.ts";

const expectedBuyOrder = "Atest-order";
const expectedAmount = 3990;

test("uses the current CLP prices for all promotion durations", () => {
  assert.deepEqual(featuredPlans, [
    { days: 1, price: 990 },
    { days: 3, price: 1990 },
    { days: 7, price: 3990 },
    { days: 14, price: 6990 },
  ]);
});

test("authorizes a promotion only when order, amount, code and status match", () => {
  assert.equal(validateAdvertisingCommitResponse({
    buy_order: expectedBuyOrder,
    amount: expectedAmount,
    response_code: 0,
    status: "AUTHORIZED",
  }, expectedBuyOrder, expectedAmount), "authorized");
});

test("keeps a correctly matched declined promotion as rejected", () => {
  assert.equal(validateAdvertisingCommitResponse({
    buy_order: expectedBuyOrder,
    amount: expectedAmount,
    response_code: -1,
    status: "FAILED",
  }, expectedBuyOrder, expectedAmount), "rejected");
});

test("requires review when Transbank returns mismatched or incomplete details", () => {
  for (const response of [
    { buy_order: "other-order", amount: expectedAmount, response_code: 0, status: "AUTHORIZED" },
    { buy_order: expectedBuyOrder, amount: expectedAmount - 1, response_code: 0, status: "AUTHORIZED" },
    { buy_order: expectedBuyOrder, amount: expectedAmount, response_code: 0, status: "FAILED" },
    { buy_order: expectedBuyOrder, amount: expectedAmount, response_code: -1, status: "AUTHORIZED" },
    null,
  ]) {
    assert.equal(validateAdvertisingCommitResponse(response, expectedBuyOrder, expectedAmount), "payment_review");
  }
});
