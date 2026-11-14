import assert from "node:assert/strict";
import test from "node:test";
import { calculateSellerCommission } from "./commission.ts";

test("calculates 5 percent on product subtotal with CLP rounding", () => {
  assert.equal(calculateSellerCommission([{ unitPrice: 100_000, quantity: 1 }]), 5_000);
  assert.equal(calculateSellerCommission([{ unitPrice: 1_001, quantity: 1 }]), 50);
  assert.equal(calculateSellerCommission([{ unitPrice: 110, quantity: 1 }, { unitPrice: 110, quantity: 1 }]), 12);
  assert.equal(calculateSellerCommission([]), 0);
});

test("rejects fractional, negative and unsafe CLP subtotals", () => {
  assert.throws(() => calculateSellerCommission([{ unitPrice: 1.5, quantity: 1 }]), RangeError);
  assert.throws(() => calculateSellerCommission([{ unitPrice: -1, quantity: 1 }]), RangeError);
  assert.throws(() => calculateSellerCommission([{ unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 }]), RangeError);
});
