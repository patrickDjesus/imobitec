"use client";

import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Pencil,
  Plus,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import Image from "next/image";
import { isBasicEmailFormat, signupErrorMessage } from "@/lib/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { NonconformitiesView } from "@/components/nonconformities-view";
import { PropertyModal } from "@/components/property-modal";
import { PropertyDeleteModal } from "@/components/property-delete-modal";
import { PropertyDetailsModal } from "@/components/property-details-modal";
import { InspectionDeleteModal } from "@/components/inspection-delete-modal";
import { InspectionDetailsModal } from "@/components/inspection-details-modal";
import { InspectionModal } from "@/components/inspection-modal";
import { InspectionCompletionModal } from "@/components/inspection-completion-modal";
import { ChecklistTemplateModal } from "@/components/checklist-template-modal";
import { ChecklistTemplatesView } from "@/components/checklist-templates-view";
import { ChecklistTemplateDetailsModal } from "@/components/checklist-template-details-modal";
import { ChecklistTemplateDeleteModal } from "@/components/checklist-template-delete-modal";
import type { ChecklistTemplateItemRecord, ChecklistTemplateRecord } from "@/lib/checklist-template";
import { calculateDashboardMetrics } from "@/lib/dashboard";
import {
  formatInspectionDate,
  formatInspectionTime,
  inspectionStatusLabel,
  inspectionTypeLabel,
  type InspectionRecord,
  type InspectorOption,
} from "@/lib/inspection";
import {
  getUpcomingNonconformities,
  nonconformityConditionLabel,
  nonconformitySeverityLabel,
  type NonconformityRecord,
  type NonconformityStatus,
} from "@/lib/nonconformity";
import {
  formatPostalCode,
  propertyStatusLabel,
  propertyTypeLabel,
  type PropertyRecord,
} from "@/lib/property";
import { supabase } from "@/lib/supabase";

type View = "dashboard" | "properties" | "inspections" | "catalogs" | "issues";

type UserProfile = {
  id: string;
  full_name: string | null;
  role: "admin" | "manager" | "inspector";
  is_active: boolean;
  organization_id: string;
};

const navItems = [
  { id: "dashboard" as View, label: "Visão geral", icon: LayoutDashboard },
  { id: "properties" as View, label: "Imóveis", icon: Building2 },
  { id: "inspections" as View, label: "Vistorias", icon: ClipboardCheck },
  { id: "catalogs" as View, label: "Cadastros", icon: ListChecks },
  { id: "issues" as View, label: "Não conformidades", icon: AlertTriangle },
];

const viewTitles: Record<View, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "VISÃO GERAL",
    title: "Painel inicial",
    description: "Indicadores atualizados conforme cadastros, vistorias e correções.",
  },
  properties: {
    eyebrow: "CARTEIRA",
    title: "Imóveis",
    description: "Cadastros de imóveis aparecerão aqui.",
  },
  inspections: {
    eyebrow: "CONTROLE",
    title: "Vistorias",
    description: "Vistorias realizadas e agendadas aparecerão aqui.",
  },
  catalogs: {
    eyebrow: "PADRONIZAÇÃO",
    title: "Cadastros",
    description: "Modelos e listas reutilizáveis para execução das vistorias.",
  },
  issues: {
    eyebrow: "PLANO DE AÇÃO",
    title: "Não conformidades",
    description: "Itens de Atenção e Não conformes aguardando tratamento e validação.",
  },
};

