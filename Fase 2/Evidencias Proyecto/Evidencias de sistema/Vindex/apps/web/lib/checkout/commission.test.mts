import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBuyerTotal,
  calculateMarketplaceFinancials,
} from "./commission.ts";

test("calculates the expected model for one product worth CLP 100,000", () => {
  const result = calculateMarketplaceFinancials([
    { unitPrice: 100_000, quantity: 1, merchantKey: "seller:one" },
  ]);

  assert.equal(result.salesGross, 100_000);
  assert.equal(result.vindexCommissionGross, 5_000);
  assert.equal(result.sellerVindexCommission, 2_500);
  assert.equal(result.buyerVindexCommission, 2_500);
  assert.equal(result.operationalCostsGross, 3_400);
  assert.equal(result.sellerOperationalCost, 1_700);
  assert.equal(result.buyerOperationalCost, 1_700);
  assert.equal(result.vindexVatEstimate, 950);
  assert.equal(result.vindexNetAfterVatEstimate, 4_050);
  assert.equal(result.sellerNetEstimate, 95_800);
  assert.equal(result.buyerTotal, 104_200);
  assert.equal(calculateBuyerTotal(result, 3_990), 108_190);
});

test("calculates both merchants independently for products worth CLP 60,000 and CLP 40,000", () => {
  const result = calculateMarketplaceFinancials([
    { unitPrice: 60_000, quantity: 1, merchantKey: "seller:a" },
    { unitPrice: 40_000, quantity: 1, merchantKey: "store:2" },
  ]);

  assert.deepEqual(
    result.lines.map(({ sellerNetEstimate }) => sellerNetEstimate),
    [57_480, 38_320],
  );
  assert.equal(result.salesGross, 100_000);
  assert.equal(result.vindexCommissionGross, 5_000);
  assert.equal(result.vindexVatEstimate, 950);
  assert.equal(result.vindexNetAfterVatEstimate, 4_050);
  assert.equal(result.buyerTotal, 104_200);
});

test("aggregates multiple products from one store and a private seller", () => {
  const sameStore = calculateMarketplaceFinancials([
    { unitPrice: 30_000, quantity: 2, merchantKey: "store:4" },
    { unitPrice: 40_000, quantity: 1, merchantKey: "store:4" },
  ]);
  const privateSeller = calculateMarketplaceFinancials([
    { unitPrice: 100_000, quantity: 1, merchantKey: "seller:private" },
  ]);

  assert.equal(sameStore.lines.length, 2);
  assert.equal(
    sameStore.lines.every(({ merchantKey }) => merchantKey === "store:4"),
    true,
  );
  assert.equal(sameStore.salesGross, 100_000);
  assert.equal(sameStore.sellerNetEstimate, 95_800);
  assert.equal(privateSeller.lines[0]?.merchantKey, "seller:private");
  assert.equal(privateSeller.sellerNetEstimate, 95_800);
});

test("rounds each commission to whole CLP and balances odd amounts between both parties", () => {
  const result = calculateMarketplaceFinancials([
    { unitPrice: 1_001, quantity: 1 },
  ]);
  const line = result.lines[0];

  assert.equal(line?.vindexCommissionGross, 50);
  assert.equal(line?.buyerVindexCommission, 25);
  assert.equal(line?.sellerVindexCommission, 25);
  assert.equal(line?.operationalCostsGross, 34);
  assert.equal(line?.buyerOperationalCost, 17);
  assert.equal(line?.sellerOperationalCost, 17);
  assert.equal(result.buyerTotal, 1_043);
  assert.equal(
    result.salesGross +
      result.buyerVindexCommission +
      result.buyerOperationalCost,
    result.buyerTotal,
  );
  assert.equal(
    result.sellerVindexCommission + result.buyerVindexCommission,
    result.vindexCommissionGross,
  );
  assert.equal(
    result.sellerOperationalCost + result.buyerOperationalCost,
    result.operationalCostsGross,
  );
});

test("the Vindex VAT is paid from Vindex revenue and never shifts the buyer or seller amounts", () => {
  const result = calculateMarketplaceFinancials([
    { unitPrice: 60_000, quantity: 1 },
    { unitPrice: 40_000, quantity: 1 },
  ]);

  assert.equal(result.sellerNetEstimate, 57_480 + 38_320);
  assert.equal(
    result.salesGross +
      result.buyerVindexCommission +
      result.buyerOperationalCost,
    104_200,
  );
  assert.equal(result.vindexCommissionGross - result.vindexVatEstimate, 4_050);
});

test("rejects fractional, negative and unsafe CLP line amounts", () => {
  assert.throws(
    () => calculateMarketplaceFinancials([{ unitPrice: 1.5, quantity: 1 }]),
    RangeError,
  );
  assert.throws(
    () => calculateMarketplaceFinancials([{ unitPrice: -1, quantity: 1 }]),
    RangeError,
  );
  assert.throws(
    () =>
      calculateMarketplaceFinancials([
        { unitPrice: Number.MAX_SAFE_INTEGER, quantity: 2 },
      ]),
    RangeError,
  );
});
