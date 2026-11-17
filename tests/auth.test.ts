import assert from "node:assert/strict";
import test from "node:test";
import { isBasicEmailFormat, signupErrorMessage } from "../src/lib/auth.ts";

test("valida somente formato básico do e-mail", () => {
  assert.equal(isBasicEmailFormat("usuario@dominio-inexistente.local"), true);
  assert.equal(isBasicEmailFormat("teste@interno"), true);
  assert.equal(isBasicEmailFormat("sem-arroba"), false);
  assert.equal(isBasicEmailFormat("@dominio"), false);
  assert.equal(isBasicEmailFormat("usuario@"), false);
  assert.equal(isBasicEmailFormat("usuario @dominio"), false);
});

test("oculta erro técnico de limite do Supabase", () => {
  const expected = "Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.";
  assert.equal(signupErrorMessage({ status: 429, message: "Email rate limit exceeded" }), expected);
  assert.equal(signupErrorMessage({ code: "over_email_send_rate_limit" }), expected);
  assert.equal(signupErrorMessage({ message: "Too Many Requests" }), expected);
});

test("não expõe erros internos desconhecidos no cadastro", () => {
  const internalError = "database connection details should stay private";
  assert.equal(signupErrorMessage({ message: internalError }), "Não foi possível criar a conta agora. Revise os dados e tente novamente.");
  assert.equal(signupErrorMessage({ message: internalError }).includes(internalError), false);
});
