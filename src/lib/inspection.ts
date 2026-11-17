export type InspectionType = "entry" | "exit" | "periodic" | "maintenance";

export type InspectionStatus = "draft" | "in_progress" | "completed" | "cancelled";

export type InspectionItemCondition = "pending" | "compliant" | "attention" | "non_compliant" | "not_applicable";

export type InspectionEnvironmentType =
  | "living_room"
  | "dining_room"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "garage"
  | "laundry"
  | "office"
  | "balcony"
  | "hallway"
  | "pantry"
  | "closet"
  | "pool"
  | "reception"
  | "service_area"
  | "sales_area"
  | "meeting_room"
  | "warehouse"
  | "commercial_kitchen"
  | "locker_room"
  | "loading_area"
  | "technical_room"
  | "server_room"
  | "production_area"
  | "outdoor_area"
  | "other";

export type InspectionRecord = {
  id: string;
  inspection_number: number;
  property_id: string;
  inspection_type: InspectionType;
  scheduled_at: string;
  inspector_id: string;
  status: InspectionStatus;
  room_count: number;
  started_at: string | null;
  completed_at: string | null;
  quality_score: number | null;
  general_notes: string | null;
  created_at: string;
};

export type InspectionEnvironmentRecord = {
  id: string;
  inspection_id: string;
  environment_type: InspectionEnvironmentType;
  name: string;
  sort_order: number;
  created_at: string;
};

export type InspectionItemRecord = {
  id: string;
  inspection_id: string;
  inspection_environment_id: string | null;
  item_name: string;
  category: string;
  condition: InspectionItemCondition;
  is_required: boolean;
  notes: string | null;
  created_at: string;
};

export type InspectorOption = {
  id: string;
  full_name: string | null;
  role: "admin" | "manager" | "inspector";
  is_active: boolean;
};

type SearchableProperty = {
  property_number: number;
  name: string;
  postal_code: string;
  address_line: string;
  district: string | null;
  city: string;
  state: string;
};

export const INSPECTION_TYPES: ReadonlyArray<readonly [InspectionType, string]> = [
  ["entry", "Entrada"],
  ["exit", "Saída"],
  ["periodic", "Periódica"],
  ["maintenance", "Manutenção"],
];

export const INSPECTION_STATUSES: ReadonlyArray<readonly [InspectionStatus, string]> = [
  ["draft", "Rascunho"],
  ["in_progress", "Em Andamento"],
  ["completed", "Concluída"],
  ["cancelled", "Cancelada"],
];

export const RESIDENTIAL_INSPECTION_ENVIRONMENT_TYPES: ReadonlyArray<readonly [InspectionEnvironmentType, string]> = [
  ["living_room", "Sala de estar"],
  ["dining_room", "Sala de jantar"],
  ["kitchen", "Cozinha"],
  ["bedroom", "Quarto"],
  ["bathroom", "Banheiro"],
  ["garage", "Garagem"],
  ["laundry", "Lavanderia"],
  ["office", "Escritório"],
  ["balcony", "Varanda/Sacada"],
  ["hallway", "Corredor"],
  ["pantry", "Despensa"],
  ["closet", "Closet"],
  ["pool", "Piscina"],
  ["outdoor_area", "Área externa"],
  ["other", "Outro ambiente"],
];

export const COMMERCIAL_INSPECTION_ENVIRONMENT_TYPES: ReadonlyArray<readonly [InspectionEnvironmentType, string]> = [
  ["reception", "Recepção"],
  ["service_area", "Área de atendimento"],
  ["sales_area", "Área de vendas"],
  ["office", "Escritório / Administrativo"],
  ["meeting_room", "Sala de reunião"],
  ["warehouse", "Estoque / Depósito"],
  ["pantry", "Copa / Despensa"],
  ["commercial_kitchen", "Cozinha industrial"],
  ["bathroom", "Banheiro"],
  ["locker_room", "Vestiário"],
  ["hallway", "Corredor / Circulação"],
  ["garage", "Garagem / Estacionamento"],
  ["loading_area", "Área de carga e descarga"],
  ["technical_room", "Sala técnica"],
  ["server_room", "Sala de servidores"],
  ["production_area", "Área de produção"],
  ["outdoor_area", "Área externa"],
  ["other", "Outro ambiente"],
];

