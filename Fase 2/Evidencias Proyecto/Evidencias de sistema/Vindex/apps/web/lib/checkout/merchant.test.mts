import assert from "node:assert/strict";
import test from "node:test";
import { canAddMerchantToCart, getMerchantKey } from "./merchant.ts";

test("allows multiple items from one store and a second store", () => {
  const cart = [
    { store_id: 15, seller_id: "owner-a" },
    { store_id: 15, seller_id: "owner-a" },
  ];

  assert.equal(canAddMerchantToCart(cart, { store_id: 24, seller_id: "owner-b" }), true);
});

test("counts stores and personal sellers as separate commerce identities", () => {
  assert.equal(getMerchantKey({ store_id: 15, seller_id: "same-owner" }), "store:15");
  assert.equal(getMerchantKey({ store_id: null, seller_id: "same-owner" }), "seller:same-owner");
  assert.equal(getMerchantKey({ store_id: 15, seller_id: "same-owner" }), getMerchantKey({ store_id: 15 }));
  assert.notEqual(getMerchantKey({ store_id: 15 }), getMerchantKey({ store_id: null, seller_id: "15" }));
});

test("rejects a third merchant but allows a replacement after removing one merchant", () => {
  const cart = [
    { store_id: 15, seller_id: "owner-a" },
    { store_id: null, seller_id: "owner-b" },
  ];

  assert.equal(canAddMerchantToCart(cart, { store_id: 24, seller_id: "owner-c" }), false);
  assert.equal(
    canAddMerchantToCart(cart.filter((item) => item.seller_id !== "owner-b"), { store_id: 24, seller_id: "owner-c" }),
    true,
  );
});

test("rejects items whose seller identity is missing", () => {
  assert.equal(canAddMerchantToCart([], { store_id: null, seller_id: null }), false);
  assert.equal(canAddMerchantToCart([{ store_id: null, seller_id: null }], { seller_id: "owner-a" }), false);
});
