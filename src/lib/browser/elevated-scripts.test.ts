import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SCRIPT_FOLDER,
  decodePowerShell,
  encodePowerShell,
  launchCommand,
  powershellLiteralPath,
  powershellScript,
  runtimeScript,
  scriptFileName,
  toolScriptPath,
} from "./elevated-scripts.ts";

describe("elevated scripts", () => {
  it("defaults to AppData, not C:\\Scripts", () => {
    assert.equal(DEFAULT_SCRIPT_FOLDER, "%LOCALAPPDATA%\\MDCHelpDesk\\Scripts");
    assert.equal(toolScriptPath("aduc"), "%LOCALAPPDATA%\\MDCHelpDesk\\Scripts\\Launch-ADUC.ps1");
    assert.equal(scriptFileName("cmrc"), "Launch-CMRC.ps1");
    assert.doesNotMatch(DEFAULT_SCRIPT_FOLDER, /C:\\Scripts/i);
  });

  it("runs in memory by default with no file path", () => {
    const cmd = launchCommand("aduc", "COUNTY\\jdoe");
    assert.match(cmd, /powershell\.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand /);
    assert.doesNotMatch(cmd, /C:\\Scripts/i);
    assert.doesNotMatch(cmd, /-File /);
    const encoded = cmd.split(" -EncodedCommand ")[1];
    const body = decodePowerShell(encoded);
    assert.match(body, /COUNTY\\jdoe/);
    assert.match(body, /dsa\.msc/);
    assert.match(body, /Read-LaunchPassword/);
    assert.doesNotMatch(body, /C:\\Scripts/i);
  });

  it("bakes the CmRC target computer into the encoded command", () => {
    const cmd = launchCommand("cmrc", "COUNTY\\helpdesk", { computer: "PC-42", mode: "inline" });
    const encoded = cmd.split(" -EncodedCommand ")[1];
    const body = decodePowerShell(encoded);
    assert.match(body, /PC-42/);
    assert.match(body, /Find-CmRcViewer/);
    assert.doesNotMatch(body, /C:\\Scripts/i);
  });

  it("uses the configured folder when a .ps1 is requested", () => {
    const cmd = launchCommand("aduc", 'COUNTY\\a"b', {
      mode: "file",
      folder: "D:\\HelpDesk\\Scripts",
    });
    assert.match(cmd, /-File "D:\\HelpDesk\\Scripts\\Launch-ADUC\.ps1"/);
    assert.match(cmd, /-UserId "COUNTY\\a`"b"/);
    assert.doesNotMatch(cmd, /C:\\Scripts/i);
  });

  it("expands %LOCALAPPDATA% for PowerShell -File", () => {
    assert.equal(
      powershellLiteralPath("%LOCALAPPDATA%\\MDCHelpDesk\\Scripts\\Launch-ADUC.ps1"),
      '"$env:LOCALAPPDATA\\MDCHelpDesk\\Scripts\\Launch-ADUC.ps1"',
    );
  });

  it("round-trips PowerShell encoding", () => {
    const src = "$UserId = 'COUNTY\\jdoe'\r\nWrite-Host $UserId";
    assert.equal(decodePowerShell(encodePowerShell(src)), src);
  });

  it("downloadable scripts never require C:\\Scripts and never contain a password", () => {
    const aduc = powershellScript("aduc");
    const cmrc = powershellScript("cmrc", "\\\\files\\itd\\scripts");
    assert.match(aduc, /%LOCALAPPDATA%\\MDCHelpDesk\\Scripts/);
    assert.doesNotMatch(aduc, /Place this file at C:\\Scripts/i);
    assert.match(cmrc, /\\\\files\\itd\\scripts/);
    assert.doesNotMatch(aduc, /ConvertTo-SecureString -String '.+'/);
    assert.match(runtimeScript("aduc", "COUNTY\\jdoe"), /Read-LaunchPassword/);
  });
});