const COMMERCIAL_ONLY_INSPECTION_ENVIRONMENT_TYPES = COMMERCIAL_INSPECTION_ENVIRONMENT_TYPES.filter(
  ([commercialType]) => !RESIDENTIAL_INSPECTION_ENVIRONMENT_TYPES.some(([residentialType]) => residentialType === commercialType),
);

export const INSPECTION_ENVIRONMENT_TYPES: ReadonlyArray<readonly [InspectionEnvironmentType, string]> = [
  ...RESIDENTIAL_INSPECTION_ENVIRONMENT_TYPES,
  ...COMMERCIAL_ONLY_INSPECTION_ENVIRONMENT_TYPES,
];

export function inspectionEnvironmentTypesForClassification(classification: "residential" | "commercial" | null | undefined) {
  return classification === "commercial"
    ? COMMERCIAL_INSPECTION_ENVIRONMENT_TYPES
    : RESIDENTIAL_INSPECTION_ENVIRONMENT_TYPES;
}

export function inspectionTypeLabel(value: InspectionType) {
  return INSPECTION_TYPES.find(([key]) => key === value)?.[1] ?? value;
}

export function inspectionStatusLabel(value: InspectionStatus) {
  return INSPECTION_STATUSES.find(([key]) => key === value)?.[1] ?? value;
}

export function inspectionEnvironmentTypeLabel(value: InspectionEnvironmentType) {
  return INSPECTION_ENVIRONMENT_TYPES.find(([key]) => key === value)?.[1]
    ?? COMMERCIAL_INSPECTION_ENVIRONMENT_TYPES.find(([key]) => key === value)?.[1]
    ?? value;
}

export function countInspectionEnvironmentType(
  environments: ReadonlyArray<{ type: InspectionEnvironmentType }>,
  type: InspectionEnvironmentType,
) {
  return environments.filter((environment) => environment.type === type).length;
}

export function nextInspectionEnvironmentName(
  environments: ReadonlyArray<{ type: InspectionEnvironmentType; name: string }>,
  type: InspectionEnvironmentType,
) {
  const label = inspectionEnvironmentTypeLabel(type);
  const names = new Set(environments
    .filter((environment) => environment.type === type)
    .map((environment) => environment.name.trim().toLocaleLowerCase("pt-BR")));
  let suffix = 1;
  while (names.has(`${label} ${suffix}`.toLocaleLowerCase("pt-BR"))) suffix += 1;
  return `${label} ${suffix}`;
}

export function normalizeInspectionSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function filterInspectionProperties<Property extends SearchableProperty>(properties: Property[], query: string) {
  const normalizedQuery = normalizeInspectionSearch(query);
  if (!normalizedQuery) return properties;

  return properties.filter((property) => normalizeInspectionSearch([
    property.property_number,
    `#${property.property_number}`,
    `Imóvel #${property.property_number} · ${property.name}`,
    property.name,
    property.postal_code,
    property.address_line,
    property.district,
    property.city,
    property.state,
  ].filter(Boolean).join(" ")).includes(normalizedQuery));
}

export function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function buildScheduledAt(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const scheduled = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    year < 1900 || year > 2100 || hour > 23 || minute > 59 ||
    scheduled.getFullYear() !== year || scheduled.getMonth() !== month - 1 ||
    scheduled.getDate() !== day || scheduled.getHours() !== hour ||
    scheduled.getMinutes() !== minute
  ) return null;

  return scheduled.toISOString();
}

export function formatInspectionDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export function formatInspectionTime(value: string) {
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
