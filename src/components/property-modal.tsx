"use client";

import { Building2, LoaderCircle, MapPin, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  findAddressOption,
  splitStreet,
  uniqueAddressOptions,
  type AddressOption,
  type CepAddress,
} from "@/lib/address";
import {
  BRAZILIAN_STATES,
  COMMERCIAL_PROPERTY_TYPES,
  RESIDENTIAL_PROPERTY_TYPES,
  STREET_TYPES,
  digitsOnly,
  formatPostalCode,
  formatSquareMetersInput,
  formatSquareMetersValue,
  parseDecimalInput,
  parseOptionalInteger,
  type PropertyClassification,
  type PropertyRecord,
} from "@/lib/property";
import { supabase } from "@/lib/supabase";

type FormState = {
  title: string;
  classification: PropertyClassification;
  propertyType: string;
  status: "active" | "inactive" | "archived";
  postalCode: string;
  streetType: string;
  addressLine: string;
  streetNumber: string;
  noNumber: boolean;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  unitArea: string;
  landArea: string;
  roomCount: string;
};

type OptionsPayload = { items: AddressOption[] };

const FALLBACK_STATES: AddressOption[] = BRAZILIAN_STATES.map(([value, label]) => ({ id: value, value, label }));

const INITIAL_FORM: FormState = {
  title: "", classification: "residential", propertyType: "", status: "active",
  postalCode: "", streetType: "", addressLine: "", streetNumber: "", noNumber: false,
  complement: "", district: "", city: "", state: "", notes: "", unitArea: "", landArea: "",
  roomCount: "0",
};

async function requestAddress<T>(params: Record<string, string>) {
  const response = await fetch(`/api/address?${new URLSearchParams(params)}`);
  const payload = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "Não foi possível consultar o endereço.");
  return payload;
}

function formFromProperty(property: PropertyRecord): FormState {
  return {
    title: property.name,
    classification: property.classification,
    propertyType: property.property_type,
    status: property.status,
    postalCode: formatPostalCode(property.postal_code),
    streetType: property.street_type,
    addressLine: property.address_line,
    streetNumber: property.street_number === null ? "" : String(property.street_number),
    noNumber: property.no_number,
    complement: property.complement || "",
    district: property.district || "",
    city: property.city,
    state: property.state,
    notes: property.notes || "",
    unitArea: formatSquareMetersValue(property.unit_area),
    landArea: formatSquareMetersValue(property.land_area),
    roomCount: String(property.room_count),
  };
}

