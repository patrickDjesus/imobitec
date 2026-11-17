import assert from "node:assert/strict";
import test from "node:test";

import { calculateDashboardMetrics } from "../../src/lib/dashboard.ts";
import {
  buildScheduledAt,
  filterInspectionProperties,
  inspectionEnvironmentTypesForClassification,
  nextInspectionEnvironmentName,
} from "../../src/lib/inspection.ts";
import type { InspectionRecord } from "../../src/lib/inspection.ts";
import {
  canUserValidateNonconformity,
  nextNonconformityStatus,
} from "../../src/lib/nonconformity.ts";
import type { NonconformityRecord, NonconformityStatus } from "../../src/lib/nonconformity.ts";
import { formatPostalCode } from "../../src/lib/property.ts";
import type { PropertyRecord } from "../../src/lib/property.ts";
import { calculateQualityScore, isInspectionPayloadValid, qualityLevel } from "../../src/lib/quality.ts";

// ---------- fábricas de dados de teste ----------

const property = (id: string, status: PropertyRecord["status"] = "active"): PropertyRecord => ({
  id,
  property_number: Number(id.replace(/\D/g, "")) || 1,
  name: `Imóvel ${id}`,
  classification: "residential",
  property_type: "house",
  status,
  postal_code: "01310100",
  street_type: "avenue",
  address_line: "Paulista",
  street_number: 1000,
  no_number: false,
  complement: null,
  district: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  notes: null,
  unit_area: null,
  land_area: null,
  room_count: 3,
  created_at: "2026-09-01T12:00:00Z",
});

const inspection = (
  id: string,
  status: InspectionRecord["status"],
  scheduledAt: string,
  qualityScore: number | null,
  inspectorId = "user-responsible",
): InspectionRecord => ({
  id,
  inspection_number: 1,
  property_id: "p1",
  inspection_type: "periodic",
  scheduled_at: scheduledAt,
  inspector_id: inspectorId,
  status,
  room_count: 2,
  started_at: null,
  completed_at: null,
  quality_score: qualityScore,
  general_notes: null,
  created_at: "2026-09-01T12:00:00Z",
});

const issue = (
  id: string,
  status: NonconformityStatus,
  source: NonconformityRecord["source_condition"],
  createdAt = "2026-10-01T00:00:00Z",
  resolvedAt: string | null = null,
): NonconformityRecord => ({
  id,
  inspection_id: "i1",
  inspection_item_id: null,
  property_id: "p1",
  title: id,
  description: null,
  source_condition: source,
  severity: "medium",
  status,
  assigned_to: null,
  due_date: null,
  resolved_at: resolvedAt,
  validated_at: null,
  validated_by: null,
  created_at: createdAt,
  updated_at: createdAt,
});

// "Agora" fixo no meio do mês, para o teste não depender do dia em que roda.
const NOW = new Date(2026, 9, 15, 12, 0, 0);

// ---------- integração: dashboard (consome inspection + nonconformity + property) ----------

test("dashboard agrega imóveis, vistorias e não conformidades", () => {
  const properties = [property("p1"), property("p2"), property("p3", "archived")];

  const inspections = [
    inspection("i1", "completed", "2026-10-10T12:00:00Z", 80),
    inspection("i2", "completed", "2026-10-20T12:00:00Z", 90),
    inspection("i3", "in_progress", "2026-10-25T12:00:00Z", null),
    inspection("i4", "completed", "2026-09-15T12:00:00Z", null),
  ];

  const issues = [
    issue("n1", "open", "attention"),
    issue("n2", "in_progress", "non_compliant"),
    issue("n3", "awaiting_validation", "non_compliant"),
    issue("n4", "validated", "attention", "2026-10-01T00:00:00Z", "2026-10-05T00:00:00Z"), // 4 dias
    issue("n5", "validated", "non_compliant", "2026-10-01T00:00:00Z", "2026-10-03T00:00:00Z"), // 2 dias
    issue("n6", "cancelled", "attention"),
  ];

  const metrics = calculateDashboardMetrics(properties, inspections, issues, NOW);

  assert.equal(metrics.activeProperties, 2);
  assert.equal(metrics.completedInspections, 3);
  assert.equal(metrics.inspectionsThisMonth, 3);
  assert.equal(metrics.averageQuality, 85); // só concluídas com nota: (80 + 90) / 2
  assert.equal(metrics.openIssues, 3); // n1, n2, n3
  assert.equal(metrics.attentionIssues, 1);
  assert.equal(metrics.nonCompliantIssues, 2);
  assert.equal(metrics.averageResolutionDays, 3); // (4 + 2) / 2
});

