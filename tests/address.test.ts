import assert from "node:assert/strict";
import test from "node:test";
import {
  findAddressOption,
  normalizeAddressName,
  splitStreet,
  uniqueAddressOptions,
} from "../src/lib/address.ts";

test("normaliza nomes de localidades com acentos", () => {
  assert.equal(normalizeAddressName("  São José  "), "sao jose");
});

test("localiza município pelo código IBGE ou nome", () => {
  const options = [{ id: "3550308", value: "São Paulo", label: "São Paulo" }];
  assert.equal(findAddressOption(options, "Sao Paulo")?.id, "3550308");
  assert.equal(findAddressOption(options, "nome divergente", "3550308")?.label, "São Paulo");
});

test("remove duplicatas e ordena localidades", () => {
  const options = uniqueAddressOptions([
    { id: "1", value: "Centro", label: "Centro" },
    { id: "2", value: "centro", label: "centro" },
    { id: "3", value: "Água Branca", label: "Água Branca" },
  ]);
  assert.deepEqual(options.map((option) => option.label), ["Água Branca", "Centro"]);
});

test("separa tipo do nome do logradouro", () => {
  assert.deepEqual(splitStreet("Avenida Paulista"), { streetType: "avenue", street: "Paulista" });
  assert.deepEqual(splitStreet("Rua XV de Novembro"), { streetType: "street", street: "XV de Novembro" });
  assert.deepEqual(splitStreet("Setor Industrial"), { streetType: "", street: "Setor Industrial" });
});
