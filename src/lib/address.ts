export type AddressOption = {
  id: string;
  value: string;
  label: string;
};

export type CepAddress = {
  postalCode: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  ibgeCityId: string;
  ibgeStateId: string;
};

const STREET_PREFIXES = [
  ["avenida", "avenue"],
  ["travessa", "lane"],
  ["alameda", "alameda"],
  ["praça", "square"],
  ["estrada", "road"],
  ["rodovia", "highway"],
  ["viela", "alley"],
  ["beco", "narrow_alley"],
  ["largo", "largo"],
  ["servidão", "easement"],
  ["passagem", "passage"],
  ["rua", "street"],
] as const;

export function normalizeAddressName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function findAddressOption(options: AddressOption[], label: string, id?: string) {
  if (id) {
    const byId = options.find((option) => option.id === id);
    if (byId) return byId;
  }
  const normalized = normalizeAddressName(label);
  return options.find((option) => normalizeAddressName(option.label) === normalized);
}

export function uniqueAddressOptions(options: AddressOption[]) {
  const seen = new Set<string>();
  return options
    .filter((option) => {
      const key = normalizeAddressName(option.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

export function splitStreet(value: string) {
  const trimmed = value.trim();
  const normalized = normalizeAddressName(trimmed);
  const match = STREET_PREFIXES.find(([prefix]) =>
    normalized === prefix || normalized.startsWith(`${normalizeAddressName(prefix)} `),
  );

  if (!match) return { streetType: "", street: trimmed };
  const firstSpace = trimmed.indexOf(" ");
  return {
    streetType: match[1],
    street: firstSpace === -1 ? trimmed : trimmed.slice(firstSpace + 1).trim(),
  };
}
