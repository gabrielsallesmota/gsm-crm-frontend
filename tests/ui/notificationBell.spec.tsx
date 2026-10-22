// Sino de avisos: contagem de não lidos, abrir a lista, marcar como lido e navegar.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "../../src/components/common/NotificationBell";
import { AuthContext, type AuthContextValue } from "../../src/contexts/AuthContext";
import { inboxService } from "../../src/services/InboxService";
import type { InboxItem } from "../../src/types/inbox";
import { ADMIN } from "./support/harness";

const ITEMS: InboxItem[] = [
  {
    id: "n1",
    kind: "task_assigned",
    title: "Tarefa atribuída a você",
    body: "Ana atribuiu a tarefa “Enviar proposta” a você.",
    link: "/tarefas",
    createdAt: "2026-10-22T12:00:00Z",
    read: false,
  },
  {
    id: "n2",
    kind: "event_assigned",
    title: "Compromisso atrelado a você",
    body: "Ana atrelou “Reunião” a você.",
    link: "/agenda",
    createdAt: "2026-10-21T12:00:00Z",
    read: true,
  },
];

function mount() {
  const value = { user: ADMIN, loading: false, currentTenantId: "t1" } as unknown as AuthContextValue;
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route path="/" element={<NotificationBell />} />
          <Route path="/tarefas" element={<p>tela de tarefas</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(inboxService, "list").mockResolvedValue({ items: ITEMS, unread: 1 });
  vi.spyOn(inboxService, "markRead").mockResolvedValue();
  vi.spyOn(inboxService, "markAllRead").mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NotificationBell", () => {
  it("mostra a quantidade de avisos não lidos", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Avisos: 1 não lido" })).toBeTruthy();
  });

  it("clicar num aviso marca como lido e abre a tela dele", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Avisos: 1 não lido" }));
    fireEvent.click(screen.getByText("Tarefa atribuída a você"));
    await waitFor(() => expect(inboxService.markRead).toHaveBeenCalledWith("n1"));
    expect(await screen.findByText("tela de tarefas")).toBeTruthy();
  });

  it("“Marcar todos como lidos” zera a contagem", async () => {
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Avisos: 1 não lido" }));
    fireEvent.click(screen.getByText("Marcar todos como lidos"));
    await waitFor(() => expect(inboxService.markAllRead).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Avisos" })).toBeTruthy();
  });

  it("sem avisos mostra o estado vazio", async () => {
    vi.spyOn(inboxService, "list").mockResolvedValue({ items: [], unread: 0 });
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Avisos" }));
    expect(await screen.findByText("Nada por aqui ainda.")).toBeTruthy();
  });
});
