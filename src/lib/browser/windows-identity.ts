import { encodePowerShell } from "./elevated-scripts.ts";
import { isCountyEmail, normalizeEmail } from "./knowledge-base.ts";

export const WINDOWS_IDENTITY_SCRIPT = `$ErrorActionPreference = 'SilentlyContinue'
$upn = (whoami /upn | Select-Object -First 1)
if (-not $upn) {
  try {
    $upn = [System.DirectoryServices.AccountManagement.UserPrincipal]::Current.UserPrincipalName
  } catch {}
}
$account = whoami
Write-Output 'MDC_IDENTITY'
Write-Output ('UPN=' + $upn)
Write-Output ('ACCOUNT=' + $account)
Write-Output ('USER=' + $env:USERNAME)
Write-Output ('DOMAIN=' + $env:USERDOMAIN)
`;

export function windowsIdentityCommand() {
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodePowerShell(WINDOWS_IDENTITY_SCRIPT)}`;
}

export type WindowsIdentity = {
  upn: string;
  account: string;
};

export function parseWindowsIdentity(raw: string): WindowsIdentity | null {
  const text = raw.trim();
  if (!text) return null;
  const upnLine = text.match(/(?:^|\n)\s*UPN=([^\r\n]+)/i);
  const accountLine = text.match(/(?:^|\n)\s*ACCOUNT=([^\r\n]+)/i);
  const upnFromLine = upnLine?.[1]?.trim();
  const lone = text.includes("@") && !text.includes("\n") ? text : "";
  const upn = normalizeEmail(upnFromLine || lone);
  if (!isCountyEmail(upn)) return null;
  return {
    upn,
    account: (accountLine?.[1] ?? "").trim(),
  };
}

export function displayNameFromUpn(upn: string) {
  const local = upn.split("@")[0] ?? upn;
  return local
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
