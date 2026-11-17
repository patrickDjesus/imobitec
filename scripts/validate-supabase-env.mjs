import { readFile } from "node:fs/promises";

const publicVariables = new Map();

for (const file of [".env.local", ".env.production", ".env"]) {
  try {
    const contents = await readFile(new URL(`../${file}`, import.meta.url), "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !publicVariables.has(match[1])) {
        publicVariables.set(match[1].trim(), match[2].trim());
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const valueOf = (name) => process.env[name]?.trim() || publicVariables.get(name) || "";
const url = valueOf("NEXT_PUBLIC_SUPABASE_URL");
const key = valueOf("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || valueOf("NEXT_PUBLIC_SUPABASE_ANON_KEY");

const validUrl = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url);
const validKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) || /^eyJ[A-Za-z0-9._-]+$/.test(key);
const unsafeKey = /^(sb_secret_|service_role)/i.test(key);

if (!validUrl || !validKey || unsafeKey) {
  console.error(
    "Configuração pública do Supabase ausente ou inválida. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY antes do build.",
  );
  process.exit(1);
}

console.log("Configuração pública do Supabase validada.");
