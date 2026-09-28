import { useState } from "react";
import { useLeadSearch } from "../../hooks/useLeadSearch";
import form from "../common/Form.module.css";

export interface PickedLead {
  id: string;
  name: string;
}

/** Campo "Lead" com busca no servidor (nome, empresa, telefone, e-mail). */
export function LeadPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: PickedLead | null;
  onChange: (lead: PickedLead | null) => void;
  disabled?: boolean;
}) {
  const [term, setTerm] = useState("");
  const { data, loading, error } = useLeadSearch(term);

  if (value) {
    return (
      <div className={form.chosen}>
        <span>{value.name}</span>
        {!disabled && (
          <button type="button" className={form.linkBtn} onClick={() => onChange(null)}>
            Trocar
          </button>
        )}
      </div>
    );
  }

  const searching = term.trim().length >= 2;
  return (
    <div>
      <input
        className={form.input}
        placeholder="Buscar lead por nome, empresa, telefone…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        disabled={disabled}
        aria-label="Buscar lead"
      />
      {searching && (
        <ul className={form.suggestions}>
          {loading && <li className={form.hint}>Buscando…</li>}
          {error && <li className={form.error}>Não foi possível buscar leads.</li>}
          {!loading && !error && data?.length === 0 && (
            <li className={form.hint}>Nenhum lead encontrado.</li>
          )}
          {!loading &&
            data?.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  className={form.suggestion}
                  onClick={() => {
                    onChange({ id: lead.id, name: lead.name });
                    setTerm("");
                  }}
                >
                  {lead.name}
                  {lead.company && <span className={form.suggestionMeta}>{lead.company}</span>}
                </button>
              </li>
            ))}
        </ul>
      )}
      {!searching && <div className={form.hint}>Digite ao menos 2 letras.</div>}
    </div>
  );
}
