import assert from "node:assert/strict";
import test from "node:test";
import { calculateQualityScore, isInspectionPayloadValid, qualityLevel } from "../src/lib/quality.ts";

test("calcula 100 quando todos os itens estão conformes", () => {
  assert.equal(calculateQualityScore([{ condition: "conforme" }, { condition: "conforme" }]), 100);
});

test("considera o peso dos itens críticos", () => {
  const score = calculateQualityScore([
    { condition: "conforme", weight: 1 },
    { condition: "nao_conforme", weight: 2 },
  ]);
  assert.equal(score, 47);
});

test("retorna zero para checklist vazio", () => {
  assert.equal(calculateQualityScore([]), 0);
});

test("classifica os limites de qualidade", () => {
  assert.equal(qualityLevel(90), "Excelente");
  assert.equal(qualityLevel(75), "Bom");
  assert.equal(qualityLevel(60), "Atenção");
  assert.equal(qualityLevel(59), "Crítico");
});

test("rejeita payload sem itens", () => {
  assert.equal(isInspectionPayloadValid({ propertyId: "IM-001", type: "entrada", items: [] }), false);
});

test("aceita payload completo", () => {
  assert.equal(isInspectionPayloadValid({ propertyId: "IM-001", type: "periodica", items: [{ condition: "atencao" }] }), true);
});
