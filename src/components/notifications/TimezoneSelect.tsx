import { useMemo } from "react";
import form from "../common/Form.module.css";
import { timezoneOptions } from "../../utils/notifications";

/** Fuso IANA. `null` = herdar (rótulo explica de quem). A validação de
 * verdade é do backend (422 para nome fora do catálogo). */
export function TimezoneSelect({
  id,
  value,
  inheritedLabel,
  onChange,
  disabled,
}: {
  id: string;
  value: string | null;
  inheritedLabel: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const options = useMemo(() => timezoneOptions([value, "America/Sao_Paulo"]), [value]);
  return (
    <select
      id={id}
      className={form.select}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{inheritedLabel}</option>
      {options.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
