import assert from "node:assert/strict";
import test from "node:test";
import { findDemoLoginAccount, parseDemoLoginAccounts } from "./demo-login.ts";

test("finds the configured account for a QR code", () => {
  const configuration = JSON.stringify([
    { code: "demo1", email: "demo1@example.com" },
    { code: "demo2", email: "demo2@example.com" },
  ]);

  assert.deepEqual(findDemoLoginAccount("demo1", configuration), {
    code: "demo1",
    email: "demo1@example.com",
  });
  assert.equal(findDemoLoginAccount("unknown", configuration), null);
});

test("rejects malformed configuration and duplicate QR codes", () => {
  assert.throws(() => parseDemoLoginAccounts("{"), /JSON válido/);
  assert.throws(
    () => parseDemoLoginAccounts(JSON.stringify([
      { code: "demo1", email: "one@example.com" },
      { code: "demo1", email: "two@example.com" },
    ])),
    /únicos/,
  );
});
