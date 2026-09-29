// Extensão `.ts` de propósito: roda também no Node (`npm test`), sem Vite.

/**
 * Identidade do produto — ÚNICO lugar com nome, marca e textos
 * institucionais da GSM (Etapa 4). Telas, título da aba e rodapé leem
 * daqui; nada de "GSM" espalhado em componentes.
 *
 * Preparado para personalização por organização no futuro: `resolveBrand`
 * recebe o tenant e hoje devolve sempre a marca padrão. Quando existir
 * white-label, basta o backend expor os campos e esta função mesclá-los
 * (sem mudar as telas). NÃO há white-label implementado.
 */
export interface Brand {
  /** Nome do produto (título da aba, telas de login). */
  productName: string;
  /** Empresa que fornece o produto. */
  companyName: string;
  website: string;
  websiteLabel: string;
  /** Logo em texto: `<GSM />` + sufixo "CRM". */
  logoMark: string;
  logoSuffix: string;
}

export const DEFAULT_BRAND: Brand = {
  productName: "GSM CRM",
  companyName: "GSM Automação",
  website: "https://gsmautomacao.com.br",
  websiteLabel: "gsmautomacao.com.br",
  logoMark: "GSM",
  logoSuffix: "CRM",
};

export type BrandOverrides = Partial<Pick<Brand, "productName">>;

export function resolveBrand(_tenant?: { brand?: BrandOverrides } | null): Brand {
  // Ponto de extensão (white-label): hoje ignora o tenant de propósito.
  return DEFAULT_BRAND;
}

/** "Leads · GSM CRM" — título da aba do navegador. */
export function pageTitle(page: string | null | undefined, brand: Brand = DEFAULT_BRAND): string {
  const clean = page?.trim();
  return clean ? `${clean} · ${brand.productName}` : brand.productName;
}

export function copyright(year: number = new Date().getFullYear(), brand: Brand = DEFAULT_BRAND): string {
  return `© ${year} ${brand.companyName}`;
}