export default function HomePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [profileLoading, setProfileLoading] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertyToEdit, setPropertyToEdit] = useState<PropertyRecord | null>(null);
  const [propertyToView, setPropertyToView] = useState<PropertyRecord | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<PropertyRecord | null>(null);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [inspectionsError, setInspectionsError] = useState("");
  const [inspectorsError, setInspectorsError] = useState("");
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionToEdit, setInspectionToEdit] = useState<InspectionRecord | null>(null);
  const [inspectionToView, setInspectionToView] = useState<InspectionRecord | null>(null);
  const [inspectionToDelete, setInspectionToDelete] = useState<InspectionRecord | null>(null);
  const [inspectionToComplete, setInspectionToComplete] = useState<InspectionRecord | null>(null);
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplateRecord[]>([]);
  const [checklistTemplatesLoading, setChecklistTemplatesLoading] = useState(false);
  const [checklistTemplatesError, setChecklistTemplatesError] = useState("");
  const [checklistTemplateModalOpen, setChecklistTemplateModalOpen] = useState(false);
  const [checklistTemplateToEdit, setChecklistTemplateToEdit] = useState<ChecklistTemplateRecord | null>(null);
  const [checklistTemplateToView, setChecklistTemplateToView] = useState<ChecklistTemplateRecord | null>(null);
  const [checklistTemplateToDelete, setChecklistTemplateToDelete] = useState<ChecklistTemplateRecord | null>(null);
  const [issues, setIssues] = useState<NonconformityRecord[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    const authenticated = Boolean(nextSession);
    setSession(nextSession);
    setProfile(null);
    setProfileLoading(authenticated);
    setPropertiesLoading(authenticated);
    setChecklistTemplatesLoading(authenticated);
    setInspectionsLoading(authenticated);
    setIssuesLoading(authenticated);
    setPropertiesError("");
    setChecklistTemplatesError("");
    setInspectionsError("");
    setInspectorsError("");
    setIssuesError("");
    setAuthLoading(false);

    if (!authenticated) {
      setProperties([]);
      setChecklistTemplates([]);
      setInspections([]);
      setInspectors([]);
      setIssues([]);
    }
  }, []);

  const loadNonconformities = useCallback(async () => {
    if (!session || !supabase) return;
    const { data, error } = await supabase
      .from("nonconformities")
      .select("id, inspection_id, inspection_item_id, property_id, title, description, source_condition, severity, status, assigned_to, due_date, resolved_at, validated_at, validated_by, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      const schemaPending = ["42P01", "42703", "PGRST204"].includes(error.code || "");
      setIssuesError(schemaPending
        ? "Execute banco-de-dados/migracoes/014_nao_conformidades_dashboard.sql no Supabase para ativar o fluxo."
        : "Não foi possível carregar não conformidades.");
    } else {
      setIssues((data || []) as NonconformityRecord[]);
    }
    setIssuesLoading(false);
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      if (active) applySession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      applySession(nextSession);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    let active = true;
    if (!session || !supabase) return;

    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, organization_id")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (active && data) setProfile(data as UserProfile);
        if (active) setProfileLoading(false);
      }, () => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session || !supabase) return;

    supabase
      .from("properties")
      .select("*")
      .order("property_number", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const missingSchema = error.code === "42703" || error.code === "PGRST204";
          setPropertiesError(missingSchema
            ? "Execute banco-de-dados/migracoes/003_cadastro_imoveis.sql no Supabase para ativar o cadastro."
            : "Não foi possível carregar os imóveis.");
        } else {
          setProperties((data || []) as PropertyRecord[]);
        }
        setPropertiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session || !supabase) return;

    supabase
      .from("nonconformities")
      .select("id, inspection_id, inspection_item_id, property_id, title, description, source_condition, severity, status, assigned_to, due_date, resolved_at, validated_at, validated_by, created_at, updated_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const schemaPending = ["42P01", "42703", "PGRST204"].includes(error.code || "");
          setIssuesError(schemaPending
            ? "Execute banco-de-dados/migracoes/014_nao_conformidades_dashboard.sql no Supabase para ativar o fluxo."
            : "Não foi possível carregar não conformidades.");
        } else {
          setIssues((data || []) as NonconformityRecord[]);
        }
        setIssuesLoading(false);
      });

    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session || !supabase) return;
    supabase
      .from("inspection_checklist_templates")
      .select("id, name, environment_type, is_active, created_at, inspection_checklist_template_items!checklist_template_items_template_org_fk(id, template_id, item_name, category, is_required, sort_order, created_at)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          const schemaPending = ["42P01", "42703", "PGRST200", "PGRST204"].includes(error.code || "");
          setChecklistTemplatesError(schemaPending
            ? "Execute banco-de-dados/migracoes/009_modelos_checklist_vistoria.sql no Supabase para ativar os cadastros."
            : "Não foi possível carregar modelos de checklist.");
        } else {
          const templates = (data || []).map((row) => {
            const nestedItems = (row.inspection_checklist_template_items || []) as ChecklistTemplateItemRecord[];
            return {
              id: row.id,
              name: row.name,
              environment_type: row.environment_type,
              is_active: row.is_active,
              created_at: row.created_at,
              items: [...nestedItems].sort((a, b) => a.sort_order - b.sort_order),
            } as ChecklistTemplateRecord;
          });
          setChecklistTemplates(templates);
        }
        setChecklistTemplatesLoading(false);
      });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    let active = true;
    if (!session || !supabase) return;

    Promise.all([
      supabase.from("inspections").select("*").order("inspection_number", { ascending: false }),
      supabase.from("profiles").select("id, full_name, role, is_active").eq("is_active", true).order("full_name"),
    ]).then(([inspectionResult, inspectorResult]) => {
      if (!active) return;

      if (inspectionResult.error) {
        const schemaPending = inspectionResult.error.code === "42703" || inspectionResult.error.code === "PGRST204";
        setInspectionsError(schemaPending
          ? "Execute banco-de-dados/migracoes/005_cadastro_vistorias.sql no Supabase para ativar o cadastro."
          : "Não foi possível carregar as vistorias.");
      } else {
        setInspections((inspectionResult.data || []) as InspectionRecord[]);
      }

      if (inspectorResult.error) {
        setInspectorsError("Não foi possível carregar usuários responsáveis.");
      } else {
        setInspectors((inspectorResult.data || []) as InspectorOption[]);
      }
      setInspectionsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const signOut = async () => {
    await supabase?.auth.signOut({ scope: "local" });
    setView("dashboard");
  };

  const metadataName = session?.user.user_metadata.full_name;
  const displayName =
    profile?.full_name?.trim() ||
    (typeof metadataName === "string" ? metadataName.trim() : "") ||
    "Usuário";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("");
  const roleLabel =
    profile?.role === "admin"
      ? "Administrador"
      : profile?.role === "manager"
        ? "Gestor"
        : "Inspetor";
  const canManageProperties = profile?.role === "admin" || profile?.role === "manager";
  const canDeleteProperties = profile?.role === "admin";
  const canDeleteInspections = profile?.role === "admin";
  const canManageCatalogs = profile?.role === "admin" || profile?.role === "manager";
  const canDeleteCatalogs = profile?.role === "admin";
  const openPropertyModal = () => {
    if (!canManageProperties) {
      showToast("Somente administradores e gestores podem cadastrar imóveis.");
      return;
    }
    setPropertyToEdit(null);
    setPropertyModalOpen(true);
  };
  const openPropertyEditor = (property: PropertyRecord) => {
    if (!canManageProperties) {
      showToast("Somente administradores e gestores podem editar imóveis.");
      return;
    }
    setPropertyToEdit(property);
    setPropertyModalOpen(true);
  };
  const openPropertyDelete = (property: PropertyRecord) => {
    if (!canDeleteProperties) {
      showToast("Somente administradores podem excluir imóveis.");
      return;
    }
    setPropertyToDelete(property);
  };
  const openInspectionModal = () => {
    if (propertiesLoading) {
      showToast("Aguarde o carregamento dos imóveis.");
      return;
    }
    if (propertiesError || !properties.some((property) => property.status === "active")) {
      showToast("Cadastre ou ative pelo menos um imóvel antes de criar uma vistoria.");
      return;
    }
    if (inspectorsError || inspectors.length === 0) {
      showToast(inspectorsError || "Nenhum usuário ativo disponível como responsável.");
      return;
    }
    setInspectionToEdit(null);
    setInspectionModalOpen(true);
  };
  const openInspectionEditor = (inspection: InspectionRecord) => {
    if (inspection.status === "completed") {
      setInspectionToComplete(inspection);
      return;
    }
    if (inspectorsError || inspectors.length === 0) {
      showToast(inspectorsError || "Nenhum usuário ativo disponível como responsável.");
      return;
    }
    setInspectionToEdit(inspection);
    setInspectionModalOpen(true);
  };
  const openInspectionDelete = (inspection: InspectionRecord) => {
    if (!canDeleteInspections) {
      showToast("Somente administradores podem excluir vistorias.");
      return;
    }
    setInspectionToDelete(inspection);
  };
  const openChecklistTemplateModal = () => {
    if (!canManageCatalogs) {
      showToast("Somente administradores e gestores podem cadastrar checklists.");
      return;
    }
    setChecklistTemplateToEdit(null);
    setChecklistTemplateModalOpen(true);
  };
  const openChecklistTemplateEditor = (template: ChecklistTemplateRecord) => {
    if (!canManageCatalogs) {
      showToast("Somente administradores e gestores podem editar checklists.");
      return;
    }
    setChecklistTemplateToEdit(template);
    setChecklistTemplateModalOpen(true);
  };
  const openChecklistTemplateDelete = (template: ChecklistTemplateRecord) => {
    if (!canDeleteCatalogs) {
      showToast("Somente administradores podem excluir checklists.");
      return;
    }
    setChecklistTemplateToDelete(template);
  };
  const updateNonconformityStatus = async (issue: NonconformityRecord, status: NonconformityStatus) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .rpc("update_nonconformity_status", { p_nonconformity_id: issue.id, p_status: status })
      .single();
    if (error || !data) {
      const schemaPending = ["42883", "PGRST202"].includes(error?.code || "");
      showToast(schemaPending
        ? "Execute banco-de-dados/migracoes/014_nao_conformidades_dashboard.sql no Supabase."
        : error?.message || "Não foi possível atualizar pendência.");
      return;
    }
    setIssues((current) => current.map((item) => item.id === issue.id ? data as NonconformityRecord : item));
    showToast(`Pendência atualizada para “${status === "in_progress" ? "Em correção" : status === "awaiting_validation" ? "Aguardando validação" : "Validada"}”.`);
  };
  const filteredProperties = properties.filter((property) =>
    `${property.property_number} ${property.name} ${property.address_line} ${property.district || ""} ${property.city}`
      .toLowerCase()
      .includes(propertySearch.toLowerCase()),
  );
  const dashboardMetrics = useMemo(
    () => calculateDashboardMetrics(properties, inspections, issues),
    [properties, inspections, issues],
  );
  const upcomingIssues = useMemo(() => getUpcomingNonconformities(issues), [issues]);

  useEffect(() => {
    if (!notificationOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !notificationRef.current?.contains(event.target)) {
        setNotificationOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationOpen]);

  const notificationPropertyLabel = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    return property ? `#${property.property_number} · ${property.name}` : "Imóvel não encontrado";
  };

  if (authLoading || (session && profileLoading)) return <AuthLoading />;
  if (!session) return <LoginScreen />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <Image className="brand-logo" src="/favicon.svg" alt="" width={42} height={42} priority />
          <div>
            <strong>Imobitec</strong>
            <span>Vistoria & Qualidade</span>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Navegação principal">
          <p className="nav-label">GESTÃO</p>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => {
                setView(item.id);
                setMobileMenu(false);
              }}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-quality">
          <div className="quality-icon"><Sparkles size={18} /></div>
          <p><strong>Qualidade da carteira</strong><span>{dashboardMetrics.averageQuality === null ? "Aguardando vistorias" : `${dashboardMetrics.completedInspections} concluída(s)`}</span></p>
          <strong className="quality-number">{dashboardMetrics.averageQuality === null ? "—" : `${dashboardMetrics.averageQuality}%`}</strong>
          <div className="quality-bar"><i style={{ width: `${dashboardMetrics.averageQuality ?? 0}%` }} /></div>
        </div>

        <button className="profile" onClick={signOut} title="Sair da conta">
          <div className="avatar">{initials || "US"}</div>
          <div><strong>{displayName}</strong><span>{roleLabel}</span></div>
          <LogOut size={16} />
        </button>
      </aside>

      {mobileMenu && <button className="backdrop" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu">
            <Menu size={21} />
          </button>
          <div className={`search-wrap ${view !== "properties" || properties.length === 0 ? "empty-search" : ""}`}>
            <Search size={18} />
            <input
              disabled={view !== "properties" || properties.length === 0}
              value={view === "properties" ? propertySearch : ""}
              onChange={(event) => setPropertySearch(event.target.value)}
              placeholder={view === "properties" && properties.length > 0 ? "Buscar imóvel..." : "Nenhum dado para buscar"}
              aria-label="Buscar imóvel"
            />
          </div>
          <div className="notification-wrap" ref={notificationRef}>
            <button
              className={`icon-button notification ${notificationOpen ? "active" : ""}`}
              aria-label={`${dashboardMetrics.openIssues} correções pendentes`}
              aria-expanded={notificationOpen}
              aria-controls="notification-popover"
              onClick={() => setNotificationOpen((current) => !current)}
            >
              <Bell size={19} />
              {dashboardMetrics.openIssues > 0 && <i>{dashboardMetrics.openIssues}</i>}
            </button>
            {notificationOpen && (
              <section id="notification-popover" className="notification-popover" role="dialog" aria-label="Pendências com prazo mais próximo">
                <header>
                  <div><strong>Próximas pendências</strong><span>Até 3 prazos mais próximos</span></div>
                  <button type="button" onClick={() => setNotificationOpen(false)} aria-label="Fechar notificações"><X size={16} /></button>
                </header>
                {issuesLoading ? (
                  <p className="notification-empty">Carregando pendências...</p>
                ) : issuesError ? (
                  <p className="notification-empty notification-error">Não foi possível carregar pendências.</p>
                ) : upcomingIssues.length === 0 ? (
                  <p className="notification-empty"><CheckCircle2 size={20} />Nenhuma correção pendente.</p>
                ) : (
                  <div className="notification-list">
                    {upcomingIssues.map((issue) => (
                      <article className="notification-item" key={issue.id}>
                        <span className={`notification-severity severity-${issue.severity}`}><AlertTriangle size={15} /></span>
                        <div>
                          <strong>{issue.title}</strong>
                          <span className={`issue-condition issue-condition-${issue.source_condition}`}>{nonconformityConditionLabel(issue.source_condition)}</span>
                          <small><Building2 size={12} />{notificationPropertyLabel(issue.property_id)}</small>
                          <small className="notification-deadline"><CalendarDays size={12} />Prazo: {issue.due_date ? new Date(`${issue.due_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não definido"} · {nonconformitySeverityLabel(issue.severity)}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </header>

        <section className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">{viewTitles[view].eyebrow}</p>
              <h1>{view === "dashboard" ? `Olá, ${displayName.split(" ")[0]}!` : viewTitles[view].title}</h1>
              <p>{viewTitles[view].description}</p>
            </div>
            {view === "properties" && (
              <button className="button primary" onClick={openPropertyModal}>
                <Plus size={17} /> Novo imóvel
              </button>
            )}
            {view === "inspections" && (
              <button className="button primary" onClick={openInspectionModal}>
                <Plus size={17} /> Nova vistoria
              </button>
            )}
            {view === "catalogs" && (
              <button className="button primary" onClick={openChecklistTemplateModal}>
                <Plus size={17} /> Novo checklist
              </button>
            )}
          </div>

          {view === "dashboard" && <DashboardView properties={properties} inspections={inspections} issues={issues} loading={propertiesLoading || inspectionsLoading || issuesLoading} />}
          {view === "properties" && (
            <PropertiesView
              properties={filteredProperties}
              loading={propertiesLoading}
              error={propertiesError}
              searching={Boolean(propertySearch)}
              onNew={openPropertyModal}
              onView={setPropertyToView}
              onEdit={openPropertyEditor}
              onDelete={openPropertyDelete}
            />
          )}
          {view === "inspections" && (
            <InspectionsView
              inspections={inspections}
              properties={properties}
              inspectors={inspectors}
              loading={inspectionsLoading}
              error={inspectionsError}
              onNew={openInspectionModal}
              onView={setInspectionToView}
              onEdit={openInspectionEditor}
              onDelete={openInspectionDelete}
            />
          )}
          {view === "catalogs" && (
            <ChecklistTemplatesView
              templates={checklistTemplates}
              loading={checklistTemplatesLoading}
              error={checklistTemplatesError}
              onNew={openChecklistTemplateModal}
              onView={setChecklistTemplateToView}
              onEdit={openChecklistTemplateEditor}
              onDelete={openChecklistTemplateDelete}
            />
          )}
          {view === "issues" && (
            <NonconformitiesView
              issues={issues}
              inspections={inspections}
              properties={properties}
              loading={issuesLoading}
              error={issuesError}
              currentUserId={session.user.id}
              onStatusChange={updateNonconformityStatus}
            />
          )}
        </section>
      </main>

      {propertyModalOpen && (
        <PropertyModal
          property={propertyToEdit}
          onClose={() => { setPropertyModalOpen(false); setPropertyToEdit(null); }}
          onSaved={(property) => {
            setProperties((current) => propertyToEdit
              ? current.map((item) => item.id === property.id ? property : item)
              : [property, ...current]);
            setPropertyModalOpen(false);
            setPropertyToEdit(null);
            showToast(`Imóvel #${property.property_number} ${propertyToEdit ? "atualizado" : "cadastrado"} com sucesso.`);
          }}
        />
      )}
      {propertyToView && <PropertyDetailsModal property={propertyToView} onClose={() => setPropertyToView(null)} />}
      {propertyToDelete && (
        <PropertyDeleteModal
          property={propertyToDelete}
          onClose={() => setPropertyToDelete(null)}
          onDeleted={(property) => {
            setProperties((current) => current.filter((item) => item.id !== property.id));
            setIssues((current) => current.filter((issue) => issue.property_id !== property.id));
            setPropertyToDelete(null);
            showToast(`Imóvel #${property.property_number} excluído do banco.`);
          }}
        />
      )}
      {inspectionModalOpen && (
        <InspectionModal
          inspection={inspectionToEdit}
          properties={properties.filter((property) => property.status === "active" || property.id === inspectionToEdit?.property_id)}
          inspectors={inspectors}
          currentUserId={session.user.id}
          onClose={() => { setInspectionModalOpen(false); setInspectionToEdit(null); }}
          onSaved={(inspection, completionRequested) => {
            const editing = Boolean(inspectionToEdit);
            setInspections((current) => editing
              ? current.map((item) => item.id === inspection.id ? inspection : item)
              : [inspection, ...current]);
            setInspectionModalOpen(false);
            setInspectionToEdit(null);
            setView("inspections");
            if (completionRequested) {
              setInspectionToComplete(inspection);
              showToast(`Dados da vistoria #${inspection.inspection_number} salvos. Preencha checklist para concluir.`);
            } else {
              showToast(`Vistoria #${inspection.inspection_number} ${editing ? "atualizada" : "cadastrada"} com sucesso.`);
            }
          }}
        />
      )}
      {inspectionToComplete && (
        <InspectionCompletionModal
          inspection={inspectionToComplete}
          property={properties.find((property) => property.id === inspectionToComplete.property_id)}
          onClose={() => setInspectionToComplete(null)}
          onCompleted={(inspection) => {
            setInspections((current) => current.map((item) => item.id === inspection.id ? inspection : item));
            setInspectionToComplete(null);
            void loadNonconformities();
            showToast(`Vistoria #${inspection.inspection_number} concluída com sucesso.`);
          }}
        />
      )}
      {inspectionToView && (
        <InspectionDetailsModal
          inspection={inspectionToView}
          property={properties.find((property) => property.id === inspectionToView.property_id)}
          inspector={inspectors.find((inspector) => inspector.id === inspectionToView.inspector_id)}
          onClose={() => setInspectionToView(null)}
        />
      )}
      {inspectionToDelete && (
        <InspectionDeleteModal
          inspection={inspectionToDelete}
          onClose={() => setInspectionToDelete(null)}
          onDeleted={(inspection) => {
            setInspections((current) => current.filter((item) => item.id !== inspection.id));
            setIssues((current) => current.filter((issue) => issue.inspection_id !== inspection.id));
            setInspectionToDelete(null);
            showToast(`Vistoria #${inspection.inspection_number} excluída do banco.`);
          }}
        />
      )}
      {checklistTemplateModalOpen && (
        <ChecklistTemplateModal
          template={checklistTemplateToEdit}
          templates={checklistTemplates}
          onClose={() => { setChecklistTemplateModalOpen(false); setChecklistTemplateToEdit(null); }}
          onSaved={(template) => {
            const editing = Boolean(checklistTemplateToEdit);
            setChecklistTemplates((current) => editing
              ? current.map((item) => item.id === template.id ? template : item)
              : [template, ...current]);
            setChecklistTemplateModalOpen(false);
            setChecklistTemplateToEdit(null);
            setView("catalogs");
            showToast(`Checklist “${template.name}” ${editing ? "atualizado" : "cadastrado"} com sucesso.`);
          }}
        />
      )}
      {checklistTemplateToView && (
        <ChecklistTemplateDetailsModal
          template={checklistTemplateToView}
          onClose={() => setChecklistTemplateToView(null)}
        />
      )}
      {checklistTemplateToDelete && (
        <ChecklistTemplateDeleteModal
          template={checklistTemplateToDelete}
          onClose={() => setChecklistTemplateToDelete(null)}
          onDeleted={(template) => {
            setChecklistTemplates((current) => current.filter((item) => item.id !== template.id));
            setChecklistTemplateToDelete(null);
            showToast(`Checklist “${template.name}” excluído do banco.`);
          }}
        />
      )}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function InspectionsView({
  inspections,
  properties,
  inspectors,
  loading,
  error,
  onNew,
  onView,
  onEdit,
  onDelete,
}: {
  inspections: InspectionRecord[];
  properties: PropertyRecord[];
  inspectors: InspectorOption[];
  loading: boolean;
  error: string;
  onNew: () => void;
  onView: (inspection: InspectionRecord) => void;
  onEdit: (inspection: InspectionRecord) => void;
  onDelete: (inspection: InspectionRecord) => void;
}) {
  if (loading) {
    return (
      <article className="panel empty-state compact-empty-state">
        <div className="empty-state-content">
          <span className="empty-state-icon"><ClipboardCheck size={28} /></span>
          <h2>Carregando vistorias</h2>
          <p>Consultando dados cadastrados no Supabase.</p>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="panel empty-state compact-empty-state schema-warning">
        <div className="empty-state-content">
          <span className="empty-state-icon"><AlertTriangle size={28} /></span>
          <h2>Banco aguardando configuração</h2>
          <p>{error}</p>
        </div>
      </article>
    );
  }

  if (inspections.length === 0) {
    return (
      <article className="panel empty-state compact-empty-state">
        <div className="empty-state-content">
          <span className="empty-state-icon"><ClipboardCheck size={28} /></span>
          <h2>Nenhuma vistoria registrada</h2>
          <p>Cadastre primeira vistoria vinculada a um imóvel.</p>
          <button className="button primary empty-state-action" onClick={onNew}><Plus size={17} /> Nova vistoria</button>
        </div>
      </article>
    );
  }

  const propertyLabel = (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    return property ? `#${property.property_number} · ${property.name}` : propertyId;
  };
  const inspectorLabel = (inspectorId: string) => {
    const inspector = inspectors.find((item) => item.id === inspectorId);
    return inspector?.full_name || "Usuário não encontrado";
  };

  return (
    <article className="panel inspection-list-panel">
      <div className="inspection-list-summary">
        <span><ClipboardCheck size={18} /> {inspections.length} {inspections.length === 1 ? "vistoria cadastrada" : "vistorias cadastradas"}</span>
        <small>Ordenadas pelo cadastro mais recente</small>
      </div>
      <div className="inspection-table-scroll">
        <table className="inspection-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Imóvel vinculado</th>
              <th>Tipo</th>
              <th>Data</th>
              <th>Horário</th>
              <th>Responsável</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {inspections.map((inspection) => (
              <tr key={inspection.id}>
                <td><strong>#{inspection.inspection_number}</strong></td>
                <td><span className="inspection-property"><Building2 size={15} />{propertyLabel(inspection.property_id)}</span></td>
                <td>{inspectionTypeLabel(inspection.inspection_type)}</td>
                <td><span className="inspection-date"><CalendarDays size={14} />{formatInspectionDate(inspection.scheduled_at)}</span></td>
                <td>{formatInspectionTime(inspection.scheduled_at)}</td>
                <td>{inspectorLabel(inspection.inspector_id)}</td>
                <td><span className={`inspection-status inspection-status-${inspection.status}`}>{inspectionStatusLabel(inspection.status)}</span></td>
                <td>
                  <div className="inspection-actions" aria-label={`Ações da vistoria ${inspection.inspection_number}`}>
                    <button className="property-action" type="button" onClick={() => onView(inspection)} title="Visualizar vistoria" aria-label={`Visualizar vistoria ${inspection.inspection_number}`}><Eye size={17} /></button>
                    <button className="property-action" type="button" onClick={() => onEdit(inspection)} title="Editar vistoria" aria-label={`Editar vistoria ${inspection.inspection_number}`}><Pencil size={17} /></button>
                    <button className="property-action property-action-danger" type="button" onClick={() => onDelete(inspection)} title="Excluir vistoria" aria-label={`Excluir vistoria ${inspection.inspection_number}`}><Trash2 size={17} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function PropertiesView({
  properties,
  loading,
  error,
  searching,
  onNew,
  onView,
  onEdit,
  onDelete,
}: {
  properties: PropertyRecord[];
  loading: boolean;
  error: string;
  searching: boolean;
  onNew: () => void;
  onView: (property: PropertyRecord) => void;
  onEdit: (property: PropertyRecord) => void;
  onDelete: (property: PropertyRecord) => void;
}) {
  if (loading) {
    return (
      <article className="panel empty-state compact-empty-state">
        <div className="empty-state-content">
          <span className="empty-state-icon"><Building2 size={28} /></span>
          <h2>Carregando imóveis</h2>
          <p>Consultando dados cadastrados no Supabase.</p>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="panel empty-state compact-empty-state schema-warning">
        <div className="empty-state-content">
          <span className="empty-state-icon"><AlertTriangle size={28} /></span>
          <h2>Banco aguardando configuração</h2>
          <p>{error}</p>
        </div>
      </article>
    );
  }

  if (properties.length === 0) {
    return (
      <article className="panel empty-state compact-empty-state">
        <div className="empty-state-content">
          <span className="empty-state-icon"><Building2 size={28} /></span>
          <h2>{searching ? "Nenhum imóvel encontrado" : "Nenhum imóvel cadastrado"}</h2>
          <p>{searching ? "Altere os termos da busca." : "Cadastre o primeiro imóvel para iniciar a carteira."}</p>
          {!searching && <button className="button primary empty-state-action" onClick={onNew}><Plus size={17} /> Novo imóvel</button>}
        </div>
      </article>
    );
  }

  return (
    <div className="property-grid">
      {properties.map((property) => (
        <article className="property-card registered-property-card" key={property.id}>
          <div className="property-card-top">
            <div className="property-illustration"><Building2 size={28} /></div>
            <span className={`registration-status status-${property.status}`}>{propertyStatusLabel(property.status)}</span>
          </div>
          <p className="property-code">IMÓVEL #{property.property_number}</p>
          <h2>{property.name}</h2>
          <p className="property-type-label">{property.classification === "residential" ? "Residencial" : "Comercial"} · {propertyTypeLabel(property.property_type)}</p>
          <p className="address"><MapPin size={15} />{property.address_line}, {property.no_number ? "s/nº" : property.street_number} · {property.district}, {property.city}/{property.state}</p>
          <div className="property-details">
            <div><span>CEP</span><strong>{formatPostalCode(property.postal_code || "") || "—"}</strong></div>
            <div><span>Área da unidade</span><strong>{property.unit_area === null ? "—" : `${Number(property.unit_area).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²`}</strong></div>
            <div><span>Cômodos</span><strong>{property.room_count}</strong></div>
          </div>
          <div className="property-card-foot">
            <span><Ruler size={15} /> Terreno: {property.land_area === null ? "—" : `${Number(property.land_area).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²`}</span>
            <small>Criado em {new Date(property.created_at).toLocaleDateString("pt-BR")}</small>
          </div>
          <div className="property-card-actions" aria-label={`Ações do imóvel ${property.name}`}>
            <button className="property-action" type="button" onClick={() => onView(property)} title="Visualizar imóvel" aria-label={`Visualizar ${property.name}`}><Eye size={17} /></button>
            <button className="property-action" type="button" onClick={() => onEdit(property)} title="Editar imóvel" aria-label={`Editar ${property.name}`}><Pencil size={17} /></button>
            <button className="property-action property-action-danger" type="button" onClick={() => onDelete(property)} title="Excluir imóvel" aria-label={`Excluir ${property.name}`}><Trash2 size={17} /></button>
          </div>
        </article>
      ))}
    </div>
  );
}

function AuthLoading() {
  return <main className="auth-page"><div className="auth-loading"><Image src="/favicon.svg" alt="" width={40} height={40} priority /><span>Carregando ambiente seguro...</span></div></main>;
}

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const switchMode = () => {
    setMode((current) => current === "login" ? "signup" : "login");
    setFullName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setMessage(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const normalizedEmail = email.trim();
    if (!supabase) {
      setMessage({ type: "error", text: "Serviço de autenticação temporariamente indisponível." });
      return;
    }
    if (!isBasicEmailFormat(normalizedEmail)) {
      setMessage({ type: "error", text: "Informe um e-mail no formato nome@domínio." });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: "error", text: "Senha precisa ter pelo menos 8 caracteres." });
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) setMessage({ type: "error", text: "E-mail ou senha inválidos." });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) setMessage({ type: "error", text: signupErrorMessage(error) });
        else if (!data.session) setMessage({ type: "success", text: "Cadastro criado. Confirmação de e-mail está ativa no Supabase." });
      }
    } catch {
      setMessage({ type: "error", text: mode === "signup"
        ? "Não foi possível criar a conta agora. Tente novamente mais tarde."
        : "Não foi possível acessar agora. Tente novamente mais tarde." });
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!supabase || !email.trim()) {
      setMessage({ type: "error", text: "Informe seu e-mail primeiro." });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMessage(error
      ? { type: "error", text: "Não foi possível enviar o e-mail agora." }
      : { type: "success", text: "Se o e-mail estiver cadastrado, você receberá as instruções." });
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="auth-brand"><Image src="/favicon.svg" alt="" width={48} height={48} priority /><div><strong>Imobitec</strong><span>Vistoria & Qualidade</span></div></div>
        <div className="auth-copy">
          <p className="eyebrow">GESTÃO IMOBILIÁRIA COM EVIDÊNCIAS</p>
          <h1>Qualidade visível.<br />Decisões mais seguras.</h1>
          <p>Vistorias, não conformidades e histórico de conservação em um ambiente protegido.</p>
          <div className="auth-benefits">
            <span><CheckCircle2 /> Índices calculados automaticamente</span>
            <span><CheckCircle2 /> Rastreabilidade de correções</span>
            <span><CheckCircle2 /> Dados protegidos por usuário</span>
          </div>
        </div>
        <div className="auth-quote"><ShieldCheck /><p>“Cada alteração deixa evidência. Cada usuário acessa apenas o que lhe pertence.”</p></div>
      </section>

      <section className="auth-form-side">
        <div className="login-card">
          <div className="mobile-auth-brand"><Image src="/favicon.svg" alt="" width={40} height={40} priority /><strong>Imobitec</strong></div>
          <div className="login-card-head">
            <span className="login-icon"><KeyRound /></span>
            <h2>{mode === "login" ? "Acesse sua conta" : "Crie sua conta"}</h2>
            <p>{mode === "login" ? "Use suas credenciais para continuar." : "Cadastre-se para acessar o ambiente Imobitec."}</p>
          </div>

          <form key={mode} onSubmit={submit} autoComplete={mode === "login" ? "on" : "off"}>
            {mode === "signup" && <label className="login-field"><span>Nome completo</span><div><UserRound /><input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" placeholder="Seu nome" /></div></label>}
            <label className="login-field"><span>E-mail</span><div><Mail /><input type="text" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoCapitalize="none" spellCheck={false} autoComplete={mode === "login" ? "username" : "off"} placeholder="nome@empresa.com" /></div></label>
            <label className="login-field"><span>Senha</span><div><LockKeyhole /><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
            {mode === "login" && <button className="forgot-link" type="button" onClick={resetPassword}>Esqueci minha senha</button>}
            {message && <p className={`auth-message ${message.type}`} role="status">{message.text}</p>}
            <button className="login-submit" disabled={loading} type="submit"><LogIn />{loading ? "Aguarde..." : mode === "login" ? "Entrar com segurança" : "Criar conta"}</button>
          </form>

          <p className="auth-switch">{mode === "login" ? "Ainda não possui acesso?" : "Já possui uma conta?"}<button type="button" onClick={switchMode}>{mode === "login" ? "Criar conta" : "Fazer login"}</button></p>
          <p className="security-note"><LockKeyhole /> Sessão encerrada ao fechar esta aba ou janela do navegador.</p>
        </div>
      </section>
    </main>
  );
}