export function PropertyModal({
  property,
  onClose,
  onSaved,
}: {
  property?: PropertyRecord | null;
  onClose: () => void;
  onSaved: (property: PropertyRecord) => void;
}) {
  const editing = Boolean(property);
  const [form, setForm] = useState<FormState>(() => property ? formFromProperty(property) : INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const states = FALLBACK_STATES;
  const [cities, setCities] = useState<AddressOption[]>(() => property?.city
    ? [{ id: `current-${property.city}`, value: property.city, label: property.city }]
    : []);
  const [addressLoading, setAddressLoading] = useState(property?.state ? "cities" : "");
  const [addressMessage, setAddressMessage] = useState("");
  const [addressError, setAddressError] = useState("");
  const [cepLocked, setCepLocked] = useState(false);
  const lastCep = useRef(property ? digitsOnly(property.postal_code, 8) : "");

  const propertyTypes = useMemo(
    () => form.classification === "residential" ? RESIDENTIAL_PROPERTY_TYPES : COMMERCIAL_PROPERTY_TYPES,
    [form.classification],
  );
  const visibleStates = useMemo(() => !cepLocked || !form.state ? states : states.filter((item) => item.value === form.state), [cepLocked, form.state, states]);
  const visibleCities = useMemo(() => !cepLocked || !form.city ? cities : cities.filter((item) => item.value === form.city), [cepLocked, form.city, cities]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [onClose, saving]);

  useEffect(() => {
    if (!property?.state) return;
    let active = true;
    requestAddress<OptionsPayload>({ mode: "cities", uf: property.state })
      .then(({ items }) => {
        if (!active) return;
        const currentCity = { id: `current-${property.city}`, value: property.city, label: property.city };
        setCities(uniqueAddressOptions([...items, currentCity]));
      })
      .catch(() => {
        if (active) setAddressError("Não foi possível atualizar a lista de cidades. Cidade cadastrada mantida.");
      })
      .finally(() => {
        if (active) setAddressLoading("");
      });
    return () => { active = false; };
  }, [property]);

  const update = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => setForm((current) => ({ ...current, [key]: value }));

  const loadCities = async (uf: string) => {
    setAddressLoading("cities");
    try {
      const { items } = await requestAddress<OptionsPayload>({ mode: "cities", uf });
      setCities(items);
      return items;
    } finally { setAddressLoading(""); }
  };

  const handleStateChange = async (uf: string) => {
    setAddressError(""); setAddressMessage(""); setCities([]);
    setForm((current) => ({ ...current, state: uf, city: "", district: "" }));
    if (!uf) return;
    try {
      const options = await loadCities(uf);
      if (options.length === 1) {
        const onlyCity = options[0];
        setForm((current) => ({ ...current, city: onlyCity.value }));
      }
    } catch (requestError) {
      setAddressError(requestError instanceof Error ? requestError.message : "Não foi possível carregar as cidades.");
    }
  };

  const handleCityChange = (cityName: string) => {
    setAddressError("");
    setForm((current) => ({ ...current, city: cityName, district: "" }));
  };

  const lookupPostalCode = async (postalCode = digitsOnly(form.postalCode, 8)) => {
    if (postalCode.length !== 8 || addressLoading === "cep") return;
    lastCep.current = postalCode;
    setAddressLoading("cep"); setAddressError(""); setAddressMessage("");
    try {
      const address = await requestAddress<CepAddress>({ mode: "cep", cep: postalCode });
      const cityOptions = await loadCities(address.state);
      let city = findAddressOption(cityOptions, address.city, address.ibgeCityId);
      if (!city) {
        city = { id: address.ibgeCityId, value: address.city, label: address.city };
        setCities((current) => uniqueAddressOptions([...current, city!]));
      }
      const parsedStreet = splitStreet(address.street);
      setCepLocked(true);
      setForm((current) => ({
        ...current, postalCode: formatPostalCode(address.postalCode), state: address.state,
        city: city!.value, district: address.neighborhood, streetType: parsedStreet.streetType || current.streetType,
        addressLine: parsedStreet.street || current.addressLine,
      }));
      setAddressMessage(address.neighborhood
        ? "Endereço localizado. Estado, cidade, bairro e logradouro preenchidos."
        : "Endereço localizado. Informe o bairro para continuar.");
    } catch (requestError) {
      setCepLocked(false);
      setAddressError(requestError instanceof Error ? requestError.message : "CEP não encontrado.");
    } finally { setAddressLoading(""); }
  };

  const handlePostalCodeChange = (value: string) => {
    const formatted = formatPostalCode(value);
    const postalCode = digitsOnly(formatted, 8);
    update("postalCode", formatted); setAddressError(""); setAddressMessage("");
    if (postalCode.length < 8) {
      lastCep.current = ""; setCepLocked(false);
      return;
    }
    if (postalCode !== lastCep.current) void lookupPostalCode(postalCode);
  };

  const updateCount = (value: string) => update("roomCount", digitsOnly(value, 5));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const postalCode = digitsOnly(form.postalCode, 8);
    const district = form.district.trim();
    const unitArea = parseDecimalInput(form.unitArea);
    const landArea = parseDecimalInput(form.landArea);
    const roomCount = parseOptionalInteger(form.roomCount);
    if (postalCode.length !== 8) { setError("CEP é obrigatório e deve possuir exatamente oito dígitos."); return; }
    if (!district) { setError("Informe o bairro."); return; }
    if (!form.noNumber && !form.streetNumber) { setError("Informe número ou marque a opção “Sem número”."); return; }
    if ((form.unitArea && unitArea === null) || (form.landArea && landArea === null)) { setError("Áreas devem ser números positivos com até duas casas decimais."); return; }
    if (roomCount === null) { setError("Quantidade de cômodos deve ser um número inteiro positivo."); return; }
    if (!supabase) { setError("Supabase não configurado."); return; }

    setSaving(true);
    const payload = {
      name: form.title.trim(), classification: form.classification, property_type: form.propertyType,
      status: form.status, postal_code: postalCode, street_type: form.streetType,
      address_line: form.addressLine.trim(), street_number: form.noNumber ? null : Number.parseInt(form.streetNumber, 10),
      no_number: form.noNumber, complement: form.complement.trim() || null, district, city: form.city.trim(),
      state: form.state, notes: form.notes.trim() || null, unit_area: unitArea, land_area: landArea,
      room_count: roomCount,
    };
    const query = property
      ? supabase.from("properties").update(payload).eq("id", property.id)
      : supabase.from("properties").insert(payload);
    const { data, error: saveError } = await query.select("*").single();
    if (saveError || !data) {
      const missingSchema = saveError?.code === "42703" || saveError?.code === "PGRST204";
      setError(missingSchema
        ? "Estrutura do banco pendente. Execute banco-de-dados/migracoes/003_cadastro_imoveis.sql no Supabase."
        : saveError?.message || `Não foi possível ${editing ? "atualizar" : "cadastrar"} o imóvel.`);
      setSaving(false); return;
    }
    onSaved(data as PropertyRecord);
  };

  return (
    <div className="modal-layer property-modal-layer" role="presentation">
      <div className="modal property-modal" role="dialog" aria-modal="true" aria-labelledby="property-modal-title">
        <form onSubmit={submit}>
          <div className="modal-head property-modal-head">
            <div><span>{editing ? "EDIÇÃO DE IMÓVEL" : "CADASTRO DE IMÓVEL"}</span><h2 id="property-modal-title">{editing ? `Editar imóvel #${property?.property_number}` : "Novo imóvel"}</h2><p>Campos marcados com * são obrigatórios.</p></div>
            <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={21} /></button>
          </div>
          <div className="property-form-body">
            <fieldset className="form-section">
              <legend><Building2 size={17} /> Identificação</legend>
              <div className="form-grid">
                <label className="form-field readonly-field"><span>ID do imóvel</span><input value={property ? String(property.property_number) : "Gerado automaticamente"} disabled /></label>
                <label className="form-field readonly-field"><span>Data de criação</span><input value={property ? new Date(property.created_at).toLocaleDateString("pt-BR") : "Gerada automaticamente"} disabled /></label>
                <label className="form-field span-2"><span>Título para identificação *</span><input value={form.title} onChange={(event) => update("title", event.target.value)} maxLength={250} required placeholder="Ex.: Apartamento Centro · 804" autoFocus /></label>
                <label className="form-field"><span>Enquadramento *</span><select value={form.classification} onChange={(event) => setForm((current) => ({ ...current, classification: event.target.value as PropertyClassification, propertyType: "" }))} required><option value="residential">Residencial</option><option value="commercial">Comercial</option></select></label>
                <label className="form-field"><span>Tipo de imóvel *</span><select value={form.propertyType} onChange={(event) => update("propertyType", event.target.value)} required><option value="">Selecione</option>{propertyTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="form-field"><span>Situação cadastral *</span><select value={form.status} onChange={(event) => update("status", event.target.value as FormState["status"])} required><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="archived">Arquivado</option></select></label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend><MapPin size={17} /> Endereço</legend>
              <div className="form-grid">
                <div className="form-field"><span>CEP *</span><div className="cep-field"><input value={form.postalCode} onChange={(event) => handlePostalCodeChange(event.target.value)} onBlur={() => void lookupPostalCode()} inputMode="numeric" maxLength={9} placeholder="00000-000" aria-describedby="cep-feedback" required /><button className="cep-search" type="button" onClick={() => void lookupPostalCode()} disabled={digitsOnly(form.postalCode, 8).length !== 8 || addressLoading === "cep"} aria-label="Buscar CEP">{addressLoading === "cep" ? <LoaderCircle className="spin" size={17} /> : <Search size={17} />}</button></div></div>
                <label className="form-field"><span>Tipo de logradouro *</span><select value={form.streetType} onChange={(event) => update("streetType", event.target.value)} required><option value="">Selecione</option>{STREET_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="form-field span-2"><span>Logradouro *</span><input value={form.addressLine} onChange={(event) => update("addressLine", event.target.value)} maxLength={250} required /></label>
                <label className="form-field number-field"><span>Número *</span><input value={form.noNumber ? "s/nº" : form.streetNumber} onChange={(event) => update("streetNumber", digitsOnly(event.target.value, 10))} inputMode="numeric" disabled={form.noNumber} required={!form.noNumber} /><span className="checkbox-field"><input type="checkbox" checked={form.noNumber} onChange={(event) => setForm((current) => ({ ...current, noNumber: event.target.checked, streetNumber: "" }))} /> Sem número</span></label>
                <label className="form-field"><span>Complemento</span><input value={form.complement} onChange={(event) => update("complement", event.target.value)} maxLength={250} /></label>
                <label className="form-field"><span>Estado (UF) *</span><select value={form.state} onChange={(event) => void handleStateChange(event.target.value)} disabled={addressLoading === "cep"} required><option value="">Selecione</option>{visibleStates.map((state) => <option value={state.value} key={state.id}>{state.value} · {state.label}</option>)}</select></label>
                <label className="form-field"><span>Cidade *</span><select value={form.city} onChange={(event) => handleCityChange(event.target.value)} disabled={!form.state || addressLoading === "cities" || addressLoading === "cep"} required><option value="">{addressLoading === "cities" ? "Carregando..." : "Selecione"}</option>{visibleCities.map((city) => <option value={city.value} key={city.id}>{city.label}</option>)}</select></label>
                <label className="form-field"><span>Bairro *</span><input value={form.district} onChange={(event) => update("district", event.target.value)} maxLength={250} required placeholder="Informe o bairro" /></label>
                {(addressMessage || addressError) && <p id="cep-feedback" className={`address-feedback span-2 ${addressError ? "address-feedback-error" : ""}`} role={addressError ? "alert" : "status"}>{addressError || addressMessage}</p>}
                <label className="form-field span-2"><span>Observações</span><textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={4} placeholder="Informações adicionais sobre o imóvel" /></label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Características físicas</legend>
              <div className="form-grid physical-grid">
                <AreaField label="Área da unidade (m²)" value={form.unitArea} onChange={(value) => update("unitArea", value)} />
                <AreaField label="Área do terreno (m²)" value={form.landArea} onChange={(value) => update("landArea", value)} />
                <CountField label="Quantidade de cômodos" value={form.roomCount} onChange={updateCount} />
              </div>
            </fieldset>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
          <div className="modal-actions property-modal-actions"><button className="button secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="button primary" type="submit" disabled={saving || Boolean(addressLoading)}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar imóvel"}</button></div>
        </form>
      </div>
    </div>
  );
}

function CountField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="form-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" maxLength={5} /></label>;
}

function AreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const moveCaret = (start: number, end = start) => {
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(start, end));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const key = event.key;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;

    if (key === "," || key === ".") {
      event.preventDefault();
      const comma = value.indexOf(",");
      if (comma >= 0) moveCaret(comma + 1, comma + 3);
      return;
    }

    if (!/^\d$/.test(key) && key !== "Backspace") return;
    event.preventDefault();

    const current = value || "0,00";
    const comma = current.indexOf(",");
    const integer = current.slice(0, comma);
    const decimals = current.slice(comma + 1).padEnd(2, "0").slice(0, 2);

    if (/^\d$/.test(key)) {
      if (!value || (start === 0 && end === current.length)) {
        onChange(`${key},00`);
        moveCaret(1);
        return;
      }

      if (start <= comma) {
        const selectionEnd = Math.min(end, comma);
        const nextInteger = `${integer.slice(0, start)}${key}${integer.slice(selectionEnd)}`.replace(/^0+(?=\d)/, "");
        onChange(`${nextInteger || "0"},${decimals}`);
        moveCaret(start + 1);
        return;
      }

      const decimalStart = Math.min(start - comma - 1, 1);
      const decimalEnd = Math.min(Math.max(end - comma - 1, decimalStart + 1), 2);
      const nextDecimals = `${decimals.slice(0, decimalStart)}${key}${decimals.slice(decimalEnd)}`.padEnd(2, "0").slice(0, 2);
      onChange(`${integer},${nextDecimals}`);
      moveCaret(comma + decimalStart + 2);
      return;
    }

    if (start !== end) {
      onChange(formatSquareMetersInput(`${current.slice(0, start)}${current.slice(end)}`));
      moveCaret(Math.max(0, start));
    } else if (start > 0 && start <= comma) {
      const nextInteger = `${integer.slice(0, start - 1)}${integer.slice(start)}` || "0";
      onChange(`${nextInteger},${decimals}`);
      moveCaret(Math.max(0, start - 1));
    } else if (start > comma + 1) {
      const decimalIndex = Math.min(start - comma - 2, 1);
      const nextDecimals = `${decimals.slice(0, decimalIndex)}0${decimals.slice(decimalIndex + 1)}`;
      onChange(`${integer},${nextDecimals}`);
      moveCaret(start - 1);
    }
  };

  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        ref={inputRef}
        value={value}
        onFocus={() => {
          if (!value) onChange("0,00");
          moveCaret(0, Math.max(1, (value || "0,00").indexOf(",")));
        }}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange(formatSquareMetersInput(event.target.value))}
        inputMode="decimal"
        placeholder="0,00"
        aria-label={label}
      />
    </label>
  );
}
