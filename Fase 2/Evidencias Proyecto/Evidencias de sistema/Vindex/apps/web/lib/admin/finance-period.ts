export type FinancePeriod = "day" | "month" | "year";

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

const chileDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getChileDate(date: Date): LocalDate {
  const parts = Object.fromEntries(
    chileDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getChileDateKey(date: Date) {
  const { year, month, day } = getChileDate(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getChileDayStart({ year, month, day }: LocalDate) {
  const utcNoon = Date.UTC(year, month - 1, day, 12);
  const chileNoonParts = Object.fromEntries(
    chileDateFormatter.formatToParts(new Date(utcNoon)).map(({ type, value }) => [type, value]),
  );
  const chileNoonAsUtc = Date.UTC(
    Number(chileNoonParts.year),
    Number(chileNoonParts.month) - 1,
    Number(chileNoonParts.day),
    Number(chileNoonParts.hour),
    Number(chileNoonParts.minute),
    Number(chileNoonParts.second),
  );
  const offset = chileNoonAsUtc - utcNoon;
  let timestamp = Date.UTC(year, month - 1, day) - offset;
  const targetKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  while (getChileDateKey(new Date(timestamp)) < targetKey) {
    timestamp += 60_000;
  }
  while (getChileDateKey(new Date(timestamp - 60_000)) === targetKey) {
    timestamp -= 60_000;
  }

  return new Date(timestamp);
}

export function getFinancePeriodRange(period: FinancePeriod, now = new Date()) {
  const today = getChileDate(now);
  const startDate = period === "year"
    ? { year: today.year, month: 1, day: 1 }
    : period === "month"
      ? { year: today.year, month: today.month, day: 1 }
      : today;
  const endDate = period === "year"
    ? { year: today.year + 1, month: 1, day: 1 }
    : period === "month"
      ? (today.month === 12
          ? { year: today.year + 1, month: 1, day: 1 }
          : { year: today.year, month: today.month + 1, day: 1 })
      : new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const normalizedEndDate = endDate instanceof Date
    ? { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() + 1, day: endDate.getUTCDate() }
    : endDate;

  return {
    start: getChileDayStart(startDate).toISOString(),
    end: getChileDayStart(normalizedEndDate).toISOString(),
    label: period === "day" ? "Día actual" : period === "month" ? "Mes actual" : "Año actual",
  };
}
