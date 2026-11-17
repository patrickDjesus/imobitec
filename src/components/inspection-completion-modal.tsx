"use client";

import { AlertTriangle, CheckCircle2, CircleMinus, ClipboardCheck, LoaderCircle, Save, ShieldAlert, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { checklistItemCategoryLabel, type ChecklistItemCategory } from "@/lib/checklist-template";
import {
  inspectionEnvironmentTypeLabel,
  type InspectionEnvironmentRecord,
  type InspectionItemCondition,
  type InspectionItemRecord,
  type InspectionRecord,
} from "@/lib/inspection";
import type { PropertyRecord } from "@/lib/property";
import { supabase } from "@/lib/supabase";

type ItemDraft = InspectionItemRecord & { result: Exclude<InspectionItemCondition, "pending"> | "" };

const RESULTS: ReadonlyArray<readonly [Exclude<InspectionItemCondition, "pending">, string]> = [
  ["compliant", "Conforme"],
  ["attention", "Atenção"],
  ["non_compliant", "Não conforme"],
  ["not_applicable", "N/A"],
];

export function InspectionCompletionModal({
  inspection,
  property,
  onClose,
  onCompleted,
}: {
  inspection: InspectionRecord;
  property?: PropertyRecord;
  onClose: () => void;
  onCompleted: (inspection: InspectionRecord) => void;
}) {
  const [environments, setEnvironments] = useState<InspectionEnvironmentRecord[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [generalNotes, setGeneralNotes] = useState(inspection.general_notes || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [onClose, saving]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!supabase) {
        setError("Supabase não configurado.");
        setLoading(false);
        return;
      }

      const { error: prepareError } = await supabase.rpc("prepare_inspection_completion", { p_inspection_id: inspection.id });
      if (!active) return;
      if (prepareError) {
        const schemaPending = ["42883", "PGRST202"].includes(prepareError.code || "");
        setError(schemaPending
          ? "Estrutura pendente. Execute banco-de-dados/migracoes/011_conclusao_vistorias.sql no Supabase."
          : prepareError.message || "Não foi possível preparar checklist da vistoria.");
        setLoading(false);
        return;
      }

      const [environmentResult, itemResult] = await Promise.all([
        supabase.from("inspection_environments").select("id, inspection_id, environment_type, name, sort_order, created_at").eq("inspection_id", inspection.id).order("sort_order"),
        supabase.from("inspection_items").select("id, inspection_id, inspection_environment_id, item_name, category, condition, is_required, notes, created_at").eq("inspection_id", inspection.id).order("created_at"),
      ]);
      if (!active) return;
      if (environmentResult.error || itemResult.error) {
        setError(environmentResult.error?.message || itemResult.error?.message || "Não foi possível carregar checklist da vistoria.");
      } else {
        setEnvironments((environmentResult.data || []) as InspectionEnvironmentRecord[]);
        setItems(((itemResult.data || []) as InspectionItemRecord[]).map((item) => ({
          ...item,
          result: item.condition === "pending" ? "" : item.condition,
        })));
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [inspection.id]);

  const completedCount = items.filter((item) => item.result).length;
  const completionPercent = items.length ? Math.round((completedCount / items.length) * 100) : 0;
  const environmentsWithoutItems = useMemo(() => environments.filter((environment) =>
    !items.some((item) => item.inspection_environment_id === environment.id)), [environments, items]);

  const updateItem = (itemId: string, changes: Partial<Pick<ItemDraft, "result" | "notes">>) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...changes } : item));
    setError("");
  };

  const completeInspection = async () => {
    if (!supabase) { setError("Supabase não configurado."); return; }
    if (items.length === 0) { setError("Vistoria não possui itens para concluir."); return; }
    if (environmentsWithoutItems.length > 0) {
      setError("Todos os ambientes precisam possuir checklist ativo antes da conclusão.");
      return;
    }
    if (completedCount !== items.length) {
      setError(`Informe resultado dos ${items.length - completedCount} item(ns) restante(s).`);
      return;
    }
    const issueWithoutNotes = items.find((item) =>
      (item.result === "attention" || item.result === "non_compliant") && !item.notes?.trim());
    if (issueWithoutNotes) {
      setError(`Informe observação para o item “${issueWithoutNotes.item_name}”.`);
      return;
    }

    setSaving(true);
    setError("");
    const { data, error: saveError } = await supabase.rpc("complete_inspection", {
      p_inspection_id: inspection.id,
      p_general_notes: generalNotes.trim() || null,
      p_items: items.map((item) => ({ id: item.id, condition: item.result, notes: item.notes?.trim() || null })),
    }).single();

    if (saveError || !data) {
      const schemaPending = ["42883", "PGRST202"].includes(saveError?.code || "");
      setError(schemaPending
        ? "Estrutura pendente. Execute banco-de-dados/migracoes/011_conclusao_vistorias.sql no Supabase."
        : saveError?.message || "Não foi possível concluir vistoria.");
      setSaving(false);
      return;
    }
    onCompleted(data as InspectionRecord);
  };

  return (
    <div className="modal-layer property-modal-layer" role="presentation">
      <div className="modal property-modal inspection-completion-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-completion-title">
        <div className="modal-head property-modal-head">
          <div><span>CONCLUSÃO OPERACIONAL</span><h2 id="inspection-completion-title">Concluir vistoria #{inspection.inspection_number}</h2><p>{property?.name || "Imóvel vinculado"} · Informe resultado de cada etapa.</p></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={21} /></button>
        </div>

        <div className="property-form-body completion-form-body">
          <div className="completion-progress-card">
            <span className="completion-progress-icon"><ClipboardCheck size={22} /></span>
            <div><span>Progresso do checklist</span><strong>{completedCount} de {items.length} itens informados</strong><i><b style={{ width: `${completionPercent}%` }} /></i></div>
            <strong>{completionPercent}%</strong>
          </div>

          {loading ? (
            <div className="completion-loading"><LoaderCircle className="spin" size={23} /> Carregando etapas da vistoria...</div>
          ) : (
            <div className="completion-environments">
              {environments.map((environment, environmentIndex) => {
                const environmentItems = items.filter((item) => item.inspection_environment_id === environment.id);
                return (
                  <section className="completion-environment" key={environment.id}>
                    <header><span>{String(environmentIndex + 1).padStart(2, "0")}</span><div><h3>{environment.name}</h3><p>{inspectionEnvironmentTypeLabel(environment.environment_type)} · {environmentItems.length} {environmentItems.length === 1 ? "item" : "itens"}</p></div></header>
                    {environmentItems.length === 0 ? (
                      <div className="completion-missing-checklist"><AlertTriangle size={18} /><span>Ambiente sem checklist ativo. Cadastre modelo antes de concluir.</span></div>
                    ) : environmentItems.map((item, itemIndex) => (
                      <article className={`completion-item ${item.result ? "completion-item-filled" : ""}`} key={item.id}>
                        <div className="completion-item-title"><span>{itemIndex + 1}</span><div><strong>{item.item_name}</strong><small>{checklistItemCategoryLabel(item.category as ChecklistItemCategory)} · {item.is_required ? "Obrigatório" : "Opcional"}</small></div></div>
                        <div className="completion-result-options" role="radiogroup" aria-label={`Resultado de ${item.item_name}`}>
                          {RESULTS.map(([value, label]) => (
                            <button type="button" className={`completion-result result-${value} ${item.result === value ? "active" : ""}`} aria-pressed={item.result === value} onClick={() => updateItem(item.id, { result: value })} key={value}>
                              {value === "compliant" ? <CheckCircle2 size={15} /> : value === "non_compliant" ? <ShieldAlert size={15} /> : <CircleMinus size={15} />}{label}
                            </button>
                          ))}
                        </div>
                        <label className="completion-item-notes"><span>Observação do item</span><textarea value={item.notes || ""} onChange={(event) => updateItem(item.id, { notes: event.target.value })} rows={2} placeholder="Descreva avaria, divergência ou detalhe observado..." /></label>
                      </article>
                    ))}
                  </section>
                );
              })}
            </div>
          )}

          {!loading && <label className="completion-general-notes"><span>Observações gerais da vistoria</span><textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} rows={4} placeholder="Registre considerações finais, ocorrências ou recomendações..." /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <div className="modal-actions property-modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={saving}>Voltar</button>
          <button className="button primary" type="button" onClick={() => void completeInspection()} disabled={saving || loading || items.length === 0}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? "Concluindo..." : "Salvar e concluir vistoria"}
          </button>
        </div>
      </div>
    </div>
  );
}
