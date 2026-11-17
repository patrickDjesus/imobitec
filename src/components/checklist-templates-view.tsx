"use client";

import { AlertTriangle, DoorOpen, Eye, ListChecks, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { checklistItemCategoryLabel, type ChecklistTemplateRecord } from "@/lib/checklist-template";
import { inspectionEnvironmentTypeLabel } from "@/lib/inspection";

export function ChecklistTemplatesView({
  templates,
  loading,
  error,
  onNew,
  onView,
  onEdit,
  onDelete,
}: {
  templates: ChecklistTemplateRecord[];
  loading: boolean;
  error: string;
  onNew: () => void;
  onView: (template: ChecklistTemplateRecord) => void;
  onEdit: (template: ChecklistTemplateRecord) => void;
  onDelete: (template: ChecklistTemplateRecord) => void;
}) {
  if (loading) return <article className="panel empty-state compact-empty-state"><div className="empty-state-content"><span className="empty-state-icon"><ListChecks size={28} /></span><h2>Carregando checklists</h2><p>Consultando modelos cadastrados no Supabase.</p></div></article>;
  if (error) return <article className="panel empty-state compact-empty-state schema-warning"><div className="empty-state-content"><span className="empty-state-icon"><AlertTriangle size={28} /></span><h2>Falha ao carregar checklists</h2><p>{error}</p></div></article>;
  if (templates.length === 0) return <article className="panel empty-state compact-empty-state"><div className="empty-state-content"><span className="empty-state-icon"><ListChecks size={28} /></span><h2>Nenhum checklist cadastrado</h2><p>Crie modelo para vincular itens aos cômodos das próximas vistorias.</p><button className="button primary empty-state-action" onClick={onNew}><Plus size={17} /> Novo checklist</button></div></article>;

  return (
    <div className="checklist-template-grid">
      {templates.map((template) => (
        <article className="panel checklist-template-card" key={template.id}>
          <header>
            <span className="checklist-template-icon"><ListChecks size={21} /></span>
            <div><p>MODELO DE CHECKLIST</p><h2>{template.name}</h2></div>
            <span className={`registration-status status-${template.is_active ? "active" : "inactive"}`}>{template.is_active ? "Ativo" : "Inativo"}</span>
          </header>
          <div className="checklist-template-room"><DoorOpen size={16} /><span>Cômodo vinculado</span><strong>{inspectionEnvironmentTypeLabel(template.environment_type)}</strong></div>
          <div className="checklist-template-items">
            {template.items.map((item, index) => (
              <div key={item.id}><span>{index + 1}</span><div><strong>{item.item_name}</strong><small>{checklistItemCategoryLabel(item.category)}</small></div>{item.is_required && <ShieldCheck size={15} aria-label="Obrigatório" />}</div>
            ))}
          </div>
          <footer><span>{template.items.length} {template.items.length === 1 ? "item" : "itens"}</span><small>Criado em {new Date(template.created_at).toLocaleDateString("pt-BR")}</small></footer>
          <div className="checklist-template-actions" aria-label={`Ações do checklist ${template.name}`}>
            <button className="property-action" type="button" onClick={() => onView(template)} title="Visualizar checklist" aria-label={`Visualizar checklist ${template.name}`}><Eye size={17} /></button>
            <button className="property-action" type="button" onClick={() => onEdit(template)} title="Editar checklist" aria-label={`Editar checklist ${template.name}`}><Pencil size={17} /></button>
            <button className="property-action property-action-danger" type="button" onClick={() => onDelete(template)} title="Excluir checklist" aria-label={`Excluir checklist ${template.name}`}><Trash2 size={17} /></button>
          </div>
        </article>
      ))}
    </div>
  );
}