test("dashboard sem dados devolve zeros e nulos, sem quebrar", () => {
  const metrics = calculateDashboardMetrics([], [], [], NOW);

  assert.deepEqual(metrics, {
    activeProperties: 0,
    averageQuality: null,
    completedInspections: 0,
    inspectionsThisMonth: 0,
    openIssues: 0,
    attentionIssues: 0,
    nonCompliantIssues: 0,
    averageResolutionDays: null,
  });
});

// ---------- integração: ciclo de vida da não conformidade + permissão + dashboard ----------

test("ciclo da não conformidade: só o responsável valida e o dashboard acompanha", () => {
  const inspections = [inspection("i1", "completed", "2026-10-10T12:00:00Z", 70)];
  const properties = [property("p1")];

  let current = issue("n1", "open", "non_compliant");
  assert.equal(calculateDashboardMetrics(properties, inspections, [current], NOW).openIssues, 1);

  // aberta -> em correção -> aguardando validação
  const step1 = nextNonconformityStatus(current.status, false);
  assert.equal(step1?.status, "in_progress");
  current = { ...current, status: step1!.status };

  const step2 = nextNonconformityStatus(current.status, false);
  assert.equal(step2?.status, "awaiting_validation");
  current = { ...current, status: step2!.status };

  // quem NÃO é o responsável pela vistoria não consegue validar
  const managerCanValidate = canUserValidateNonconformity(current.inspection_id, inspections, "user-manager");
  assert.equal(managerCanValidate, false);
  assert.equal(nextNonconformityStatus(current.status, managerCanValidate), null);
  assert.equal(calculateDashboardMetrics(properties, inspections, [current], NOW).openIssues, 1);

  // o responsável valida; a pendência sai da lista de abertas
  const responsibleCanValidate = canUserValidateNonconformity(current.inspection_id, inspections, "user-responsible");
  assert.equal(responsibleCanValidate, true);
  const step3 = nextNonconformityStatus(current.status, responsibleCanValidate);
  assert.equal(step3?.status, "validated");
  current = { ...current, status: step3!.status, resolved_at: "2026-10-04T00:00:00Z" };

  const metrics = calculateDashboardMetrics(properties, inspections, [current], NOW);
  assert.equal(metrics.openIssues, 0);
  assert.equal(metrics.averageResolutionDays, 3);
});

// ---------- integração: nota de qualidade + validação do payload ----------

test("vistoria válida gera nota e classificação coerentes", () => {
  const payload = {
    propertyId: "IM-001",
    type: "periodica",
    items: [
      { condition: "conforme", weight: 1 },
      { condition: "atencao", weight: 1 },
      { condition: "nao_conforme", weight: 2 },
    ],
  };

  assert.equal(isInspectionPayloadValid(payload), true);

  // (100*1 + 65*1 + 20*2) / 4 = 51,25 -> 51
  const score = calculateQualityScore(payload.items as Parameters<typeof calculateQualityScore>[0]);
  assert.equal(score, 51);
  assert.equal(qualityLevel(score), "Crítico");
});

test("payload com condição inválida é rejeitado antes de calcular nota", () => {
  const payload = { propertyId: "IM-001", type: "entrada", items: [{ condition: "otimo" }] };
  assert.equal(isInspectionPayloadValid(payload), false);
});

// ---------- integração: cadastro de imóvel + agendamento + ambientes da vistoria ----------

test("fluxo de agendamento: busca imóvel, valida data e sugere nome de ambiente", () => {
  const found = filterInspectionProperties(
    [
      { property_number: 7, name: "Casa Verde", postal_code: formatPostalCode("88701000"), address_line: "Rua Azul", district: "Centro", city: "Tubarão", state: "SC" },
      { property_number: 8, name: "Loja Centro", postal_code: "30110000", address_line: "Av. Brasil", district: "Centro", city: "Belo Horizonte", state: "MG" },
    ],
    "tubarao",
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].name, "Casa Verde");

  assert.ok(buildScheduledAt("20/10/2026", "14:30"));
  assert.equal(buildScheduledAt("31/04/2026", "14:30"), null); // abril não tem dia 31

  const types = inspectionEnvironmentTypesForClassification("residential").map(([value]) => value);
  assert.ok(types.includes("kitchen"));

  const existing = [{ type: "kitchen" as const, name: "Cozinha 1" }];
  assert.equal(nextInspectionEnvironmentName(existing, "kitchen"), "Cozinha 2");
});
