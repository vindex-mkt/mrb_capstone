const AUCTION_BID_INCREMENT_TIERS = [
  {
    maximumAmount: 50_000,
    numerator: 1,
    denominator: 100,
    roundingUnit: 100,
    minimum: 100,
  },
  {
    maximumAmount: 250_000,
    numerator: 8,
    denominator: 1_000,
    roundingUnit: 500,
    minimum: 500,
  },
  {
    maximumAmount: 1_000_000,
    numerator: 5,
    denominator: 1_000,
    roundingUnit: 1_000,
    minimum: 1_000,
  },
  {
    maximumAmount: 3_000_000,
    numerator: 3,
    denominator: 1_000,
    roundingUnit: 1_000,
    minimum: 3_000,
  },
  {
    maximumAmount: Number.POSITIVE_INFINITY,
    numerator: 2,
    denominator: 1_000,
    roundingUnit: 5_000,
    minimum: 5_000,
  },
] as const;

export function calculateAuctionBidIncrement(referenceAmount: number): number {
  if (!Number.isSafeInteger(referenceAmount)) {
    throw new RangeError(
      "El monto de referencia debe ser un entero CLP seguro.",
    );
  }

  if (referenceAmount <= 0) return 100;

  const tier = AUCTION_BID_INCREMENT_TIERS.find(
    ({ maximumAmount }) => referenceAmount <= maximumAmount,
  );
  if (!tier) {
    throw new RangeError(
      "No se pudo determinar el tramo del incremento mínimo.",
    );
  }

  const amount = BigInt(referenceAmount) * BigInt(tier.numerator);
  const divisor = BigInt(tier.denominator) * BigInt(tier.roundingUnit);
  const roundedUnits = (amount + divisor - BigInt(1)) / divisor;
  const increment = Number(roundedUnits * BigInt(tier.roundingUnit));

  if (!Number.isSafeInteger(increment)) {
    throw new RangeError("El incremento mínimo excede el monto CLP seguro.");
  }

  return Math.max(tier.minimum, increment);
}
