// Resolve o alias "@/..." (usado em src/lib/*.ts) para src/... durante os testes.
// O Node puro não conhece o alias do tsconfig, então ensinamos ele aqui.
import { pathToFileURL } from "node:url";
import { resolve as pathResolve } from "node:path";

const srcRoot = pathResolve(process.cwd(), "src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const target = pathResolve(srcRoot, `${specifier.slice(2)}.ts`);
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
