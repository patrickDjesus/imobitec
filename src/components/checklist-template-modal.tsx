"use client";

import { DoorOpen, ListChecks, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  CHECKLIST_ITEM_CATEGORIES,
  hasChecklistForEnvironment,
  type ChecklistItemCategory,
  type ChecklistTemplateRecord,
} from "@/lib/checklist-template";
import { INSPECTION_ENVIRONMENT_TYPES, type InspectionEnvironmentType } from "@/lib/inspection";
import { supabase } from "@/lib/supabase";

type ChecklistItemDraft = {
  clientId: string;
  itemName: string;
  category: ChecklistItemCategory;
  isRequired: boolean;
};

function newItem(): ChecklistItemDraft {
  return { clientId: crypto.randomUUID(), itemName: "", category: "structure", isRequired: true };
}

export function ChecklistTemplateModal({
  template,
  templates,
  onClose,
  onSaved,
}: {
  template?: ChecklistTemplateRecord | null;
  templates: ChecklistTemplateRecord[];
  onClose: () => void;
  onSaved: (template: ChecklistTemplateRecord) => void;
}) {
  const editing = Boolean(template);
  const [name, setName] = useState(template?.name ?? "");
  const [environmentType, setEnvironmentType] = useState<InspectionEnvironmentType | "">(template?.environment_type ?? "");
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [items, setItems] = useState<ChecklistItemDraft[]>(() => template?.items.map((item) => ({
    clientId: item.id,
    itemName: item.item_name,
    category: item.category,
    isRequired: item.is_required,
  })) ?? [newItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [onClose, saving]);

  const updateItem = (clientId: string, changes: Partial<ChecklistItemDraft>) => {
    setItems((current) => current.map((item) => item.clientId === clientId ? { ...item, ...changes } : item));
  };

  const removeItem = (clientId: string) => {
    setItems((current) => current.length === 1 ? current : current.filter((item) => item.clientId !== clientId));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const normalizedItems = items.map((item) => ({ ...item, itemName: item.itemName.trim() }));
    if (!name.trim()) { setError("Informe nome do modelo."); return; }
    if (!environmentType) { setError("Selecione cômodo vinculado."); return; }
    if (hasChecklistForEnvironment(templates, environmentType, template?.id)) {
      setError("Para o cômodo selecionado já existe uma execução de vistoria cadastrada.");
      return;
    }
    if (normalizedItems.some((item) => !item.itemName)) { setError("Informe descrição de todos os itens."); return; }
    const uniqueNames = new Set(normalizedItems.map((item) => item.itemName.toLocaleLowerCase("pt-BR")));
    if (uniqueNames.size !== normalizedItems.length) { setError("Itens da mesma lista precisam ter nomes diferentes."); return; }
    if (!supabase) { setError("Supabase não configurado."); return; }

    setSaving(true);
    const rpcName = editing
      ? "update_inspection_checklist_template"
      : "create_inspection_checklist_template";
    const payload = {
        p_name: name.trim(),
        p_environment_type: environmentType,
        p_is_active: isActive,
        p_items: normalizedItems.map((item, index) => ({
          item_name: item.itemName,
          category: item.category,
          is_required: item.isRequired,
          sort_order: index,
        })),
        ...(template ? { p_template_id: template.id } : {}),
      };
    const { data, error: saveError } = await supabase
      .rpc(rpcName, payload)
      .single();

    if (saveError || !data) {
      const schemaPending = ["42P01", "42703", "PGRST202", "PGRST204"].includes(saveError?.code || "");
      const duplicateEnvironment = saveError?.code === "23505"
        || saveError?.message?.includes("cômodo selecionado");
      setError(schemaPending
        ? `Estrutura pendente. Execute ${editing ? "banco-de-dados/migracoes/010_crud_checklists.sql" : "banco-de-dados/migracoes/009_modelos_checklist_vistoria.sql"} no Supabase.`
        : duplicateEnvironment
          ? "Para o cômodo selecionado já existe uma execução de vistoria cadastrada."
          : saveError?.message || `Não foi possível ${editing ? "atualizar" : "cadastrar"} modelo de checklist.`);
      setSaving(false);
      return;
    }

    onSaved(data as unknown as ChecklistTemplateRecord);
  };

  return (
    <div className="modal-layer property-modal-layer" role="presentation">
      <div className="modal property-modal checklist-template-modal" role="dialog" aria-modal="true" aria-labelledby="checklist-template-title">
        <form onSubmit={submit}>
          <div className="modal-head property-modal-head">
            <div><span>{editing ? "EDIÇÃO DO MODELO" : "CADASTRO OPERACIONAL"}</span><h2 id="checklist-template-title">{editing ? "Editar checklist de vistoria" : "Novo checklist de vistoria"}</h2><p>Modelo aplicado aos ambientes deste tipo nas novas vistorias.</p></div>
            <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={21} /></button>
          </div>

          <div className="property-form-body checklist-template-body">
            <fieldset className="form-section">
              <legend><DoorOpen size={17} /> Modelo e cômodo</legend>
              <div className="form-grid">
                <label className="form-field"><span>Nome do modelo *</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required autoFocus placeholder="Ex.: Checklist padrão de cozinha" /></label>
                <label className="form-field"><span>Cômodo vinculado *</span><select value={environmentType} onChange={(event) => setEnvironmentType(event.target.value as InspectionEnvironmentType)} required><option value="">Selecione</option>{INSPECTION_ENVIRONMENT_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="form-field"><span>Situação *</span><select value={isActive ? "active" : "inactive"} onChange={(event) => setIsActive(event.target.value === "active")}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
              </div>
            </fieldset>

            <fieldset className="form-section checklist-items-section">
              <legend><ListChecks size={17} /> Itens a inspecionar</legend>
              <div className="checklist-draft-list">
                {items.map((item, index) => (
                  <div className="checklist-draft-row" key={item.clientId}>
                    <span className="environment-order">{index + 1}</span>
                    <label className="form-field checklist-item-name"><span>Item *</span><input value={item.itemName} onChange={(event) => updateItem(item.clientId, { itemName: event.target.value.slice(0, 180) })} required placeholder="Ex.: Verificar funcionamento da torneira" /></label>
                    <label className="form-field"><span>Categoria *</span><select value={item.category} onChange={(event) => updateItem(item.clientId, { category: event.target.value as ChecklistItemCategory })}>{CHECKLIST_ITEM_CATEGORIES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                    <label className="checklist-required"><input type="checkbox" checked={item.isRequired} onChange={(event) => updateItem(item.clientId, { isRequired: event.target.checked })} /><span>Obrigatório</span></label>
                    <button type="button" onClick={() => removeItem(item.clientId)} disabled={items.length === 1} aria-label={`Remover item ${index + 1}`} title="Remover item"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
              <button className="button secondary checklist-add-item" type="button" onClick={() => setItems((current) => [...current, newItem()])}><Plus size={16} /> Adicionar item</button>
            </fieldset>

            <p className="checklist-snapshot-note"><ListChecks size={16} /><span>Ao cadastrar vistoria, itens ativos são copiados como snapshot. Alterações futuras no modelo não mudam histórico.</span></p>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>

          <div className="modal-actions property-modal-actions">
            <button className="button secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="button primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar checklist"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
