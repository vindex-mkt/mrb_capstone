export const FINANCIAL_RATES = {
  vindexCommissionBasisPoints: 500,
  operationalCostPerSideBasisPoints: 170,
  vatBasisPoints: 1_900,
  splitBasisPoints: 5_000,
} as const;

export type FinancialLineInput = {
  unitPrice: number;
  quantity: number;
  merchantKey?: string;
};

export type FinancialLine = {
  merchantKey: string | null;
  subtotal: number;
  vindexCommissionGross: number;
  sellerVindexCommission: number;
  buyerVindexCommission: number;
  operationalCostsGross: number;
  sellerOperationalCost: number;
  buyerOperationalCost: number;
  sellerNetEstimate: number;
};

export type MarketplaceFinancials = {
  lines: FinancialLine[];
  salesGross: number;
  vindexCommissionGross: number;
  sellerVindexCommission: number;
  buyerVindexCommission: number;
  operationalCostsGross: number;
  sellerOperationalCost: number;
  buyerOperationalCost: number;
  buyerTotal: number;
  vindexVatEstimate: number;
  vindexNetAfterVatEstimate: number;
  sellerNetEstimate: number;
};

function assertSafeAmount(amount: number, message: string) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new RangeError(message);
  return amount;
}

function addAmounts(left: number, right: number) {
  return assertSafeAmount(
    left + right,
    "El total financiero excede el monto CLP seguro.",
  );
}

function calculateRoundedRate(amount: number, basisPoints: number) {
  const numerator = BigInt(amount) * BigInt(basisPoints);
  const rounded = (numerator + BigInt(5_000)) / BigInt(10_000);
  const result = Number(rounded);
  return assertSafeAmount(
    result,
    "El monto financiero excede el monto CLP seguro.",
  );
}

function splitCommission(amount: number) {
  const buyerShare = calculateRoundedRate(
    amount,
    FINANCIAL_RATES.splitBasisPoints,
  );
  return {
    buyerShare,
    sellerShare: amount - buyerShare,
  };
}

export function calculateMarketplaceFinancials(
  inputs: readonly FinancialLineInput[],
): MarketplaceFinancials {
  const lines = inputs.map(({ unitPrice, quantity, merchantKey }) => {
    assertSafeAmount(
      unitPrice,
      "Las líneas deben tener precio CLP entero y no negativo.",
    );
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new RangeError(
        "Las líneas deben tener una cantidad entera positiva.",
      );
    }

    const subtotal = assertSafeAmount(
      unitPrice * quantity,
      "El subtotal de una línea excede el monto CLP seguro.",
    );
    const vindexCommissionGross = calculateRoundedRate(
      subtotal,
      FINANCIAL_RATES.vindexCommissionBasisPoints,
    );
    const vindexSplit = splitCommission(vindexCommissionGross);
    const sellerOperationalCost = calculateRoundedRate(
      subtotal,
      FINANCIAL_RATES.operationalCostPerSideBasisPoints,
    );
    const buyerOperationalCost = calculateRoundedRate(
      subtotal,
      FINANCIAL_RATES.operationalCostPerSideBasisPoints,
    );

    return {
      merchantKey: merchantKey ?? null,
      subtotal,
      vindexCommissionGross,
      sellerVindexCommission: vindexSplit.sellerShare,
      buyerVindexCommission: vindexSplit.buyerShare,
      operationalCostsGross: addAmounts(
        sellerOperationalCost,
        buyerOperationalCost,
      ),
      sellerOperationalCost,
      buyerOperationalCost,
      sellerNetEstimate:
        subtotal - vindexSplit.sellerShare - sellerOperationalCost,
    };
  });

  const totals = lines.reduce<MarketplaceFinancials>(
    (result, line) => ({
      lines: result.lines,
      salesGross: addAmounts(result.salesGross, line.subtotal),
      vindexCommissionGross: addAmounts(
        result.vindexCommissionGross,
        line.vindexCommissionGross,
      ),
      sellerVindexCommission: addAmounts(
        result.sellerVindexCommission,
        line.sellerVindexCommission,
      ),
      buyerVindexCommission: addAmounts(
        result.buyerVindexCommission,
        line.buyerVindexCommission,
      ),
      operationalCostsGross: addAmounts(
        result.operationalCostsGross,
        line.operationalCostsGross,
      ),
      sellerOperationalCost: addAmounts(
        result.sellerOperationalCost,
        line.sellerOperationalCost,
      ),
      buyerOperationalCost: addAmounts(
        result.buyerOperationalCost,
        line.buyerOperationalCost,
      ),
      buyerTotal: result.buyerTotal,
      vindexVatEstimate: result.vindexVatEstimate,
      vindexNetAfterVatEstimate: result.vindexNetAfterVatEstimate,
      sellerNetEstimate: addAmounts(
        result.sellerNetEstimate,
        line.sellerNetEstimate,
      ),
    }),
    {
      lines,
      salesGross: 0,
      vindexCommissionGross: 0,
      sellerVindexCommission: 0,
      buyerVindexCommission: 0,
      operationalCostsGross: 0,
      sellerOperationalCost: 0,
      buyerOperationalCost: 0,
      buyerTotal: 0,
      vindexVatEstimate: 0,
      vindexNetAfterVatEstimate: 0,
      sellerNetEstimate: 0,
    },
  );

  totals.vindexVatEstimate = calculateRoundedRate(
    totals.vindexCommissionGross,
    FINANCIAL_RATES.vatBasisPoints,
  );
  totals.vindexNetAfterVatEstimate =
    totals.vindexCommissionGross - totals.vindexVatEstimate;
  totals.buyerTotal = addAmounts(
    totals.salesGross,
    addAmounts(totals.buyerVindexCommission, totals.buyerOperationalCost),
  );

  return totals;
}

export function calculateBuyerTotal(
  financials: MarketplaceFinancials,
  shippingCost = 0,
) {
  assertSafeAmount(
    shippingCost,
    "El costo de envío debe ser un monto CLP entero no negativo.",
  );
  return addAmounts(financials.buyerTotal, shippingCost);
}
