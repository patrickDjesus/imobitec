import { expect, test } from "@playwright/test";

// Credenciais de uma conta de TESTE (nunca a de produção de ninguém):
//   E2E_EMAIL=... E2E_PASSWORD=... pnpm test:e2e
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("página inicial carrega e mostra o formulário de acesso", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("input[type=email], input[name=email]").first()).toBeVisible();
  await expect(page.locator("input[type=password]").first()).toBeVisible();
});

test("senha errada não entra no sistema", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=email], input[name=email]").first().fill("naoexiste@teste.local");
  await page.locator("input[type=password]").first().fill("senha-errada-123");
  await page.locator("button[type=submit]").first().click();

  // continua com o formulário de senha na tela (não foi para o painel)
  await expect(page.locator("input[type=password]").first()).toBeVisible();
});

test.describe("com conta de teste", () => {
  test.skip(!email || !password, "defina E2E_EMAIL e E2E_PASSWORD para rodar");

  test("login válido sai da tela de acesso", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[type=email], input[name=email]").first().fill(email!);
    await page.locator("input[type=password]").first().fill(password!);
    await page.locator("button[type=submit]").first().click();

    await expect(page.locator("input[type=password]")).toHaveCount(0, { timeout: 15_000 });
  });

  // Regra de negócio central do projeto (RF de conclusão da vistoria / CT de bloqueio):
  // não dá para concluir uma vistoria com itens do checklist ainda pendentes.
  // ATENÇÃO: os textos abaixo são aproximados. Ajuste com `npx playwright codegen <url>`
  // se os nomes dos botões/links na tela forem diferentes.
  test("vistoria com itens pendentes não pode ser concluída", async ({ page }) => {
    await page.goto("/");
    await page.locator("input[type=email], input[name=email]").first().fill(email!);
    await page.locator("input[type=password]").first().fill(password!);
    await page.locator("button[type=submit]").first().click();
    await expect(page.locator("input[type=password]")).toHaveCount(0, { timeout: 15_000 });

    await page.getByRole("link", { name: /vistorias?/i }).first().click();

    // abre uma vistoria "Em Andamento" (status mostrado na lista)
    await page.getByText(/em andamento/i).first().click();

    const concluir = page.getByRole("button", { name: /concluir/i }).first();
    await concluir.click();

    // o sistema deve avisar que ainda há itens sem resultado e NÃO marcar como concluída
    await expect(page.getByText(/pendente|sem resultado|preencha|todos os itens/i).first()).toBeVisible();
    await expect(page.getByText(/^conclu[ií]da$/i)).toHaveCount(0);
  });
});
