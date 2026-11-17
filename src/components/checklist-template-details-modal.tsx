"use client";

import { DoorOpen, ListChecks, ShieldCheck, X } from "lucide-react";
import { useEffect } from "react";
import { checklistItemCategoryLabel, type ChecklistTemplateRecord } from "@/lib/checklist-template";
import { inspectionEnvironmentTypeLabel } from "@/lib/inspection";

export function ChecklistTemplateDetailsModal({
  template,
  onClose,
}: {
  template: ChecklistTemplateRecord;
  onClose: () => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div className="modal-layer property-modal-layer" role="presentation">
      <div className="modal property-modal details-modal checklist-details-modal" role="dialog" aria-modal="true" aria-labelledby="checklist-details-title">
        <div className="modal-head property-modal-head">
          <div><span>VISUALIZAÇÃO DO MODELO</span><h2 id="checklist-details-title">{template.name}</h2><p>Consulta somente leitura.</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={21} /></button>
        </div>

        <div className="property-form-body details-body">
          <section className="detail-section">
            <h3><DoorOpen size={17} /> Identificação</h3>
            <dl className="detail-grid">
              <div className="detail-item detail-item-wide"><dt>Nome do modelo</dt><dd>{template.name}</dd></div>
              <div className="detail-item"><dt>Cômodo vinculado</dt><dd>{inspectionEnvironmentTypeLabel(template.environment_type)}</dd></div>
              <div className="detail-item"><dt>Situação</dt><dd><span className={`registration-status status-${template.is_active ? "active" : "inactive"}`}>{template.is_active ? "Ativo" : "Inativo"}</span></dd></div>
              <div className="detail-item"><dt>Data de criação</dt><dd>{new Date(template.created_at).toLocaleDateString("pt-BR")}</dd></div>
              <div className="detail-item"><dt>Total de itens</dt><dd>{template.items.length}</dd></div>
            </dl>
          </section>

          <section className="detail-section">
            <h3><ListChecks size={17} /> Itens a inspecionar</h3>
            <div className="checklist-detail-items">
              {template.items.map((item, index) => (
                <div className="checklist-detail-item" key={item.id}>
                  <span>{index + 1}</span>
                  <div><strong>{item.item_name}</strong><small>{checklistItemCategoryLabel(item.category)}</small></div>
                  {item.is_required ? <span className="checklist-required-badge"><ShieldCheck size={14} /> Obrigatório</span> : <small>Opcional</small>}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="modal-actions property-modal-actions">
          <button className="button primary" type="button" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
