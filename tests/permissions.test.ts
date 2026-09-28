import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  can,
  evaluateRouteAccess,
  roleLabel,
  type Permission,
} from "../src/auth/permissions.ts";

const admin = { role: "admin", isPlatformStaff: false };
const gestor = { role: "gestor", isPlatformStaff: false };
const vendedor = { role: "vendedor", isPlatformStaff: false };
const staff = { role: "admin", isPlatformStaff: true };

describe("can() — espelha os papéis reais do backend", () => {
  const matrix: [typeof admin, Permission, boolean][] = [
    [admin, "users.view", true],
    [admin, "users.create", true],
    [admin, "settings.manage", true],
    [admin, "pipeline.reorder", true],
    [gestor, "users.view", true],
    // POST /users é só ADMIN no backend — o gestor via o formulário e levava 403.
    [gestor, "users.create", false],
    [gestor, "settings.manage", true],
    [gestor, "pipeline.reorder", true],
    [vendedor, "users.view", false],
    [vendedor, "users.create", false],
    [vendedor, "settings.manage", false],
    [vendedor, "pipeline.reorder", false],
  ];
  for (const [user, permission, expected] of matrix) {
    it(`${user.role} → ${permission} = ${expected}`, () => {
      assert.equal(can(user, permission), expected);
    });
  }

  it("área interna da GSM depende só de platform staff, não do papel no tenant", () => {
    assert.equal(can(admin, "platform.internal"), false);
    assert.equal(can(gestor, "platform.internal"), false);
    assert.equal(can(vendedor, "platform.internal"), false);
    assert.equal(can(staff, "platform.internal"), true);
    assert.equal(can({ role: "vendedor", isPlatformStaff: true }, "platform.internal"), true);
  });

  it("sem usuário ou com papel desconhecido: nenhuma permissão", () => {
    assert.equal(can(null, "users.view"), false);
    assert.equal(can(undefined, "platform.internal"), false);
    assert.equal(can({ role: "gsm_admin", isPlatformStaff: false }, "users.view"), false);
    assert.equal(can({ role: "ADMIN", isPlatformStaff: false }, "settings.manage"), false);
  });
});

describe("evaluateRouteAccess() — guard de rota", () => {
  it("usuário de tenant digitando /sdr ou /clientes: a rota 'não existe'", () => {
    for (const user of [admin, gestor, vendedor]) {
      assert.equal(evaluateRouteAccess(user, "platform.internal"), "not_found");
    }
  });

  it("platform staff acessa a área interna", () => {
    assert.equal(evaluateRouteAccess(staff, "platform.internal"), "allow");
  });

  it("papel sem permissão numa rota do produto: acesso restrito (403)", () => {
    assert.equal(evaluateRouteAccess(vendedor, "users.view"), "forbidden");
    assert.equal(evaluateRouteAccess(vendedor, "settings.manage"), "forbidden");
  });

  it("gestor e admin chegam em Usuários e Configurações", () => {
    for (const user of [admin, gestor]) {
      assert.equal(evaluateRouteAccess(user, "users.view"), "allow");
      assert.equal(evaluateRouteAccess(user, "settings.manage"), "allow");
    }
  });

  it("sem sessão nada é liberado", () => {
    assert.equal(evaluateRouteAccess(null, "users.view"), "forbidden");
    assert.equal(evaluateRouteAccess(null, "platform.internal"), "not_found");
  });
});

describe("roleLabel()", () => {
  it("mostra nome legível, nunca o valor cru", () => {
    assert.equal(roleLabel("admin"), "Administrador");
    assert.equal(roleLabel("vendedor"), "Vendedor");
    assert.equal(roleLabel("xpto"), "");
  });
});
