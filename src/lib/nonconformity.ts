export type NonconformitySeverity = "low" | "medium" | "high" | "critical";

export type NonconformityStatus = "open" | "in_progress" | "awaiting_validation" | "validated" | "cancelled";

export type NonconformitySourceCondition = "attention" | "non_compliant";

export type NonconformityRecord = {
  id: string;
  inspection_id: string;
  inspection_item_id: string | null;
  property_id: string;
  title: string;
  description: string | null;
  source_condition: NonconformitySourceCondition;
  severity: NonconformitySeverity;
  status: NonconformityStatus;
  assigned_to: string | null;
  due_date: string | null;
  resolved_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
};

export const OPEN_NONCONFORMITY_STATUSES: ReadonlyArray<NonconformityStatus> = [
  "open",
  "in_progress",
  "awaiting_validation",
];

export function nonconformityStatusLabel(status: NonconformityStatus) {
  return {
    open: "Aberta",
    in_progress: "Em correção",
    awaiting_validation: "Aguardando validação",
    validated: "Validada",
    cancelled: "Cancelada",
  }[status];
}

export function nonconformitySeverityLabel(severity: NonconformitySeverity) {
  return {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  }[severity];
}

export function nonconformityConditionLabel(condition: NonconformitySourceCondition) {
  return condition === "attention" ? "Atenção" : "Não conforme";
}

export function isOpenNonconformity(status: NonconformityStatus) {
  return OPEN_NONCONFORMITY_STATUSES.includes(status);
}

export function getUpcomingNonconformities(
  issues: ReadonlyArray<NonconformityRecord>,
  limit = 3,
) {
  return issues
    .filter((issue) => isOpenNonconformity(issue.status))
    .toSorted((first, second) => {
      const dueDateComparison = (first.due_date ?? "9999-12-31")
        .localeCompare(second.due_date ?? "9999-12-31");
      return dueDateComparison || first.created_at.localeCompare(second.created_at);
    })
    .slice(0, Math.max(0, limit));
}

export function nextNonconformityStatus(status: NonconformityStatus, canValidate: boolean) {
  if (status === "open") return { status: "in_progress" as const, label: "Iniciar correção" };
  if (status === "in_progress") return { status: "awaiting_validation" as const, label: "Enviar para validação" };
  if (status === "awaiting_validation" && canValidate) return { status: "validated" as const, label: "Validar correção" };
  return null;
}

export function canUserValidateNonconformity(
  inspectionId: string,
  inspections: ReadonlyArray<{ id: string; inspector_id: string }>,
  currentUserId: string,
) {
  return inspections.some((inspection) =>
    inspection.id === inspectionId && inspection.inspector_id === currentUserId,
  );
}
