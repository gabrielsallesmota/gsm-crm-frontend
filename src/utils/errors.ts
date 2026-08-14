export class NotImplementedError extends Error {
  constructor(domain: string) {
    super(
      `${domain} ainda não tem endpoint no backend (gsm-crm-backend só implementa auth/leads/pipelines/dashboard).`,
    );
    this.name = "NotImplementedError";
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
