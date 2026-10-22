// Telefone do usuário: obrigatório no convite e pedido no primeiro login de quem ainda não tem.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/services/UsersService", () => ({
  usersService: {
    list: vi.fn(),
    directory: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    resendInvitation: vi.fn(),
  },
}));

import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { ToastProvider } from "../../src/contexts/ToastProvider";
import { CompleteProfileModal } from "../../src/components/common/CompleteProfileModal";
import { needsProfileCompletion } from "../../src/utils/profile";
import { UsersPage } from "../../src/pages/UsersPage";
import { usersService } from "../../src/services/UsersService";
import type { AuthUser } from "../../src/types/auth";
import { ADMIN, makeUser, renderApp } from "./support/harness";

const users = vi.mocked(usersService);
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

function renderModal(user: AuthUser, updateProfile = vi.fn(async () => undefined)) {
  const value = { user, loading: false, updateProfile, logout: vi.fn(async () => undefined) } as unknown as AuthContextValue;
  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <ToastProvider>
          <CompleteProfileModal />
        </ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return updateProfile;
}

describe("completar cadastro no primeiro login", () => {
  it("só pede para quem não tem telefone, em sessão normal e com a senha já trocada", () => {
    expect(needsProfileCompletion(makeUser({ phone: null }))).toBe(true);
    expect(needsProfileCompletion(makeUser())).toBe(true); // campo ausente (convites antigos)
    expect(needsProfileCompletion(makeUser({ phone: "+5511912345678" }))).toBe(false);
    expect(needsProfileCompletion(makeUser({ mustChangePassword: true }))).toBe(false); // troca de senha vem antes
    expect(
      needsProfileCompletion(
        makeUser({ impersonation: { sessionId: "s", mode: "read_only", expiresAt: "2030-01-01T00:00:00Z", reason: "x" } }),
      ),
    ).toBe(false); // sessão de suporte não é a pessoa
    expect(needsProfileCompletion(null)).toBe(false);
  });

  it("abre o modal, recusa telefone incompleto e salva o válido", async () => {
    const updateProfile = renderModal(makeUser({ phone: null }));
    expect(await screen.findByText("Complete seu cadastro")).toBeTruthy();
    const campo = screen.getByLabelText(/Telefone/);
    fireEvent.change(campo, { target: { value: "1191" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText(/Telefone incompleto/)).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
    fireEvent.change(campo, { target: { value: "11912345678" } });
    expect((campo as HTMLInputElement).value).toBe("(11) 91234-5678");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ phone: "(11) 91234-5678" }));
  });

  it("não aparece para quem já tem telefone", () => {
    renderModal(makeUser({ phone: "+5511912345678" }));
    expect(screen.queryByText("Complete seu cadastro")).toBeNull();
  });
});

describe("convite", () => {
  it("exige telefone antes de enviar e manda o número junto", async () => {
    users.list.mockResolvedValue([]);
    users.create.mockResolvedValue({
      user: { id: "u2", tenantId: "t1", name: "Nova", email: "nova@example.com", role: "vendedor", status: "active", pendingFirstAccess: true } as never,
      invitationSent: true,
    });
    renderApp(<UsersPage />, { user: ADMIN });
    fireEvent.click((await screen.findAllByRole("button", { name: /Convidar pessoa/ }))[0]!);
    fireEvent.change(await screen.findByLabelText(/Nome/), { target: { value: "Nova Pessoa" } });
    fireEvent.change(screen.getByLabelText(/E-mail/), { target: { value: "nova@example.com" } });
    const enviar = screen.getByRole("button", { name: "Enviar convite" }) as HTMLButtonElement;
    expect(enviar.disabled).toBe(true); // sem telefone o convite não pode ser enviado
    fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: "1198" } });
    expect(enviar.disabled).toBe(true); // telefone incompleto também não
    fireEvent.change(screen.getByLabelText(/Telefone/), { target: { value: "11988887777" } });
    expect(enviar.disabled).toBe(false);
    fireEvent.click(enviar);
    await waitFor(() => expect(users.create).toHaveBeenCalledTimes(1));
    expect(users.create.mock.calls[0]![0]).toMatchObject({ email: "nova@example.com", phone: "(11) 98888-7777" });
  });
});

describe("lista da equipe", () => {
  it("mostra o telefone formatado e 'Sem telefone' para quem ainda não informou", async () => {
    const base = { tenantId: "t1", role: "vendedor", status: "active", pendingFirstAccess: false } as const;
    users.list.mockResolvedValue([
      { ...base, id: "u1", name: "Com Fone", email: "com@example.com", phone: "+5511912345678" } as never,
      { ...base, id: "u2", name: "Sem Fone", email: "sem@example.com", phone: null } as never,
    ]);
    renderApp(<UsersPage />, { user: ADMIN });
    expect(await screen.findByText("(11) 91234-5678")).toBeTruthy();
    expect(screen.getByText("Sem telefone")).toBeTruthy();
  });
});
