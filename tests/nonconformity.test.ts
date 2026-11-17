import assert from "node:assert/strict";
import test from "node:test";
import {
  canUserValidateNonconformity,
  getUpcomingNonconformities,
  isOpenNonconformity,
  nextNonconformityStatus,
  nonconformityConditionLabel,
  nonconformityStatusLabel,
} from "../src/lib/nonconformity.ts";

const issue = (
  id: string,
  dueDate: string | null,
  status: "open" | "in_progress" | "awaiting_validation" | "validated" = "open",
) => ({
  id,
  inspection_id: "inspection-1",
  inspection_item_id: null,
  property_id: "property-1",
  title: id,
  description: null,
  source_condition: "attention" as const,
  severity: "medium" as const,
  status,
  assigned_to: null,
  due_date: dueDate,
  resolved_at: null,
  validated_at: null,
  validated_by: null,
  created_at: `2026-10-${id.padStart(2, "0")}T12:00:00Z`,
  updated_at: "2026-10-01T12:00:00Z",
});

test("permite validação somente ao responsável pela vistoria", () => {
  const inspections = [{ id: "inspection-1", inspector_id: "user-responsible" }];
  assert.equal(canUserValidateNonconformity("inspection-1", inspections, "user-responsible"), true);
  assert.equal(canUserValidateNonconformity("inspection-1", inspections, "user-manager"), false);
  assert.equal(canUserValidateNonconformity("inspection-missing", inspections, "user-responsible"), false);
});

test("mantém aberta pendência até validação", () => {
  assert.equal(isOpenNonconformity("open"), true);
  assert.equal(isOpenNonconformity("in_progress"), true);
  assert.equal(isOpenNonconformity("awaiting_validation"), true);
  assert.equal(isOpenNonconformity("validated"), false);
});

test("define fluxo progressivo de correção", () => {
  assert.deepEqual(nextNonconformityStatus("open", false), { status: "in_progress", label: "Iniciar correção" });
  assert.deepEqual(nextNonconformityStatus("in_progress", false), { status: "awaiting_validation", label: "Enviar para validação" });
  assert.equal(nextNonconformityStatus("awaiting_validation", false), null);
  assert.deepEqual(nextNonconformityStatus("awaiting_validation", true), { status: "validated", label: "Validar correção" });
});

test("traduz condição e status", () => {
  assert.equal(nonconformityConditionLabel("non_compliant"), "Não conforme");
  assert.equal(nonconformityStatusLabel("awaiting_validation"), "Aguardando validação");
});

test("seleciona somente as três pendências com prazo mais próximo", () => {
  const result = getUpcomingNonconformities([
    issue("1", "2026-10-25"),
    issue("2", "2026-10-20"),
    issue("3", null),
    issue("4", "2026-10-21"),
    issue("5", "2026-10-19", "validated"),
    issue("6", "2026-10-22"),
  ]);

  assert.deepEqual(result.map((item) => item.id), ["2", "4", "6"]);
});
