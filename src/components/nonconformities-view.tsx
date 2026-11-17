"use client";

import { AlertTriangle, Building2, CheckCircle2, ClipboardCheck, Clock3, LoaderCircle, LockKeyhole, PlayCircle, Send } from "lucide-react";
import { useMemo, useState } from "react";
import type { InspectionRecord } from "@/lib/inspection";
import {
  canUserValidateNonconformity,
  isOpenNonconformity,
  nextNonconformityStatus,
  nonconformityConditionLabel,
  nonconformitySeverityLabel,
  nonconformityStatusLabel,
  type NonconformityRecord,
  type NonconformityStatus,
} from "@/lib/nonconformity";
import type { PropertyRecord } from "@/lib/property";

type IssueFilter = "pending" | "attention" | "non_compliant" | "resolved" | "all";

export function NonconformitiesView({
  issues,
  inspections,
  properties,
  loading,
  error,
  currentUserId,
  onStatusChange,
}: {
  issues: NonconformityRecord[];
  inspections: InspectionRecord[];
  properties: PropertyRecord[];
  loading: boolean;
  error: string;
  currentUserId: string;
  onStatusChange: (issue: NonconformityRecord, status: NonconformityStatus) => Promise<void>;
}) {
  const [filter, setFilter] = useState<IssueFilter>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const counts = useMemo(() => ({
    pending: issues.filter((issue) => isOpenNonconformity(issue.status)).length,
    attention: issues.filter((issue) => isOpenNonconformity(issue.status) && issue.source_condition === "attention").length,
    non_compliant: issues.filter((issue) => isOpenNonconformity(issue.status) && issue.source_condition === "non_compliant").length,
    resolved: issues.filter((issue) => issue.status === "validated" || issue.status === "cancelled").length,
    all: issues.length,
  }), [issues]);
  const filteredIssues = issues.filter((issue) => {
    if (filter === "pending") return isOpenNonconformity(issue.status);
    if (filter === "resolved") return issue.status === "validated" || issue.status === "cancelled";
    if (filter === "attention" || filter === "non_compliant") return isOpenNonconformity(issue.status) && issue.source_condition === filter;
    return true;
  });
  const propertyLabel = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    return property ? `#${property.property_number} · ${property.name}` : "Imóvel não encontrado";
  };
  const inspectionLabel = (inspectionId: string) => {
    const inspection = inspections.find((item) => item.id === inspectionId);
    return inspection ? `Vistoria #${inspection.inspection_number}` : "Vistoria não encontrada";
  };
  const changeStatus = async (issue: NonconformityRecord, status: NonconformityStatus) => {
    setUpdatingId(issue.id);
    try { await onStatusChange(issue, status); } finally { setUpdatingId(null); }
  };

  if (loading) return <article className="panel empty-state compact-empty-state"><div className="empty-state-content"><span className="empty-state-icon"><LoaderCircle className="spin" size={28} /></span><h2>Carregando pendências</h2><p>Consultando resultados das vistorias.</p></div></article>;
  if (error) return <article className="panel empty-state compact-empty-state schema-warning"><div className="empty-state-content"><span className="empty-state-icon"><AlertTriangle size={28} /></span><h2>Banco aguardando configuração</h2><p>{error}</p></div></article>;
  if (issues.length === 0) return <article className="panel empty-state compact-empty-state"><div className="empty-state-content"><span className="empty-state-icon"><CheckCircle2 size={28} /></span><h2>Nenhuma não conformidade</h2><p>Itens marcados como Atenção ou Não conforme aparecerão aqui após conclusão da vistoria.</p></div></article>;

  const filters: ReadonlyArray<readonly [IssueFilter, string]> = [
    ["pending", "Pendentes"], ["non_compliant", "Não conformes"], ["attention", "Atenção"], ["resolved", "Finalizadas"], ["all", "Todas"],
  ];

  return (
    <div className="issues-layout operational-issues-layout">
      <article className="panel issue-board">
        <div className="toolbar issue-toolbar"><div className="filter-group">{filters.map(([value, label]) => <button type="button" className={`filter-chip ${filter === value ? "active" : ""}`} onClick={() => setFilter(value)} key={value}>{label}<b>{counts[value]}</b></button>)}</div></div>
        {filteredIssues.length === 0 ? <p className="issues-filter-empty">Nenhum registro neste filtro.</p> : <div className="issues-scroll-list">{filteredIssues.map((issue) => {
          const canValidate = canUserValidateNonconformity(issue.inspection_id, inspections, currentUserId);
          const next = nextNonconformityStatus(issue.status, canValidate);
          return (
            <section className="issue-row operational-issue-row" key={issue.id}>
              <span className="issue-id">#{issue.id.slice(0, 8).toUpperCase()}</span>
              <div className="issue-main">
                <div><strong>{issue.title}</strong><span className={`issue-condition issue-condition-${issue.source_condition}`}>{nonconformityConditionLabel(issue.source_condition)}</span></div>
                <p className="issue-description">{issue.description || "Sem observação registrada."}</p>
                <small><Building2 size={13} />{propertyLabel(issue.property_id)}<ClipboardCheck size={13} />{inspectionLabel(issue.inspection_id)}</small>
                <div className="issue-meta"><span>Severidade: {nonconformitySeverityLabel(issue.severity)}</span><span>Prazo: {issue.due_date ? new Date(`${issue.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não definido"}</span></div>
              </div>
              <div className="issue-status operational-issue-status">
                <span className={`status-dot issue-status-${issue.status}`}>{nonconformityStatusLabel(issue.status)}</span>
                {next && <button className="button secondary issue-action-button" type="button" disabled={updatingId === issue.id} onClick={() => void changeStatus(issue, next.status)}>
                  {updatingId === issue.id ? <LoaderCircle className="spin" size={15} /> : next.status === "in_progress" ? <PlayCircle size={15} /> : next.status === "awaiting_validation" ? <Send size={15} /> : <CheckCircle2 size={15} />}{next.label}
                </button>}
                {issue.status === "awaiting_validation" && !canValidate && <span className="issue-validation-owner"><LockKeyhole size={13} />Validação exclusiva do responsável pela vistoria</span>}
              </div>
            </section>
          );
        })}</div>}
      </article>

      <aside className="panel side-summary operational-issue-summary">
        <h2 className="panel-title">Resumo das pendências</h2>
        <div className="issue-summary-total"><AlertTriangle size={22} /><div><strong>{counts.pending}</strong><span>aguardando correção</span></div></div>
        <dl>
          <div><dt><i className="dot critical" />Não conformes</dt><dd>{counts.non_compliant}</dd></div>
          <div><dt><i className="dot medium" />Atenção</dt><dd>{counts.attention}</dd></div>
          <div><dt><i className="dot high" />Em andamento</dt><dd>{issues.filter((issue) => issue.status === "in_progress").length}</dd></div>
          <div><dt><i className="dot" />Aguardando validação</dt><dd>{issues.filter((issue) => issue.status === "awaiting_validation").length}</dd></div>
        </dl>
        <p className="summary-note"><Clock3 size={15} />Pendência só sai do total após validação ou cancelamento.</p>
      </aside>
    </div>
  );
}
