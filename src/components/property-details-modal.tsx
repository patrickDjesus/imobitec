"use client";

import { Building2, MapPin, Printer, Ruler, X } from "lucide-react";
import { useEffect } from "react";
import {
  formatPostalCode,
  propertyStatusLabel,
  propertyTypeLabel,
  streetTypeLabel,
  type PropertyRecord,
} from "@/lib/property";

function text(value: string | null) {
  return value?.trim() || "—";
}

function area(value: number | null) {
  return value === null
    ? "—"
    : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

function Detail({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "detail-item detail-item-wide" : "detail-item"}><dt>{label}</dt><dd>{value}</dd></div>;
}

export function PropertyDetailsModal({ property, onClose }: { property: PropertyRecord; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = ""; };
  }, [onClose]);

  const printProperty = () => {
    const previousTitle = document.title;
    document.title = `Ficha cadastral - Imóvel ${property.property_number} - ${property.name}`;
    window.print();
    document.title = previousTitle;
  };

  return (
    <div className="modal-layer property-modal-layer property-details-layer" role="presentation">
      <div className="modal property-modal details-modal" role="dialog" aria-modal="true" aria-labelledby="property-details-title">
        <div className="modal-head property-modal-head">
          <div><span>VISUALIZAÇÃO DO IMÓVEL</span><h2 id="property-details-title">{property.name}</h2><p>Consulta somente leitura · Imóvel #{property.property_number}</p></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar"><X size={21} /></button>
        </div>

        <header className="print-sheet-header">
          <span className="print-sheet-logo"><Building2 size={25} /></span>
          <div><strong>IMOBITEC</strong><h1>Ficha cadastral do imóvel</h1><p>Vistoria &amp; Qualidade</p></div>
          <div className="print-sheet-code"><span>IMÓVEL</span><strong>#{property.property_number}</strong></div>
        </header>

        <div className="property-form-body details-body">
          <section className="detail-section">
            <h3><Building2 size={17} /> Identificação</h3>
            <dl className="detail-grid">
              <Detail label="ID do imóvel" value={`#${property.property_number}`} />
              <Detail label="Data de criação" value={new Date(property.created_at).toLocaleDateString("pt-BR")} />
              <Detail label="Título" value={property.name} wide />
              <Detail label="Enquadramento" value={property.classification === "residential" ? "Residencial" : "Comercial"} />
              <Detail label="Tipo de imóvel" value={propertyTypeLabel(property.property_type)} />
              <Detail label="Situação cadastral" value={<span className={`registration-status status-${property.status}`}>{propertyStatusLabel(property.status)}</span>} />
            </dl>
          </section>

          <section className="detail-section">
            <h3><MapPin size={17} /> Endereço</h3>
            <dl className="detail-grid">
              <Detail label="CEP" value={formatPostalCode(property.postal_code)} />
              <Detail label="Tipo de logradouro" value={streetTypeLabel(property.street_type)} />
              <Detail label="Logradouro" value={property.address_line} wide />
              <Detail label="Número" value={property.no_number ? "s/nº" : property.street_number ?? "—"} />
              <Detail label="Complemento" value={text(property.complement)} />
              <Detail label="Bairro" value={text(property.district)} />
              <Detail label="Cidade/UF" value={`${property.city}/${property.state}`} />
              <Detail label="Observações" value={text(property.notes)} wide />
            </dl>
          </section>

          <section className="detail-section">
            <h3><Ruler size={17} /> Características físicas</h3>
            <dl className="detail-grid detail-grid-physical">
              <Detail label="Área da unidade" value={area(property.unit_area)} />
              <Detail label="Área do terreno" value={area(property.land_area)} />
              <Detail label="Cômodos" value={property.room_count} />
            </dl>
          </section>
          <footer className="print-sheet-footer"><span>Imobitec · Vistoria &amp; Qualidade</span><span>Ficha cadastral · Imóvel #{property.property_number}</span></footer>
        </div>

        <div className="modal-actions property-modal-actions">
          <button className="button secondary" type="button" onClick={printProperty}><Printer size={17} /> Imprimir</button>
          <button className="button primary" type="button" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
