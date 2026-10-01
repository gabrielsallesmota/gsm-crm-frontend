import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { cadenceStep, effectiveContactMethod } from "../src/utils/cadenceChannels.ts";
import type { ProspectStage } from "../src/types/prospect.ts";

function stage(partial: Partial<ProspectStage>): ProspectStage {
  return {
    id: "s",
    name: "S",
    color: "#000",
    order: 0,
    isWon: false,
    isLost: false,
    asksTargetDate: false,
    followupBusinessDays: null,
    messageField: null,
    contactMethod: null,
    isProspectingEntry: false,
    ...partial,
  } as ProspectStage;
}

describe("cadenceChannels", () => {
  it("estágio sem escolha segue a cadência padrão (D2 e D7 = ligação)", () => {
    assert.equal(effectiveContactMethod(stage({ messageField: "message_2" })), "ligacao");
    assert.equal(effectiveContactMethod(stage({ messageField: "message_4" })), "ligacao");
    assert.equal(effectiveContactMethod(stage({ messageField: "message_3" })), "whatsapp");
    assert.equal(effectiveContactMethod(stage({})), "whatsapp");
  });

  it("a escolha explícita do estágio vale mais que o padrão", () => {
    const forced = stage({ messageField: "message_2", contactMethod: "whatsapp" });
    assert.equal(effectiveContactMethod(forced), "whatsapp");
    assert.equal(cadenceStep(1, [forced]).channel, "whatsapp");
    assert.equal(cadenceStep(1, [stage({ messageField: "message_2" })]).channel, "ligacao");
    assert.deepEqual(cadenceStep(4, []), { day: 10, channel: "whatsapp" });
  });
});
