"use client";

import { Building2, CalendarDays, Check, ClipboardCheck, Clock3, DoorOpen, LoaderCircle, Plus, Save, Search, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildScheduledAt,
  filterInspectionProperties,
  formatDateInput,
  formatTimeInput,
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  inspectionEnvironmentTypeLabel,
  inspectionEnvironmentTypesForClassification,
  nextInspectionEnvironmentName,
  type InspectionEnvironmentType,
  type InspectionRecord,
  type InspectionStatus,
  type InspectionType,
  type InspectorOption,
} from "@/lib/inspection";
import type { PropertyRecord } from "@/lib/property";
import { supabase } from "@/lib/supabase";

type FormState = {
  propertyId: string;
  roomCount: string;
  inspectionType: InspectionType | "";
  date: string;
  time: string;
  inspectorId: string;
  status: InspectionStatus;
};

const INITIAL_FORM: FormState = {
  propertyId: "",
  roomCount: "",
  inspectionType: "",
  date: "",
  time: "",
  inspectorId: "",
  status: "draft",
};

type EnvironmentDraft = {
  clientId: string;
  type: InspectionEnvironmentType;
  name: string;
};

function propertyOptionLabel(property: PropertyRecord) {
  return `Imóvel #${property.property_number} · ${property.name}`;
}

