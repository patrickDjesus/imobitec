import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScheduledAt,
  countInspectionEnvironmentType,
  filterInspectionProperties,
  formatDateInput,
  formatTimeInput,
  inspectionStatusLabel,
  inspectionEnvironmentTypesForClassification,
  inspectionTypeLabel,
  nextInspectionEnvironmentName,
} from "../src/lib/inspection.ts";

test("formata data brasileira durante digitação", () => {
  assert.equal(formatDateInput("17102026"), "17/10/2026");
  assert.equal(formatDateInput("17/10/20a26"), "17/10/2026");
});

test("formata horário durante digitação", () => {
  assert.equal(formatTimeInput("0930"), "09:30");
  assert.equal(formatTimeInput("09:3a0"), "09:30");
});

test("rejeita data e horário impossíveis", () => {
  assert.equal(buildScheduledAt("31/02/2026", "10:00"), null);
  assert.equal(buildScheduledAt("17/10/2026", "24:00"), null);
});

test("aceita agendamento válido", () => {
  assert.ok(buildScheduledAt("17/10/2026", "09:30"));
});

test("traduz tipo e status da vistoria", () => {
  assert.equal(inspectionTypeLabel("maintenance"), "Manutenção");
  assert.equal(inspectionStatusLabel("in_progress"), "Em Andamento");
});

test("separa ambientes residenciais e comerciais", () => {
  const residential = inspectionEnvironmentTypesForClassification("residential").map(([value]) => value);
  const commercial = inspectionEnvironmentTypesForClassification("commercial").map(([value]) => value);

  assert.ok(residential.includes("bedroom"));
  assert.ok(!residential.includes("reception"));
  assert.ok(commercial.includes("reception"));
  assert.ok(commercial.includes("warehouse"));
  assert.ok(!commercial.includes("bedroom"));
});

test("filtra imóveis por ID, título e endereço ignorando acentos", () => {
  const properties = [
    { property_number: 12, name: "Apartamento Centro", postal_code: "01001000", address_line: "Praça da Sé", district: "Sé", city: "São Paulo", state: "SP" },
    { property_number: 25, name: "Galpão Industrial", postal_code: "30110000", address_line: "Avenida Afonso Pena", district: "Centro", city: "Belo Horizonte", state: "MG" },
  ];

  assert.deepEqual(filterInspectionProperties(properties, "#12"), [properties[0]]);
  assert.deepEqual(filterInspectionProperties(properties, "praca da se"), [properties[0]]);
  assert.deepEqual(filterInspectionProperties(properties, "galpao"), [properties[1]]);
});

test("conta tipos e gera primeiro nome disponível", () => {
  const environments = [
    { type: "bedroom" as const, name: "Quarto 1" },
    { type: "bedroom" as const, name: "Quarto 3" },
    { type: "kitchen" as const, name: "Cozinha 1" },
  ];
  assert.equal(countInspectionEnvironmentType(environments, "bedroom"), 2);
  assert.equal(nextInspectionEnvironmentName(environments, "bedroom"), "Quarto 2");
});
