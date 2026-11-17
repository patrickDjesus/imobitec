import type { AddressOption, CepAddress } from "@/lib/address";
import { BRAZILIAN_STATES } from "@/lib/property";

const IBGE_BASE = "https://servicodados.ibge.gov.br/api/v1/localidades";
const BRASIL_API_BASE = "https://brasilapi.com.br/api";
const VIA_CEP_BASE = "https://viacep.com.br/ws";
const optionsCache = new Map<string, { expiresAt: number; items: AddressOption[] }>();

async function fetchJson(url: string, timeout = 8_000) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`Serviço externo respondeu ${response.status}.`);
  return response.json();
}

async function fetchJsonWithRetry(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fetchJson(url);
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 180));
    }
  }
  throw lastError;
}

async function cachedOptions(key: string, loader: () => Promise<AddressOption[]>) {
  const cached = optionsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  const items = await loader();
  optionsCache.set(key, { expiresAt: Date.now() + 6 * 60 * 60 * 1_000, items });
  return items;
}

function optionsResponse(items: AddressOption[]) {
  return Response.json(
    { items },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}

async function loadCities(uf: string) {
  return cachedOptions(`cities:${uf}`, async () => {
    const fromIbge = fetchJsonWithRetry(`${IBGE_BASE}/estados/${uf}/municipios?orderBy=nome`)
      .then((cities) => (cities as Array<{ id: number; nome: string }>).map((city) => ({
        id: String(city.id), value: city.nome, label: city.nome,
      })));
    const fromBrasilApi = fetchJson(`${BRASIL_API_BASE}/ibge/municipios/v1/${uf}`, 13_000)
      .then((cities) => (cities as Array<{ codigo_ibge: string; nome: string }>).map((city) => ({
        id: city.codigo_ibge, value: city.nome, label: city.nome,
      })));
    return Promise.any([fromIbge, fromBrasilApi]);
  });
}

async function loadCep(cep: string): Promise<CepAddress> {
  const fromBrasilApi = fetchJson(`${BRASIL_API_BASE}/cep/v2/${cep}`, 10_000).then((result) => {
    const data = result as {
      cep: string; state: string; city: string; neighborhood?: string; street?: string;
      ibge?: { city?: string; state?: string };
    };
    return {
      postalCode: data.cep,
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood ?? "",
      street: data.street ?? "",
      ibgeCityId: data.ibge?.city ?? "",
      ibgeStateId: data.ibge?.state ?? "",
    } satisfies CepAddress;
  });

  const fromViaCep = fetchJson(`${VIA_CEP_BASE}/${cep}/json/`, 10_000).then((result) => {
    const data = result as {
      cep?: string; uf?: string; localidade?: string; bairro?: string; logradouro?: string;
      ibge?: string; erro?: boolean | string;
    };
    if (data.erro || !data.uf || !data.localidade) throw new Error("CEP não encontrado: 404.");
    return {
      postalCode: data.cep ?? cep,
      state: data.uf,
      city: data.localidade,
      neighborhood: data.bairro ?? "",
      street: data.logradouro ?? "",
      ibgeCityId: data.ibge ?? "",
      ibgeStateId: data.ibge?.slice(0, 2) ?? "",
    } satisfies CepAddress;
  });

  return Promise.any([fromBrasilApi, fromViaCep]);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  try {
    if (mode === "states") {
      return optionsResponse(BRAZILIAN_STATES.map(([value, label]) => ({ id: value, value, label })));
    }

    if (mode === "cities") {
      const uf = searchParams.get("uf")?.toUpperCase();
      if (!uf || !BRAZILIAN_STATES.some(([value]) => value === uf)) {
        return Response.json({ message: "UF inválida." }, { status: 400 });
      }
      return optionsResponse(await loadCities(uf));
    }

    if (mode === "districts") {
      const cityId = searchParams.get("cityId");
      if (!cityId || !/^\d{7}$/.test(cityId)) {
        return Response.json({ message: "Município inválido." }, { status: 400 });
      }
      const items = await cachedOptions(`districts:${cityId}`, async () => {
        const districts = await fetchJsonWithRetry(`${IBGE_BASE}/municipios/${cityId}/distritos?orderBy=nome`) as Array<{ id: number; nome: string }>;
        return districts.map((district) => ({ id: String(district.id), value: district.nome, label: district.nome }));
      });
      return optionsResponse(items);
    }

    if (mode === "cep") {
      const cep = searchParams.get("cep")?.replace(/\D/g, "") ?? "";
      if (!/^\d{8}$/.test(cep)) {
        return Response.json({ message: "CEP deve possuir oito dígitos." }, { status: 400 });
      }
      return Response.json(await loadCep(cep), {
        headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
      });
    }

    return Response.json({ message: "Consulta de endereço inválida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error && (error.message.includes("404") || error.message.includes("não encontrado"))
      ? "CEP não encontrado."
      : "Serviço de endereços indisponível. Tente novamente.";
    return Response.json({ message }, { status: message.includes("não encontrado") ? 404 : 502 });
  }
}
