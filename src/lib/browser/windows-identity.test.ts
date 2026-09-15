import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseWindowsIdentity, windowsIdentityCommand } from "./windows-identity.ts";

describe("parseWindowsIdentity", () => {
  it("reads whoami /upn output", () => {
    const parsed = parseWindowsIdentity("MDC_IDENTITY\nUPN=jane.doe@miamidade.gov\nACCOUNT=COUNTY\\jdoe");
    assert.equal(parsed?.upn, "jane.doe@miamidade.gov");
    assert.equal(parsed?.account, "COUNTY\\jdoe");
  });

  it("accepts a pasted County UPN", () => {
    assert.equal(parseWindowsIdentity("Jane.Doe@MiamiDade.gov")?.upn, "jane.doe@miamidade.gov");
  });

  it("rejects Google and other domains", () => {
    assert.equal(parseWindowsIdentity("ada@gmail.com"), null);
    assert.equal(parseWindowsIdentity("UPN=dev@example.com"), null);
  });
});

describe("windowsIdentityCommand", () => {
  it("launches encoded PowerShell", () => {
    assert.match(windowsIdentityCommand(), /^powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand /);
  });
});
