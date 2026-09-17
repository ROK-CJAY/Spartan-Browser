import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APP_VERSION,
  KNOWLEDGE_POLL_MS,
  buildUpdateStatus,
  compareVersions,
  fallbackPolicy,
  parseDeskPolicy,
  setHostedAdmins,
  setHostedModel,
  getHostedModel,
  isHostedAdmin,
  sanitizeModelUrl,
} from "./desk-updates.ts";

describe("compareVersions", () => {
  it("orders semver and v-prefixed tags", () => {
    assert.equal(compareVersions("1.0.0", "0.9.0"), 1);
    assert.equal(compareVersions("v0.9.0", "0.9.0"), 0);
    assert.equal(compareVersions("0.8.2", "0.9.0"), -1);
  });
});

describe("parseDeskPolicy", () => {
  it("keeps only County UPNs", () => {
    const policy = parseDeskPolicy({
      schema: 1,
      updatedAt: "2026-09-15T00:00:00Z",
      admins: ["E315170@MiamiDade.gov", "not-an-admin@gmail.com", "e325037@miamidade.gov"],
    });
    assert.deepEqual(policy?.admins, ["e315170@miamidade.gov", "e325037@miamidade.gov"]);
  });

  it("rejects empty or invalid payloads", () => {
    assert.equal(parseDeskPolicy({ admins: [] }), null);
    assert.equal(parseDeskPolicy(null), null);
  });
});

describe("buildUpdateStatus", () => {
  it("flags a newer GitHub release", () => {
    const status = buildUpdateStatus({
      policy: fallbackPolicy(),
      source: "github",
      latestVersion: "1.2.0",
      now: "2026-09-15T00:00:00Z",
    });
    assert.equal(status.currentVersion, APP_VERSION);
    assert.equal(status.updateAvailable, true);
    assert.equal(status.latestVersion, "1.2.0");
  });

  it("stays quiet when already current", () => {
    const status = buildUpdateStatus({
      policy: fallbackPolicy(),
      source: "fallback",
      latestVersion: APP_VERSION,
    });
    assert.equal(status.updateAvailable, false);
  });
});

describe("hosted admins cache", () => {
  it("replaces the allow list with County UPNs from policy", () => {
    setHostedAdmins(["e310678@miamidade.gov", "x@example.com"]);
    assert.equal(isHostedAdmin("E310678@miamidade.gov"), true);
    assert.equal(isHostedAdmin("e315170@miamidade.gov"), false);
    setHostedAdmins([]);
  });
});

describe("knowledge poll", () => {
  it("checks open desks about once a minute", () => {
    assert.equal(KNOWLEDGE_POLL_MS, 60_000);
  });
});

describe("hosted model URL", () => {
  it("keeps localhost, county, and RFC1918 hosts", () => {
    assert.equal(sanitizeModelUrl("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
    assert.equal(sanitizeModelUrl("http://ollama.miamidade.gov:11434"), "http://ollama.miamidade.gov:11434");
    assert.equal(sanitizeModelUrl("http://10.12.4.20:11434"), "http://10.12.4.20:11434");
  });

  it("rejects public internet hosts", () => {
    assert.equal(sanitizeModelUrl("https://api.openai.com"), "");
    assert.equal(sanitizeModelUrl("http://evil.example"), "");
  });

  it("reads modelUrl from policy", () => {
    const policy = parseDeskPolicy({
      schema: 1,
      updatedAt: "2026-09-17T00:00:00Z",
      admins: ["e315170@miamidade.gov"],
      modelUrl: "http://10.1.2.3:11434",
      modelName: "llama3.1",
    });
    assert.equal(policy?.modelUrl, "http://10.1.2.3:11434");
    assert.equal(policy?.modelName, "llama3.1");
    setHostedModel(policy?.modelUrl, policy?.modelName);
    assert.equal(getHostedModel().url, "http://10.1.2.3:11434");
    setHostedModel("", "");
  });
});
