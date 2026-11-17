"use client";

import { Building2, CalendarDays, ClipboardCheck, Clock3, DoorOpen, LoaderCircle, Printer, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { checklistItemCategoryLabel, type ChecklistItemCategory } from "@/lib/checklist-template";
import {
  formatInspectionDate,
  formatInspectionTime,
  inspectionEnvironmentTypeLabel,
  inspectionStatusLabel,
  inspectionTypeLabel,
  type InspectionEnvironmentRecord,
  type InspectionItemRecord,
  type InspectionRecord,
  type InspectorOption,
} from "@/lib/inspection";
import { formatPostalCode, type PropertyRecord } from "@/lib/property";
import { supabase } from "@/lib/supabase";

type ActiveChecklistTemplate = {
  id: string;
  environment_type: InspectionEnvironmentRecord["environment_type"];
  inspection_checklist_template_items: Array<{
    id: string;
    item_name: string;
    category: string;
    is_required: boolean;
    sort_order: number;
  }>;
};

function Detail({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "detail-item detail-item-wide" : "detail-item"}><dt>{label}</dt><dd>{value}</dd></div>;
}

export function InspectionDetailsModal({
  inspection,
  property,
  inspector,
  onClose,
}: {
  inspection: InspectionRecord;
  property?: PropertyRecord;
  inspector?: InspectorOption;
  onClose: () => void;
}) {
  const [environments, setEnvironments] = useState<InspectionEnvironmentRecord[]>([]);
  const [items, setItems] = useState<InspectionItemRecord[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(supabase ? "" : "Supabase não configurado.");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [onClose]);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    Promise.all([
      supabase
        .from("inspection_environments")
        .select("id, inspection_id, environment_type, name, sort_order, created_at")
        .eq("inspection_id", inspection.id)
        .order("sort_order"),
      supabase
        .from("inspection_items")
        .select("id, inspection_id, inspection_environment_id, item_name, category, condition, is_required, notes, created_at")
        .eq("inspection_id", inspection.id)
        .order("created_at"),
      supabase
        .from("inspection_checklist_templates")
        .select("id, environment_type, inspection_checklist_template_items!checklist_template_items_template_org_fk(id, item_name, category, is_required, sort_order)")
        .eq("is_active", true),
    ]).then(([environmentResult, itemResult, templateResult]) => {
        if (!active) return;
        if (environmentResult.error || itemResult.error) {
          setError(environmentResult.error?.message || itemResult.error?.message || "Não foi possível carregar ficha da vistoria.");
        } else {
          const loadedEnvironments = (environmentResult.data || []) as InspectionEnvironmentRecord[];
          const snapshotItems = (itemResult.data || []) as InspectionItemRecord[];
          const environmentsWithoutSnapshot = loadedEnvironments.filter((environment) =>
            !snapshotItems.some((item) => item.inspection_environment_id === environment.id));

          if (templateResult.error && environmentsWithoutSnapshot.length > 0) {
            setError(templateResult.error.message || "Não foi possível carregar checklists dos ambientes.");
          } else {
            const activeTemplates = (templateResult.data || []) as ActiveChecklistTemplate[];
            const fallbackItems = environmentsWithoutSnapshot.flatMap((environment) => {
              const template = activeTemplates.find((candidate) => candidate.environment_type === environment.environment_type);
              return (template?.inspection_checklist_template_items || [])
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((item) => ({
                  id: `template-${environment.id}-${item.id}`,
                  inspection_id: inspection.id,
                  inspection_environment_id: environment.id,
                  item_name: item.item_name,
                  category: item.category,
                  condition: "pending" as const,
                  is_required: item.is_required,
                  notes: null,
                  created_at: "",
                }));
            });
            setEnvironments(loadedEnvironments);
            setItems([...snapshotItems, ...fallbackItems]);
          }
        }
        setLoading(false);
      });
    return () => { active = false; };
  }, [inspection.id]);

  const printInspection = () => {
    const previousTitle = document.title;
    document.title = `Ficha de vistoria ${inspection.inspection_number} - ${property?.name || "Imóvel"}`;
    window.print();
    document.title = previousTitle;
  };

  const propertyAddress = property
    ? `${property.address_line}, ${property.no_number ? "s/nº" : property.street_number} · ${property.district || "Bairro não informado"} · ${property.city}/${property.state} · CEP ${formatPostalCode(property.postal_code)}`
    : "Imóvel não encontrado";

  return (
    <div className="modal-layer property-modal-layer inspection-print-layer" role="presentation">
      <div className="modal property-modal details-modal inspection-details-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-details-title">
        <div className="modal-head property-modal-head">
          <div><span>VISUALIZAÇÃO DA VISTORIA</span><h2 id="inspection-details-title">Vistoria #{inspection.inspection_number}</h2><p>Consulta somente leitura.</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={21} /></button>
        </div>

        <div className="property-form-body details-body inspection-screen-details">
          <section className="detail-section">
            <h3><ClipboardCheck size={17} /> Identificação</h3>
            <dl className="detail-grid">
              <Detail label="ID da vistoria" value={`#${inspection.inspection_number}`} />
              <Detail label="Tipo" value={inspectionTypeLabel(inspection.inspection_type)} />
              <Detail label="Status" value={<span className={`inspection-status inspection-status-${inspection.status}`}>{inspectionStatusLabel(inspection.status)}</span>} />
              <Detail label="Cômodos vistoriados" value={inspection.room_count} />
              <Detail label="Data" value={<span className="inspection-date"><CalendarDays size={14} />{formatInspectionDate(inspection.scheduled_at)}</span>} />
              <Detail label="Horário" value={<span className="inspection-date"><Clock3 size={14} />{formatInspectionTime(inspection.scheduled_at)}</span>} />
              <Detail label="Responsável" value={<span className="inspection-date"><UserRound size={14} />{inspector?.full_name || "Usuário não encontrado"}</span>} wide />
            </dl>
          </section>

          <section className="detail-section">
            <h3><Building2 size={17} /> Imóvel vinculado</h3>
            <dl className="detail-grid">
              <Detail label="Imóvel" value={property ? `#${property.property_number} · ${property.name}` : "Imóvel não encontrado"} wide />
              <Detail label="CEP" value={property ? formatPostalCode(property.postal_code) : "—"} />
              <Detail label="Cidade/UF" value={property ? `${property.city}/${property.state}` : "—"} />
              <Detail label="Endereço" value={property ? `${property.address_line}, ${property.no_number ? "s/nº" : property.street_number} · ${property.district}` : "—"} wide />
            </dl>
          </section>

          <section className="detail-section">
            <h3><DoorOpen size={17} /> Ambientes para vistoriar</h3>
            {loading ? (
              <div className="inspection-environment-loading"><LoaderCircle className="spin" size={20} /> Carregando ambientes...</div>
            ) : error ? (
              <p className="form-error" role="alert">{error}</p>
            ) : (
              <div className="inspection-detail-environments">
                {environments.length === 0 ? (
                  <div className="environment-empty"><DoorOpen size={21} /><span>Nenhum ambiente cadastrado.</span></div>
                ) : environments.map((environment, index) => (
                  <div className="inspection-detail-environment" key={environment.id}>
                    <span>{index + 1}</span>
                    <DoorOpen size={16} />
                    <div><strong>{environment.name}</strong><small>{inspectionEnvironmentTypeLabel(environment.environment_type)}</small></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="inspection-print-sheet" aria-label="Ficha de vistoria para impressão">
          <header className="print-sheet-header">
            <span className="print-sheet-logo"><ClipboardCheck size={25} /></span>
            <div><strong>IMOBITEC</strong><h1>Ficha de vistoria do imóvel</h1><p>Checklist para preenchimento manual</p></div>
            <div className="print-sheet-code"><span>VISTORIA</span><strong>#{inspection.inspection_number}</strong></div>
          </header>

          <div className="inspection-print-summary">
            <div className="inspection-print-property"><span>IMÓVEL</span><strong>{property ? `#${property.property_number} · ${property.name}` : "Imóvel não encontrado"}</strong><small>{propertyAddress}</small></div>
            <div><span>TIPO</span><strong>{inspectionTypeLabel(inspection.inspection_type)}</strong></div>
            <div><span>DATA</span><strong>{formatInspectionDate(inspection.scheduled_at)}</strong></div>
            <div><span>HORÁRIO</span><strong>{formatInspectionTime(inspection.scheduled_at)}</strong></div>
            <div className="inspection-print-inspector"><span>RESPONSÁVEL</span><strong>{inspector?.full_name || "Usuário não encontrado"}</strong></div>
          </div>

          <p className="inspection-print-guidance"><strong>Orientação:</strong> marque uma condição para cada item. Use observações quando houver avaria, divergência ou necessidade de manutenção.</p>

          <div className="inspection-print-rooms">
            {environments.map((environment, environmentIndex) => {
              const environmentItems = items.filter((item) => item.inspection_environment_id === environment.id);
              return (
                <article className="inspection-print-room" key={environment.id}>
                  <header>
                    <div><span>AMBIENTE {String(environmentIndex + 1).padStart(2, "0")}</span><h2>{environment.name}</h2><p>{inspectionEnvironmentTypeLabel(environment.environment_type)}</p></div>
                    <strong>{environmentItems.length} {environmentItems.length === 1 ? "item" : "itens"}</strong>
                  </header>
                  {environmentItems.length > 0 ? (
                    <table className="inspection-print-checklist">
                      <thead><tr><th>Item a inspecionar</th><th>Conforme</th><th>Atenção</th><th>Não conforme</th><th>N/A</th></tr></thead>
                      <tbody>
                        {environmentItems.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.item_name}</strong><small>{checklistItemCategoryLabel(item.category as ChecklistItemCategory)}{item.is_required ? " · Obrigatório" : " · Opcional"}</small></td>
                            <td><i /></td><td><i /></td><td><i /></td><td><i /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="inspection-print-no-items">Nenhum item de checklist copiado para este ambiente.</div>
                  )}
                  <div className="inspection-print-notes"><strong>Observações do ambiente</strong><span /><span /></div>
                </article>
              );
            })}
          </div>

          <section className="inspection-print-general-notes"><strong>Observações gerais e ocorrências</strong><span /><span /><span /></section>
          <section className="inspection-print-signatures">
            <div><span /><strong>Responsável pela vistoria</strong><small>{inspector?.full_name || "Nome e assinatura"}</small></div>
            <div><span /><strong>Responsável pelo imóvel</strong><small>Nome e assinatura</small></div>
            <div className="inspection-print-date-signature"><span /><strong>Data</strong><small>____/____/________</small></div>
          </section>
          <footer className="print-sheet-footer"><span>Imobitec · Vistoria &amp; Qualidade</span><span>Ficha de vistoria #{inspection.inspection_number} · {environments.length} ambientes</span></footer>
        </section>

        <div className="modal-actions property-modal-actions">
          <button className="button secondary" type="button" onClick={printInspection} disabled={loading || Boolean(error)} title={error || undefined}><Printer size={17} /> Imprimir</button>
          <button className="button primary" type="button" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
