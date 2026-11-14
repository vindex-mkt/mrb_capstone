export const COMMISSION_RATE_BASIS_POINTS = 500;

export function calculateSellerCommission(
  lines: readonly { unitPrice: number; quantity: number }[],
) {
  return lines.reduce((total, { unitPrice, quantity }) => {
    if (
      !Number.isSafeInteger(unitPrice)
      || unitPrice < 0
      || !Number.isSafeInteger(quantity)
      || quantity <= 0
    ) {
      throw new RangeError("Las líneas para calcular la comisión deben tener precio CLP entero y cantidad positiva.");
    }

    const lineSubtotal = unitPrice * quantity;
    if (!Number.isSafeInteger(lineSubtotal)) {
      throw new RangeError("El subtotal de una línea excede el monto CLP seguro.");
    }

    const lineCommission = Math.round(
      lineSubtotal / (10_000 / COMMISSION_RATE_BASIS_POINTS),
    );
    const nextTotal = total + lineCommission;
    if (!Number.isSafeInteger(nextTotal)) {
      throw new RangeError("La comisión total excede el monto CLP seguro.");
    }
    return nextTotal;
  }, 0);
}
