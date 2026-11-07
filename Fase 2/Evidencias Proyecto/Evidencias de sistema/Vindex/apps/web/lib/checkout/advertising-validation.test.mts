import assert from "node:assert/strict";
import test from "node:test";
import { validateAdvertisingCommitResponse } from "./advertising-validation.ts";

const expectedBuyOrder = "Atest-order";
const expectedAmount = 9990;

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
