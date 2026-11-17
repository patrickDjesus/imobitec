"use client";

import { AlertTriangle, BarChart3, Building2, CheckCircle2, ClipboardCheck, Clock3 } from "lucide-react";
import { calculateDashboardMetrics } from "@/lib/dashboard";
import { formatInspectionDate, inspectionStatusLabel, inspectionTypeLabel, type InspectionRecord } from "@/lib/inspection";
import {
  isOpenNonconformity,
  nonconformityConditionLabel,
  nonconformitySeverityLabel,
  type NonconformityRecord,
} from "@/lib/nonconformity";
import type { PropertyRecord } from "@/lib/property";
import { qualityLevel } from "@/lib/quality";

export function DashboardView({
  properties,
  inspections,
  issues,
  loading,
}: {
  properties: PropertyRecord[];
  inspections: InspectionRecord[];
  issues: NonconformityRecord[];
  loading: boolean;
}) {
  const metrics = calculateDashboardMetrics(properties, inspections, issues);
  const recentInspections = inspections.slice(0, 5);
  const recentIssues = issues.filter((issue) => isOpenNonconformity(issue.status));
  const propertyLabel = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    return property ? `#${property.property_number} · ${property.name}` : "Imóvel não encontrado";
  };

  return (
    <>
      <div className="metric-grid">
        <DashboardMetric label="Índice médio de qualidade" value={metrics.averageQuality === null ? "—" : `${metrics.averageQuality}%`} detail={metrics.averageQuality === null ? "Aguardando vistorias concluídas" : qualityLevel(metrics.averageQuality)} icon={BarChart3} />
        <DashboardMetric label="Correções pendentes" value={String(metrics.openIssues)} detail={`${metrics.nonCompliantIssues} não conforme · ${metrics.attentionIssues} atenção`} icon={Clock3} />
        <DashboardMetric label="Tempo médio de correção" value={metrics.averageResolutionDays === null ? "—" : `${metrics.averageResolutionDays}d`} detail={metrics.averageResolutionDays === null ? "Aguardando correções validadas" : "Entre abertura e validação"} icon={CheckCircle2} />
        <DashboardMetric label="Vistorias no mês" value={String(metrics.inspectionsThisMonth)} detail={`${metrics.completedInspections} concluída(s) no total`} icon={ClipboardCheck} />
      </div>

      {loading ? (
        <article className="panel empty-dashboard-panel dashboard-loading">Atualizando indicadores...</article>
      ) : properties.length === 0 && inspections.length === 0 && issues.length === 0 ? (
        <article className="panel empty-dashboard-panel dashboard-empty">
          <Building2 size={28} />
          <div><strong>Nenhum dado operacional</strong><span>Cadastros e movimentações aparecerão automaticamente aqui.</span></div>
        </article>
      ) : (
        <div className="dashboard-grid operational-dashboard-grid">
          <article className="panel recent-panel dashboard-recent-panel">
            <div className="panel-header"><div><h2 className="panel-title">Vistorias recentes</h2><span>Agenda e resultados mais recentes</span></div><ClipboardCheck size={19} /></div>
            {recentInspections.length === 0 ? <p className="dashboard-panel-empty">Nenhuma vistoria cadastrada.</p> : (
              <div className="table-wrap dashboard-table-wrap">
                <table>
                  <thead><tr><th>Vistoria</th><th>Imóvel</th><th>Data</th><th>Status</th><th>Qualidade</th></tr></thead>
                  <tbody>{recentInspections.map((inspection) => (
                    <tr key={inspection.id}>
                      <td><strong>#{inspection.inspection_number}</strong><small className="dashboard-cell-note">{inspectionTypeLabel(inspection.inspection_type)}</small></td>
                      <td>{propertyLabel(inspection.property_id)}</td>
                      <td>{formatInspectionDate(inspection.scheduled_at)}</td>
                      <td><span className={`inspection-status inspection-status-${inspection.status}`}>{inspectionStatusLabel(inspection.status)}</span></td>
                      <td><strong>{inspection.quality_score === null ? "—" : `${inspection.quality_score}%`}</strong></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </article>

          <article className="panel dashboard-issues-panel">
            <div className="panel-header"><div><h2 className="panel-title">Pendências prioritárias</h2><span>Itens aguardando correção</span></div><AlertTriangle size={19} /></div>
            {recentIssues.length === 0 ? <p className="dashboard-panel-empty">Nenhuma correção pendente.</p> : (
              <div className="attention-list dashboard-priority-list">{recentIssues.map((issue) => (
                <div className="attention-item dashboard-attention-item" key={issue.id}>
                  <span className={`severity-dot severity-${issue.severity}`}><AlertTriangle size={16} /></span>
                  <div><strong>{issue.title}</strong><span>{propertyLabel(issue.property_id)}</span><small>{nonconformityConditionLabel(issue.source_condition)} · Severidade {nonconformitySeverityLabel(issue.severity).toLowerCase()}</small></div>
                </div>
              ))}</div>
            )}
          </article>
        </div>
      )}
    </>
  );
}

function DashboardMetric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span>{label}</span><Icon size={20} /></div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot">{detail}</div>
    </article>
  );
}
