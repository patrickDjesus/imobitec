import type { InspectionRecord } from "@/lib/inspection";
import { isOpenNonconformity, type NonconformityRecord } from "@/lib/nonconformity";
import type { PropertyRecord } from "@/lib/property";

export type DashboardMetrics = {
  activeProperties: number;
  averageQuality: number | null;
  completedInspections: number;
  inspectionsThisMonth: number;
  openIssues: number;
  attentionIssues: number;
  nonCompliantIssues: number;
  averageResolutionDays: number | null;
};

export function calculateDashboardMetrics(
  properties: ReadonlyArray<PropertyRecord>,
  inspections: ReadonlyArray<InspectionRecord>,
  issues: ReadonlyArray<NonconformityRecord>,
  now = new Date(),
): DashboardMetrics {
  const scoredInspections = inspections.filter((inspection) => inspection.status === "completed" && inspection.quality_score !== null);
  const averageQuality = scoredInspections.length
    ? Math.round(scoredInspections.reduce((total, inspection) => total + Number(inspection.quality_score), 0) / scoredInspections.length)
    : null;
  const inspectionsThisMonth = inspections.filter((inspection) => {
    const scheduledAt = new Date(inspection.scheduled_at);
    return scheduledAt.getFullYear() === now.getFullYear() && scheduledAt.getMonth() === now.getMonth();
  }).length;
  const openIssues = issues.filter((issue) => isOpenNonconformity(issue.status));
  const resolvedDurations = issues
    .filter((issue) => issue.status === "validated" && issue.resolved_at)
    .map((issue) => Math.max(0, new Date(issue.resolved_at as string).getTime() - new Date(issue.created_at).getTime()));

  return {
    activeProperties: properties.filter((property) => property.status === "active").length,
    averageQuality,
    completedInspections: inspections.filter((inspection) => inspection.status === "completed").length,
    inspectionsThisMonth,
    openIssues: openIssues.length,
    attentionIssues: openIssues.filter((issue) => issue.source_condition === "attention").length,
    nonCompliantIssues: openIssues.filter((issue) => issue.source_condition === "non_compliant").length,
    averageResolutionDays: resolvedDurations.length
      ? Math.round(resolvedDurations.reduce((total, duration) => total + duration, 0) / resolvedDurations.length / 86_400_000)
      : null,
  };
}
