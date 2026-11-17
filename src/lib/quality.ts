export type ItemCondition = "conforme" | "atencao" | "nao_conforme";

export type InspectionItemInput = {
  condition: ItemCondition;
  weight?: number;
};

const CONDITION_VALUE: Record<ItemCondition, number> = {
  conforme: 100,
  atencao: 65,
  nao_conforme: 20,
};

export function calculateQualityScore(items: InspectionItemInput[]): number {
  if (items.length === 0) return 0;

  const totals = items.reduce(
    (result, item) => {
      const weight = item.weight ?? 1;
      result.points += CONDITION_VALUE[item.condition] * weight;
      result.weight += weight;
      return result;
    },
    { points: 0, weight: 0 },
  );

  return totals.weight === 0 ? 0 : Math.round(totals.points / totals.weight);
}

export function qualityLevel(score: number) {
  if (score >= 90) return "Excelente";
  if (score >= 75) return "Bom";
  if (score >= 60) return "Atenção";
  return "Crítico";
}

export function isInspectionPayloadValid(payload: unknown): payload is {
  propertyId: string;
  type: "entrada" | "periodica" | "saida";
  items: InspectionItemInput[];
} {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.propertyId === "string" &&
    ["entrada", "periodica", "saida"].includes(String(candidate.type)) &&
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        ["conforme", "atencao", "nao_conforme"].includes(
          String((item as Record<string, unknown>).condition),
        ),
    )
  );
}
