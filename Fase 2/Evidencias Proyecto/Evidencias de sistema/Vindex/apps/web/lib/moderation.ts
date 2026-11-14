export const MODERATION_STATUS = [
  "pending_review",
  "approved",
  "rejected",
  "flagged",
] as const;

export type ModerationStatus = (typeof MODERATION_STATUS)[number];

export const MODERATION_ACTIONS = ["approved", "rejected", "flagged", "resubmitted"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export type ProductModerationResult = {
  moderationStatus: ModerationStatus;
  reason: string | null;
  signals: Array<{
    detector: "text" | "image" | "category" | "manual";
    category: string;
    result: "matched" | "clear" | "review";
    reason: string;
    score?: number;
    detectorVersion?: string;
  }>;
};

export const RISK_KEYWORDS: Record<string, string[]> = {
  weapon: [
    "arma",
    "armas",
    "arma de fuego",
    "rifle",
    "escopeta",
    "pistola",
    "revólver",
    "fusil",
    "munición",
    "balas",
    "cartuchos",
    "cargador",
    "silenciador",
  ],
  explosive: [
    "granada",
    "explosivo",
    "explosivos",
    "dinamita",
    "c4",
    "trinitrotolueno",
    "bomba",
  ],
  controlled: [
    "droga",
    "drogas",
    "cocaina",
    "marihuana",
    "morfina",
    "opio",
    "lsd",
    "anfetaminas",
    "estupefacientes",
    "contrabando",
  ],
  violence: [
    "ataque",
    "asesinato",
    "cuchillo",
    "navaja",
    "taser",
    "gas pimienta",
    "porra",
    "armas blancas",
  ],
  counterfeit: [
    "falsificado",
    "falsificación",
    "falso",
    "réplica",
    "imitación",
    "clon",
    "pirata",
    "fake",
  ],
};

const PRIORITY_KEYWORDS = [
  "arma de fuego",
  "rifle",
  "escopeta",
  "pistola",
  "revólver",
  "fusil",
  "armas",
  "munición",
  "municiones",
  "balas",
  "cartuchos",
  "silenciador",
  "granada",
  "explosivo",
  "explosivos",
  "dinamita",
  "bomba",
  "c4",
  "trinitrotolueno",
];

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesTerm = (text: string, term: string) => {
  const escapedTerm = normalizeText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapedTerm}($|[^a-z0-9])`).test(text);
};

const toSignal = (
  detector: "text" | "image" | "category" | "manual",
  category: string,
  result: "matched" | "clear" | "review",
  reason: string,
  detectorVersion?: string,
) => ({
  detector,
  category,
  result,
  reason,
  ...(detectorVersion ? { detectorVersion } : {}),
});

export function analyzeProductTextForModeration({
  title,
  description,
  categoryName,
  tags,
}: {
  title?: string | null;
  description?: string | null;
  categoryName?: string | null;
  tags?: Array<string | null | undefined>;
}): ProductModerationResult {
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  const normalizedCategory = normalizeText(categoryName);
  const normalizedTags = (tags ?? []).map(normalizeText);
  const combinedText = [normalizedTitle, normalizedDescription, normalizedCategory, ...normalizedTags]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");

  const signals: ProductModerationResult["signals"] = [];
  const matchedKeys: string[] = [];

  for (const [category, keywords] of Object.entries(RISK_KEYWORDS)) {
    const matches = keywords.filter((keyword) => includesTerm(combinedText, keyword));
    if (matches.length > 0) {
      matchedKeys.push(category);
      signals.push(
        toSignal(
          "text",
          category,
          "matched",
          `Coincidencia en texto: ${matches.slice(0, 3).join(", ")}`,
          "text-v1",
        ),
      );
    }
  }

  if (combinedText.length === 0) {
    return {
      moderationStatus: "approved",
      reason: "No se detectaron parámetros de riesgo.",
      signals: [toSignal("text", "safe", "clear", "No se detectaron parámetros de riesgo.", "text-v1")],
    };
  }

  const isBookOrEducationalContent =
    /\b(libro|libros|novela|manual|documental|historia)\b/.test(normalizedTitle)
    || /\b(libros|literatura|educacion)\b/.test(normalizedCategory);
  const isPriorityMatch = PRIORITY_KEYWORDS.some((keyword) => includesTerm(combinedText, keyword));

  if (matchedKeys.length > 0 && !isBookOrEducationalContent) {
    return {
      moderationStatus: isPriorityMatch ? "flagged" : "pending_review",
      reason: isPriorityMatch
        ? "Se detectó un parámetro de alto riesgo; requiere revisión prioritaria."
        : "Se detectaron parámetros de riesgo que requieren revisión manual.",
      signals,
    };
  }

  return {
    moderationStatus: "approved",
    reason: "No se detectaron parámetros de riesgo.",
    signals: [toSignal("text", "safe", "clear", "No se detectaron parámetros de riesgo.", "text-v1")],
  };
}

export function isProductPubliclyVisible(product: {
  status?: boolean | string | null;
  moderation_status?: string | null;
} | null | undefined): boolean {
  return Boolean(product?.status === "active" || product?.status === true || product?.status === "true")
    && product?.moderation_status === "approved";
}
