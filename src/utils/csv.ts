/**
 * Lê um arquivo como texto tentando UTF-8 primeiro; se os bytes não forem
 * UTF-8 válido, decodifica de novo como Windows-1252 (ANSI) em vez de usar
 * `file.text()` puro. `file.text()` SEMPRE decodifica como UTF-8 (não tem
 * como escolher outra codificação) — quando alguém exporta do Excel em
 * português usando a opção comum "CSV (separado por vírgulas)" (em vez de
 * "CSV UTF-8"), o Windows grava o arquivo em ANSI/Windows-1252, e um
 * acento como "â" em "Crânio" vira um único byte (0xE2) que não é uma
 * sequência UTF-8 válida. `file.text()` substitui esse byte pelo
 * caractere de substituição "�" (U+FFFD) de forma silenciosa e
 * IRREVERSÍVEL — o import salva "Cr�nio" no banco sem erro nenhum, sem
 * como recuperar o "â" depois. `TextDecoder("utf-8", { fatal: true })`
 * joga esse caso pra uma exceção em vez de mascarar com "�", permitindo
 * cair pra Windows-1252 (que decodifica qualquer byte, nunca falha) —
 * cobre tanto arquivo de verdade em UTF-8 (incl. com BOM, removido
 * automaticamente pelo `TextDecoder`) quanto o caso comum de ANSI.
 */
export async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

/**
 * Parser de CSV minimalista (RFC 4180: aspas duplas, campos com vírgula/
 * quebra de linha dentro de aspas, `""` como aspas escapada) — suficiente
 * para o import de prospecção, sem puxar uma lib externa só para isso.
 * Detecta `,` ou `;` como separador olhando a primeira linha (planilhas
 * brasileiras costumam exportar com `;`).
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // BOM UTF-8 residual (caractere invisível U+FEFF) — comum em CSV
  // exportado do Excel/Sheets no Windows. Sem isso, ele gruda no primeiro
  // header (ex.: vira "U+FEFF" + "Nome da empresa"), quebrando o match
  // exato do de/para (`guessMapping`) só pra essa primeira coluna.
  const withoutBom = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const delimiter = detectDelimiter(withoutBom);
  const rows = parseRows(withoutBom, delimiter);
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
