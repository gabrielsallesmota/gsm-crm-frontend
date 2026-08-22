/**
 * Parser de CSV minimalista (RFC 4180: aspas duplas, campos com vírgula/
 * quebra de linha dentro de aspas, `""` como aspas escapada) — suficiente
 * para o import de prospecção, sem puxar uma lib externa só para isso.
 * Detecta `,` ou `;` como separador olhando a primeira linha (planilhas
 * brasileiras costumam exportar com `;`).
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const delimiter = detectDelimiter(text);
  const rows = parseRows(text, delimiter);
  const [headers, ...body] = rows;
  return { headers: (headers ?? []).map((h) => h.trim()), rows: body.filter((r) => r.some((c) => c.trim())) };
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
