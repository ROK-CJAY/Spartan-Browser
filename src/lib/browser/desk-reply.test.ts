import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeAgentReply } from "./desk-reply.ts";

describe("composeAgentReply", () => {
  it("leads with the current article and cites older copies", () => {
    const text = composeAgentReply("password reset", [
      {
        id: "KM0000911",
        title: "SSPR",
        summary: "Old portal",
        steps: ["Use sspr.miamidade.gov"],
        currency: "outdated",
        lastReviewed: "2021-03-09",
      },
      {
        id: "KM0001842",
        title: "Password and MFA reset",
        summary: "Use MyIT",
        steps: ["Confirm the caller", "Open MyIT Reset password"],
        currency: "current",
        lastReviewed: "2026-07-14",
      },
    ]);
    assert.match(text, /KM0001842/);
    assert.match(text, /Open MyIT Reset password/);
    assert.match(text, /KM0000911/);
    assert.doesNotMatch(text, /sspr\.miamidade\.gov/);
  });

  it("warns when only an outdated article matches", () => {
    const text = composeAgentReply("sspr", [
      {
        id: "KM0000911",
        title: "SSPR",
        summary: "Old portal",
        steps: ["Use the retired portal"],
        currency: "outdated",
        lastReviewed: "2021-03-09",
        staleNote: "Use MyIT instead",
      },
    ]);
    assert.match(text, /outdated/i);
    assert.match(text, /Use MyIT instead/);
  });
});
