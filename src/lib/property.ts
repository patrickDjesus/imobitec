export type PropertyClassification = "residential" | "commercial";

export type PropertyRecord = {
  id: string;
  property_number: number;
  name: string;
  classification: PropertyClassification;
  property_type: string;
  status: "active" | "inactive" | "archived";
  postal_code: string;
  street_type: string;
  address_line: string;
  street_number: number | null;
  no_number: boolean;
  complement: string | null;
  district: string | null;
  city: string;
  state: string;
  notes: string | null;
  unit_area: number | null;
  land_area: number | null;
  room_count: number;
  created_at: string;
};

export const RESIDENTIAL_PROPERTY_TYPES = [
  ["house", "Casa"],
  ["townhouse", "Sobrado"],
  ["semi_detached_house", "Casa geminada"],
  ["apartment", "Apartamento"],
  ["penthouse", "Cobertura"],
  ["studio", "Studio/Kitnet"],
  ["loft", "Loft"],
  ["undefined", "Não definido"],
] as const;

export const COMMERCIAL_PROPERTY_TYPES = [
  ["commercial_room", "Sala comercial"],
  ["store", "Loja"],
  ["commercial_house", "Casa comercial"],
  ["commercial_building", "Prédio comercial"],
  ["warehouse", "Galpão"],
  ["storage", "Depósito/Armazém"],
  ["shopping_center", "Centro comercial"],
  ["undefined", "Não definido"],
] as const;

export const STREET_TYPES = [
  ["street", "Rua"],
  ["avenue", "Avenida"],
  ["lane", "Travessa"],
  ["alameda", "Alameda"],
  ["square", "Praça"],
  ["road", "Estrada"],
  ["highway", "Rodovia"],
  ["alley", "Viela"],
  ["narrow_alley", "Beco"],
  ["largo", "Largo"],
  ["easement", "Servidão"],
  ["passage", "Passagem"],
  ["undefined", "Não definido"],
] as const;

export const BRAZILIAN_STATES = [
  ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
  ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"], ["ES", "Espírito Santo"],
  ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"],
  ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
  ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
  ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
  ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"],
] as const;

export function digitsOnly(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export function formatPostalCode(value: string) {
  const digits = digitsOnly(value, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function formatSquareMetersInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const separatorIndex = Math.max(trimmed.lastIndexOf(","), trimmed.lastIndexOf("."));
  const integerSource = separatorIndex === -1 ? trimmed : trimmed.slice(0, separatorIndex);
  const decimalSource = separatorIndex === -1 ? "" : trimmed.slice(separatorIndex + 1);
  const integerPart = integerSource.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const decimalPart = decimalSource.replace(/\D/g, "").slice(0, 2).padEnd(2, "0");
  return `${integerPart},${decimalPart}`;
}

export function formatSquareMetersValue(value: number | string | null) {
  if (value === null || value === "") return "";
  return formatSquareMetersInput(String(value).replace(".", ","));
}

export function parseDecimalInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

export function parseOptionalInteger(value: string) {
  if (!value.trim()) return 0;
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function propertyTypeLabel(value: string) {
  const options = [...RESIDENTIAL_PROPERTY_TYPES, ...COMMERCIAL_PROPERTY_TYPES];
  return options.find(([key]) => key === value)?.[1] ?? "Não definido";
}

export function propertyStatusLabel(value: string) {
  return value === "active" ? "Ativo" : value === "inactive" ? "Inativo" : "Arquivado";
}

export function streetTypeLabel(value: string) {
  return STREET_TYPES.find(([key]) => key === value)?.[1] ?? "Não definido";
}
