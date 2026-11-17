import type { InspectionEnvironmentType } from "@/lib/inspection";

export type ChecklistItemCategory =
  | "structure"
  | "finishing"
  | "installations"
  | "equipment"
  | "cleaning"
  | "safety"
  | "other";

export type ChecklistTemplateItemRecord = {
  id: string;
  template_id: string;
  item_name: string;
  category: ChecklistItemCategory;
  is_required: boolean;
  sort_order: number;
  created_at: string;
};

export type ChecklistTemplateRecord = {
  id: string;
  name: string;
  environment_type: InspectionEnvironmentType;
  is_active: boolean;
  created_at: string;
  items: ChecklistTemplateItemRecord[];
};

export const CHECKLIST_ITEM_CATEGORIES: ReadonlyArray<readonly [ChecklistItemCategory, string]> = [
  ["structure", "Estrutura"],
  ["finishing", "Acabamento"],
  ["installations", "Instalações"],
  ["equipment", "Equipamentos"],
  ["cleaning", "Limpeza"],
  ["safety", "Segurança"],
  ["other", "Outro"],
];

export function checklistItemCategoryLabel(value: ChecklistItemCategory) {
  return CHECKLIST_ITEM_CATEGORIES.find(([key]) => key === value)?.[1] ?? value;
}

export function hasChecklistForEnvironment(
  templates: ReadonlyArray<Pick<ChecklistTemplateRecord, "id" | "environment_type">>,
  environmentType: InspectionEnvironmentType,
  ignoredTemplateId?: string,
) {
  return templates.some((template) =>
    template.environment_type === environmentType && template.id !== ignoredTemplateId,
  );
}
