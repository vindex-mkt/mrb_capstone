import assert from "node:assert/strict";
import test from "node:test";
import { getFinancePeriodRange } from "./finance-period.ts";

const chileDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

test("builds day, month and year windows using the Chilean calendar", () => {
  const now = new Date("2025-03-01T02:30:00.000Z");
  const day = getFinancePeriodRange("day", now);
  const month = getFinancePeriodRange("month", now);
  const year = getFinancePeriodRange("year", now);

  assert.equal(chileDate.format(new Date(day.start)), "2025-02-28");
  assert.equal(chileDate.format(new Date(day.end)), "2025-03-01");
  assert.equal(chileDate.format(new Date(month.start)), "2025-02-01");
  assert.equal(chileDate.format(new Date(month.end)), "2025-03-01");
  assert.equal(chileDate.format(new Date(year.start)), "2025-01-01");
  assert.equal(chileDate.format(new Date(year.end)), "2026-01-01");
});
