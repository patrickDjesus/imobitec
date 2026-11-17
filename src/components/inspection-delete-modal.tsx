"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { InspectionRecord } from "@/lib/inspection";
import { supabase } from "@/lib/supabase";

export function InspectionDeleteModal({
  inspection,
  onClose,
  onDeleted,
}: {
  inspection: InspectionRecord;
  onClose: () => void;
  onDeleted: (inspection: InspectionRecord) => void;
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
      .from("inspections")
      .delete()
      .eq("id", inspection.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !data) {
      setError(deleteError?.message || "Exclusão não autorizada ou vistoria não encontrada.");
      setDeleting(false);
      return;
    }
    onDeleted(inspection);
  };

  return (
    <div className="modal-layer" role="presentation">
      <div className="modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-inspection-title" aria-describedby="delete-inspection-description">
        <div className="modal-head delete-modal-head">
          <div><span>EXCLUSÃO PERMANENTE</span><h2 id="delete-inspection-title">Excluir vistoria?</h2></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={deleting} aria-label="Fechar"><X size={21} /></button>
        </div>
        <div className="delete-modal-body">
          <span className="delete-warning-icon"><AlertTriangle size={26} /></span>
          <div>
            <p id="delete-inspection-description">Confirma exclusão da <strong>Vistoria #{inspection.inspection_number}</strong>?</p>
            <small>Vistoria e registros vinculados serão removidos do banco. Esta ação não pode ser desfeita.</small>
          </div>
        </div>
        {error && <p className="form-error delete-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={deleting}>Cancelar</button>
          <button className="button danger-button" type="button" onClick={() => void confirmDelete()} disabled={deleting}>
            {deleting ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
            {deleting ? "Excluindo..." : "Excluir vistoria"}
          </button>
        </div>
      </div>
    </div>
  );
}
