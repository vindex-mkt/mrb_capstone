import assert from "node:assert/strict";
import test from "node:test";
import { isPendingPaymentExpired, PENDING_PAYMENT_MAX_AGE_MS } from "./pending-payment-expiration.ts";

test("pending payments expire at five minutes", () => {
  const createdAt = "2026-11-13T12:00:00.000Z";
  const createdAtMs = Date.parse(createdAt);

  assert.equal(isPendingPaymentExpired(createdAt, createdAtMs + PENDING_PAYMENT_MAX_AGE_MS - 1), false);
  assert.equal(isPendingPaymentExpired(createdAt, createdAtMs + PENDING_PAYMENT_MAX_AGE_MS), true);
});

test("invalid or future creation times are not treated as expired", () => {
  assert.equal(isPendingPaymentExpired("invalid", Date.now() + PENDING_PAYMENT_MAX_AGE_MS), false);
  assert.equal(isPendingPaymentExpired("2026-11-13T12:01:00.000Z", Date.parse("2026-11-13T12:00:00.000Z")), false);
});