function scheduledDateInput(value: string) {
  const date = new Date(value);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function scheduledTimeInput(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function InspectionModal({
  inspection,
  properties,
  inspectors,
  currentUserId,
  onClose,
  onSaved,
}: {
  inspection?: InspectionRecord | null;
  properties: PropertyRecord[];
  inspectors: InspectorOption[];
  currentUserId: string;
  onClose: () => void;
  onSaved: (inspection: InspectionRecord, completionRequested: boolean) => void;
}) {
  const editing = Boolean(inspection);
  const initialProperty = inspection ? properties.find((property) => property.id === inspection.property_id) : null;
  const [form, setForm] = useState<FormState>(() => ({
    ...(inspection ? {
      propertyId: inspection.property_id,
      roomCount: String(inspection.room_count),
      inspectionType: inspection.inspection_type,
      date: scheduledDateInput(inspection.scheduled_at),
      time: scheduledTimeInput(inspection.scheduled_at),
      inspectorId: inspection.inspector_id,
      status: inspection.status,
    } : INITIAL_FORM),
    inspectorId: inspection?.inspector_id || (inspectors.some((item) => item.id === currentUserId) ? currentUserId : ""),
  }));
  const [saving, setSaving] = useState(false);
  const [loadingEnvironments, setLoadingEnvironments] = useState(Boolean(inspection && supabase));
  const [error, setError] = useState(inspection && !supabase ? "Supabase não configurado." : "");
  const [environments, setEnvironments] = useState<EnvironmentDraft[]>([]);
  const [newEnvironmentType, setNewEnvironmentType] = useState<InspectionEnvironmentType>(() =>
    inspectionEnvironmentTypesForClassification(initialProperty?.classification)[0][0]);
  const [propertySearch, setPropertySearch] = useState(initialProperty ? propertyOptionLabel(initialProperty) : "");
  const [propertyListOpen, setPropertyListOpen] = useState(false);
  const [activePropertyIndex, setActivePropertyIndex] = useState(-1);
  const propertySearchRef = useRef<HTMLDivElement>(null);
  const filteredProperties = useMemo(
    () => filterInspectionProperties(properties, propertySearch),
    [properties, propertySearch],
  );
  const selectedProperty = properties.find((property) => property.id === form.propertyId);
  const availableEnvironmentTypes = inspectionEnvironmentTypesForClassification(selectedProperty?.classification);
  const roomMaximum = selectedProperty?.room_count ?? 0;
  const roomTarget = Number.parseInt(form.roomCount, 10) || 0;
  const roomTargetReached = roomTarget > 0 && environments.length >= roomTarget;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose, saving]);

  useEffect(() => {
    const closePropertyList = (event: PointerEvent) => {
      if (!propertySearchRef.current?.contains(event.target as Node)) setPropertyListOpen(false);
    };
    document.addEventListener("pointerdown", closePropertyList);
    return () => document.removeEventListener("pointerdown", closePropertyList);
  }, []);

  useEffect(() => {
    if (!inspection) return;
    let active = true;
    if (!supabase) return;
    supabase
      .from("inspection_environments")
      .select("id, environment_type, name, sort_order")
      .eq("inspection_id", inspection.id)
      .order("sort_order")
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(loadError.message || "Não foi possível carregar ambientes da vistoria.");
        } else {
          setEnvironments((data || []).map((environment) => ({
            clientId: environment.id,
            type: environment.environment_type as InspectionEnvironmentType,
            name: environment.name,
          })));
        }
        setLoadingEnvironments(false);
      });
    return () => { active = false; };
  }, [inspection]);

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectProperty = (property: PropertyRecord) => {
    setForm((current) => ({ ...current, propertyId: property.id, roomCount: String(property.room_count) }));
    setEnvironments([]);
    setNewEnvironmentType(inspectionEnvironmentTypesForClassification(property.classification)[0][0]);
    setPropertySearch(propertyOptionLabel(property));
    setActivePropertyIndex(-1);
    setPropertyListOpen(false);
    setError("");
  };

  const clearProperty = () => {
    setForm((current) => ({ ...current, propertyId: "", roomCount: "" }));
    setEnvironments([]);
    setPropertySearch("");
    setActivePropertyIndex(-1);
    setPropertyListOpen(true);
  };

  const handlePropertySearch = (value: string) => {
    setForm((current) => ({ ...current, propertyId: "", roomCount: "" }));
    setEnvironments([]);
    setPropertySearch(value);
    setActivePropertyIndex(-1);
    setPropertyListOpen(true);
  };

  const handleRoomCountChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 5);
    if (!digits) {
      update("roomCount", "");
      return;
    }

    const nextValue = Math.min(Number.parseInt(digits, 10), roomMaximum);
    if (nextValue < environments.length) {
      setError(`Remova ${environments.length - nextValue} ambiente(s) antes de diminuir esse total.`);
      return;
    }
    setError("");
    update("roomCount", String(nextValue));
  };

  const addEnvironment = () => {
    if (!selectedProperty) {
      setError("Selecione primeiro o imóvel vinculado.");
      return;
    }
    if (roomTarget < 1 || roomTarget > roomMaximum) {
      setError(`Cômodos a vistoriar deve ficar entre 1 e ${roomMaximum}.`);
      return;
    }
    if (roomTargetReached) {
      setError(`Limite de ${roomTarget} ambiente(s) desta vistoria atingido.`);
      return;
    }
    setEnvironments((current) => [...current, {
      clientId: crypto.randomUUID(),
      type: newEnvironmentType,
      name: nextInspectionEnvironmentName(current, newEnvironmentType),
    }]);
    setError("");
  };

  const removeEnvironment = (clientId: string) => {
    setEnvironments((current) => current.filter((environment) => environment.clientId !== clientId));
    setError("");
  };

  const updateEnvironmentName = (clientId: string, name: string) => {
    setEnvironments((current) => current.map((environment) =>
      environment.clientId === clientId ? { ...environment, name: name.slice(0, 120) } : environment));
  };

  const handlePropertyKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setPropertyListOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setPropertyListOpen(true);
      setActivePropertyIndex((current) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        return Math.max(0, Math.min(filteredProperties.length - 1, current + direction));
      });
      return;
    }
    if (event.key === "Enter" && propertyListOpen) {
      const property = filteredProperties[activePropertyIndex] || filteredProperties[0];
      if (!property) return;
      event.preventDefault();
      selectProperty(property);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.propertyId) {
      setError("Pesquise e selecione um imóvel vinculado.");
      return;
    }
    if (!selectedProperty || roomTarget < 1 || roomTarget > selectedProperty.room_count) {
      setError(`Cômodos a vistoriar deve ficar entre 1 e ${selectedProperty?.room_count || 0}.`);
      return;
    }
    if (environments.length !== roomTarget) {
      setError(`Adicione exatamente ${roomTarget} ambiente(s). Faltam ${roomTarget - environments.length}.`);
      return;
    }
    if (environments.some((environment) => !environment.name.trim())) {
      setError("Todos os ambientes precisam de nome.");
      return;
    }
    const normalizedNames = environments.map((environment) => environment.name.trim().toLocaleLowerCase("pt-BR"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      setError("Use nomes diferentes para identificar cada ambiente.");
      return;
    }
    const scheduledAt = buildScheduledAt(form.date, form.time);
    if (!scheduledAt) {
      setError("Informe data e horário válidos nos formatos dd/mm/aaaa e hh:mm.");
      return;
    }
    if (!supabase) {
      setError("Supabase não configurado.");
      return;
    }

    const completionRequested = form.status === "completed" && inspection?.status !== "completed";
    setSaving(true);
    const rpcName = editing ? "update_inspection_with_environments" : "create_inspection_with_environments";
    const rpcPayload = {
        ...(inspection ? { p_inspection_id: inspection.id } : {}),
        p_property_id: form.propertyId,
        p_inspection_type: form.inspectionType,
        p_scheduled_at: scheduledAt,
        p_inspector_id: form.inspectorId,
        p_status: completionRequested ? "in_progress" : form.status,
        p_room_count: roomTarget,
        p_environments: environments.map((environment, index) => ({
          type: environment.type,
          name: environment.name.trim(),
          sort_order: index,
        })),
      };
    const { data, error: saveError } = await supabase
      .rpc(rpcName, rpcPayload)
      .single();

    if (saveError || !data) {
      const schemaPending = ["42703", "42P01", "PGRST202", "PGRST204"].includes(saveError?.code || "");
      setError(schemaPending
        ? `Estrutura pendente. Execute banco-de-dados/migracoes/${editing ? "008_crud_vistorias.sql" : "006_ambientes_vistoria.sql"} no Supabase.`
        : saveError?.message || `Não foi possível ${editing ? "atualizar" : "cadastrar"} a vistoria.`);
      setSaving(false);
      return;
    }

    onSaved(data as InspectionRecord, completionRequested);
  };

  return (
    <div className="modal-layer property-modal-layer" role="presentation">
      <div className="modal inspection-modal" role="dialog" aria-modal="true" aria-labelledby="inspection-modal-title">
        <form onSubmit={submit}>
          <div className="modal-head property-modal-head">
            <div>
              <span>{editing ? "EDIÇÃO DE VISTORIA" : "CADASTRO DE VISTORIA"}</span>
              <h2 id="inspection-modal-title">{editing ? `Editar vistoria #${inspection?.inspection_number}` : "Nova vistoria"}</h2>
              <p>Campos marcados com * são obrigatórios.</p>
            </div>
            <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={21} /></button>
          </div>

          <div className="property-form-body inspection-form-body">
            <fieldset className="form-section">
              <legend><ClipboardCheck size={17} /> Identificação</legend>
              <div className="form-grid">
                <label className="form-field readonly-field">
                  <span>ID da vistoria</span>
                  <input value={inspection ? String(inspection.inspection_number) : "Gerado automaticamente"} disabled />
                </label>
                <label className="form-field">
                  <span>Tipo *</span>
                  <select value={form.inspectionType} onChange={(event) => update("inspectionType", event.target.value as InspectionType)} required>
                    <option value="">Selecione</option>
                    {INSPECTION_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
                <div className="form-field span-2 property-search-field" ref={propertySearchRef}>
                  <label className="form-field-label" htmlFor="inspection-property-search">Imóvel vinculado *</label>
                  <div className={`property-search-control ${selectedProperty ? "property-search-selected" : ""}`}>
                    <Search size={17} />
                    <input
                      id="inspection-property-search"
                      value={propertySearch}
                      onChange={(event) => handlePropertySearch(event.target.value)}
                      onFocus={(event) => {
                        setPropertyListOpen(true);
                        if (selectedProperty) event.currentTarget.select();
                      }}
                      onKeyDown={handlePropertyKeyDown}
                      placeholder="Pesquise por ID, título, CEP, endereço ou cidade"
                      role="combobox"
                      aria-expanded={propertyListOpen}
                      aria-controls="inspection-property-options"
                      aria-autocomplete="list"
                      aria-activedescendant={propertyListOpen && filteredProperties[activePropertyIndex]
                        ? `inspection-property-${filteredProperties[activePropertyIndex].id}`
                        : undefined}
                      autoComplete="off"
                      autoFocus
                    />
                    {selectedProperty && <Check className="property-selected-icon" size={17} aria-hidden="true" />}
                    {(propertySearch || selectedProperty) && (
                      <button type="button" className="property-search-clear" onClick={clearProperty} aria-label="Limpar imóvel selecionado"><X size={15} /></button>
                    )}
                  </div>
                  {propertyListOpen && (
                    <div className="property-search-results" id="inspection-property-options" role="listbox" aria-label="Imóveis encontrados">
                      <div className="property-search-summary">
                        <span>{filteredProperties.length} {filteredProperties.length === 1 ? "imóvel encontrado" : "imóveis encontrados"}</span>
                        <small>{propertySearch ? "Resultado da pesquisa" : "Imóveis ativos"}</small>
                      </div>
                      {filteredProperties.length > 0 ? filteredProperties.map((property, index) => (
                        <button
                          type="button"
                          id={`inspection-property-${property.id}`}
                          className={`property-search-option ${index === activePropertyIndex ? "active" : ""}`}
                          role="option"
                          aria-selected={property.id === form.propertyId}
                          onMouseEnter={() => setActivePropertyIndex(index)}
                          onClick={() => selectProperty(property)}
                          key={property.id}
                        >
                          <span className="property-search-option-icon"><Building2 size={17} /></span>
                          <span><strong>{propertyOptionLabel(property)}</strong><small>{property.address_line} · {property.district}, {property.city}/{property.state}</small></span>
                          {property.id === form.propertyId && <Check size={17} />}
                        </button>
                      )) : (
                        <div className="property-search-empty"><Search size={20} /><span>Nenhum imóvel encontrado.</span><small>Tente outro ID, título ou endereço.</small></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            <fieldset className="form-section inspection-environments-section">
              <legend><DoorOpen size={17} /> Ambientes para vistoriar</legend>
              {!selectedProperty ? (
                <div className="environment-property-required">
                  <Building2 size={22} />
                  <div><strong>Selecione um imóvel</strong><span>A quantidade máxima de ambientes será carregada automaticamente.</span></div>
                </div>
              ) : roomMaximum < 1 ? (
                <div className="environment-property-required environment-property-warning">
                  <DoorOpen size={22} />
                  <div><strong>Imóvel sem cômodos cadastrados</strong><span>Edite imóvel e informe quantidade de cômodos antes de criar vistoria.</span></div>
                </div>
              ) : (
                <>
                  <div className="environment-overview">
                    <label className="form-field">
                      <span>Cômodos a vistoriar *</span>
                      <input
                        value={form.roomCount}
                        onChange={(event) => handleRoomCountChange(event.target.value)}
                        inputMode="numeric"
                        min={1}
                        max={roomMaximum}
                        required
                      />
                      <small>Máximo cadastrado no imóvel: {roomMaximum}</small>
                    </label>
                    <div className="environment-progress" aria-label={`${environments.length} de ${roomTarget} ambientes adicionados`}>
                      <div><span>Ambientes adicionados</span><strong>{environments.length}/{roomTarget || "—"}</strong></div>
                      <i><b style={{ width: `${roomTarget ? Math.min(100, (environments.length / roomTarget) * 100) : 0}%` }} /></i>
                    </div>
                  </div>

                  <div className="environment-adder">
                    <label className="form-field">
                      <span>Tipo de ambiente</span>
                      <select value={newEnvironmentType} onChange={(event) => setNewEnvironmentType(event.target.value as InspectionEnvironmentType)}>
                        {availableEnvironmentTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                      </select>
                      <small>Lista para imóvel {selectedProperty.classification === "commercial" ? "comercial" : "residencial"}.</small>
                    </label>
                    <button
                      className="button secondary environment-add-button"
                      type="button"
                      onClick={addEnvironment}
                      disabled={roomTargetReached || roomTarget < 1}
                    >
                      <Plus size={16} /> Adicionar ambiente
                    </button>
                  </div>

                  <div className="environment-list" aria-live="polite">
                    {environments.length === 0 ? (
                      <div className="environment-empty"><DoorOpen size={21} /><span>Nenhum ambiente adicionado.</span></div>
                    ) : environments.map((environment, index) => (
                        <div className="environment-row" key={environment.clientId}>
                          <span className="environment-order">{index + 1}</span>
                          <span className="environment-type-icon"><DoorOpen size={16} /></span>
                          <label>
                            <span>{inspectionEnvironmentTypeLabel(environment.type)}</span>
                            <input value={environment.name} onChange={(event) => updateEnvironmentName(environment.clientId, event.target.value)} maxLength={120} required aria-label={`Nome do ambiente ${index + 1}`} />
                          </label>
                          <button type="button" onClick={() => removeEnvironment(environment.clientId)} aria-label={`Remover ${environment.name}`} title="Remover ambiente"><Trash2 size={16} /></button>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </fieldset>

            <fieldset className="form-section">
              <legend><CalendarDays size={17} /> Agendamento</legend>
              <div className="form-grid">
                <label className="form-field">
                  <span>Data *</span>
                  <span className="field-with-icon">
                    <CalendarDays size={17} />
                    <input value={form.date} onChange={(event) => update("date", formatDateInput(event.target.value))} inputMode="numeric" maxLength={10} placeholder="dd/mm/aaaa" required />
                  </span>
                </label>
                <label className="form-field">
                  <span>Horário *</span>
                  <span className="field-with-icon">
                    <Clock3 size={17} />
                    <input value={form.time} onChange={(event) => update("time", formatTimeInput(event.target.value))} inputMode="numeric" maxLength={5} placeholder="hh:mm" required />
                  </span>
                </label>
                <label className="form-field">
                  <span>Responsável pela vistoria *</span>
                  <span className="field-with-icon">
                    <UserRound size={17} />
                    <select value={form.inspectorId} onChange={(event) => update("inspectorId", event.target.value)} required>
                      <option value="">Selecione</option>
                      {inspectors.map((inspector) => (
                        <option value={inspector.id} key={inspector.id}>{inspector.full_name || "Usuário sem nome"}</option>
                      ))}
                    </select>
                  </span>
                </label>
                <label className="form-field">
                  <span>Status *</span>
                  <select value={form.status} onChange={(event) => update("status", event.target.value as InspectionStatus)} required>
                    {INSPECTION_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
              </div>
            </fieldset>

            {loadingEnvironments && <p className="address-feedback" role="status"><LoaderCircle className="spin" size={15} /> Carregando ambientes cadastrados...</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>

          <div className="modal-actions property-modal-actions">
            <button className="button secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="button primary" type="submit" disabled={saving || loadingEnvironments}>
              {saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}
              {saving ? "Salvando..." : form.status === "completed" && inspection?.status !== "completed" ? "Continuar para conclusão" : editing ? "Salvar alterações" : "Cadastrar vistoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
