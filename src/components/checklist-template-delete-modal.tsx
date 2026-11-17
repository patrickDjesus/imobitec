"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ChecklistTemplateRecord } from "@/lib/checklist-template";
import { supabase } from "@/lib/supabase";

export function ChecklistTemplateDeleteModal({
  template,
  onClose,
  onDeleted,
}: {
  template: ChecklistTemplateRecord;
  onClose: () => void;
  onDeleted: (template: ChecklistTemplateRecord) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !deleting) onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [deleting, onClose]);

  const confirmDelete = async () => {
    if (!supabase) { setError("Supabase não configurado."); return; }
    setDeleting(true);
    setError("");
    const { data, error: deleteError } = await supabase
      .from("inspection_checklist_templates")
      .delete()
      .eq("id", template.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !data) {
      setError(deleteError?.message || "Exclusão não autorizada ou checklist não encontrado.");
      setDeleting(false);
      return;
    }
    onDeleted(template);
  };

  return (
    <div className="modal-layer" role="presentation">
      <div className="modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-checklist-title" aria-describedby="delete-checklist-description">
        <div className="modal-head delete-modal-head">
          <div><span>EXCLUSÃO PERMANENTE</span><h2 id="delete-checklist-title">Excluir checklist?</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={deleting} aria-label="Fechar"><X size={21} /></button>
        </div>
        <div className="delete-modal-body">
          <span className="delete-warning-icon"><AlertTriangle size={26} /></span>
          <div>
            <p id="delete-checklist-description">Confirma exclusão de <strong>{template.name}</strong>?</p>
            <small>Modelo e itens vinculados serão removidos. Checklists já copiados para vistorias permanecem no histórico. Esta ação não pode ser desfeita.</small>
          </div>
        </div>
        {error && <p className="form-error delete-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={deleting}>Cancelar</button>
          <button className="button danger-button" type="button" onClick={() => void confirmDelete()} disabled={deleting}>
            {deleting ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
            {deleting ? "Excluindo..." : "Excluir checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
