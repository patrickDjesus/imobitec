import assert from "node:assert/strict";
import test from "node:test";
import {
  digitsOnly,
  formatPostalCode,
  formatSquareMetersInput,
  formatSquareMetersValue,
  parseDecimalInput,
  parseOptionalInteger,
  propertyTypeLabel,
  streetTypeLabel,
} from "../src/lib/property.ts";

test("formata CEP preservando zeros iniciais", () => {
  assert.equal(formatPostalCode("01310-100"), "01310-100");
  assert.equal(formatPostalCode("01310100"), "01310-100");
});

test("formata áreas em metros quadrados durante a digitação", () => {
  assert.equal(formatSquareMetersInput("1"), "1,00");
  assert.equal(formatSquareMetersInput("123"), "123,00");
  assert.equal(formatSquareMetersInput("123,4"), "123,40");
  assert.equal(formatSquareMetersInput("1234.56"), "1234,56");
  assert.equal(formatSquareMetersInput(""), "");
});

test("formata áreas cadastradas para edição", () => {
  assert.equal(formatSquareMetersValue(125.5), "125,50");
  assert.equal(formatSquareMetersValue(null), "");
});

test("limita campos inteiros à quantidade informada", () => {
  assert.equal(digitsOnly("12a3456", 5), "12345");
});

test("converte decimal brasileiro para duas casas", () => {
  assert.equal(parseDecimalInput("1.234,567"), 1234.57);
  assert.equal(parseDecimalInput("85.5"), 85.5);
  assert.equal(parseDecimalInput(""), null);
});

test("valida quantidades inteiras não negativas", () => {
  assert.equal(parseOptionalInteger("12"), 12);
  assert.equal(parseOptionalInteger(""), 0);
  assert.equal(parseOptionalInteger("-1"), null);
});

test("traduz tipo do imóvel", () => {
  assert.equal(propertyTypeLabel("commercial_room"), "Sala comercial");
  assert.equal(streetTypeLabel("avenue"), "Avenida");
});
