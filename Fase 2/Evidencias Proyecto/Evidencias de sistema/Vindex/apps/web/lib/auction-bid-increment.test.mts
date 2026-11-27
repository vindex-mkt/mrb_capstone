import assert from "node:assert/strict";
import test from "node:test";
import { calculateAuctionBidIncrement } from "./auction-bid-increment.ts";
import {
  getAuctionBidLimits,
  getAuctionGuaranteeAmount,
} from "./product-utils.ts";

test("uses the minimum CLP increment for non-positive reference amounts", () => {
  assert.equal(calculateAuctionBidIncrement(0), 100);
  assert.equal(calculateAuctionBidIncrement(-1), 100);
});

test("rounds up within each reference amount tier", () => {
  const cases = [
    [1, 100],
    [50_000, 500],
    [50_001, 500],
    [250_000, 2_000],
    [250_001, 2_000],
    [1_000_000, 5_000],
    [1_000_001, 4_000],
    [3_000_000, 9_000],
    [3_000_001, 10_000],
  ] as const;

  for (const [amount, expectedIncrement] of cases) {
    assert.equal(calculateAuctionBidIncrement(amount), expectedIncrement);
  }
});

test("rejects fractional and unsafe reference amounts", () => {
  assert.throws(() => calculateAuctionBidIncrement(1.5), RangeError);
  assert.throws(
    () => calculateAuctionBidIncrement(Number.MAX_SAFE_INTEGER + 1),
    RangeError,
  );
});

test("keeps the minimum required bid available when the 50% cap is lower", () => {
  const limits = getAuctionBidLimits({
    starting_price: 100,
    current_bid: 100,
    bid_increment: 100,
  });

  assert.deepEqual(limits, { minimum: 200, maximum: 200 });
});

test("allows a seller-selected increment above the calculated minimum", () => {
  const limits = getAuctionBidLimits({
    starting_price: 100_000,
    current_bid: 100_000,
    bid_increment: 2_000,
  });

  assert.deepEqual(limits, { minimum: 102_000, maximum: 150_000 });
});

test("calculates the 10% auction guarantee from the starting price", () => {
  assert.equal(getAuctionGuaranteeAmount(100_000), 10_000);
  assert.equal(getAuctionGuaranteeAmount(1), 1);
});

test("rejects invalid auction starting prices for guarantee calculation", () => {
  assert.equal(getAuctionGuaranteeAmount(null), null);
  assert.equal(getAuctionGuaranteeAmount(0), null);
  assert.equal(getAuctionGuaranteeAmount(1.5), null);
});
