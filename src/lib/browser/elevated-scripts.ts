import type { ElevatedToolId, ScriptLaunchMode } from "./types";

const SCRIPT_FILES: Record<ElevatedToolId, string> = {
  aduc: "Launch-ADUC.ps1",
  cmrc: "Launch-CMRC.ps1",
};

export const DEFAULT_SCRIPT_FOLDER = "%LOCALAPPDATA%\\MDCHelpDesk\\Scripts";

export const SCRIPT_FOLDER_PRESETS = [
  { id: "appdata", label: "This employee (AppData)", path: DEFAULT_SCRIPT_FOLDER },
  { id: "documents", label: "Documents", path: "%USERPROFILE%\\Documents\\MDCHelpDesk" },
  { id: "programdata", label: "All users", path: "%PROGRAMDATA%\\MDCHelpDesk\\Scripts" },
] as const;

export type LaunchCommandOptions = {
  computer?: string;
  mode?: ScriptLaunchMode;
  folder?: string;
};

export function scriptFileName(toolId: ElevatedToolId) {
  return SCRIPT_FILES[toolId];
}

export function normalizeScriptFolder(folder: string) {
  return folder.trim().replace(/\//g, "\\").replace(/\\+$/, "");
}

export function toolScriptPath(toolId: ElevatedToolId, folder = DEFAULT_SCRIPT_FOLDER) {
  return `${normalizeScriptFolder(folder || DEFAULT_SCRIPT_FOLDER)}\\${scriptFileName(toolId)}`;
}

/** Turn %VAR% into $env:VAR so a PowerShell -File path expands on the desk image. */
export function powershellLiteralPath(windowsPath: string) {
  const expanded = windowsPath.replace(/%([A-Za-z0-9_]+)%/g, (_m, name: string) => `$env:${name}`);
  return `"${expanded.replace(/"/g, '`"')}"`;
}

export function encodePowerShell(script: string): string {
  const bytes = new Uint8Array(script.length * 2);
  for (let i = 0; i < script.length; i++) {
    const c = script.charCodeAt(i);
    bytes[i * 2] = c & 0xff;
    bytes[i * 2 + 1] = (c >>> 8) & 0xff;
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function decodePowerShell(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  let text = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    text += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  }
  return text;
}

export function launchCommand(toolId: ElevatedToolId, userId: string, options: LaunchCommandOptions | string = {}) {
  const opts: LaunchCommandOptions = typeof options === "string" ? { computer: options } : options;
  const computer = opts.computer;
  const mode: ScriptLaunchMode = opts.mode ?? "inline";
  if (mode === "file") {
    const file = powershellLiteralPath(toolScriptPath(toolId, opts.folder));
    const extra = toolId === "cmrc" && computer?.trim() ? ` -ComputerName "${escapePsDouble(computer.trim())}"` : "";
    return `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ${file} -UserId "${escapePsDouble(userId)}"${extra}`;
  }
  const encoded = encodePowerShell(runtimeScript(toolId, userId, computer));
  return `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
}

export function downloadElevatedScript(toolId: ElevatedToolId, folder = DEFAULT_SCRIPT_FOLDER) {
  const name = scriptFileName(toolId);
  const body = powershellScript(toolId, folder).replace(/\n/g, "\r\n");
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapePsDouble(value: string) {
  return value.replace(/"/g, '`"');
}

function escapePsSingle(value: string) {
  return value.replace(/'/g, "''");
}

const READ_PASSWORD = [
  "function Read-LaunchPassword {",
  "  param([string]$UserId)",
  "  if ([Console]::IsInputRedirected) {",
  "    $line = [Console]::In.ReadLine()",
  '    if ([string]::IsNullOrWhiteSpace($line)) {',
  '      throw "No password was supplied on stdin."',
  "    }",
  "    $secure = ConvertTo-SecureString -String $line -AsPlainText -Force",
  "    $line = $null",
  "    return $secure",
  "  }",
  '  return Read-Host "Password for $UserId" -AsSecureString',
  "}",
].join("\n");

const FIND_CMRC = [
  "function Find-CmRcViewer {",
  "  $candidates = @(",
  '    "${env:ProgramFiles(x86)}\\Microsoft Configuration Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe",',
  '    "$env:ProgramFiles\\Microsoft Configuration Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe",',
  '    "${env:ProgramFiles(x86)}\\ConfigMgr\\AdminConsole\\bin\\i386\\CmRcViewer.exe",',
  '    "$env:ProgramFiles\\Microsoft Configuration Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe"',
  "  )",
  "  foreach ($path in $candidates) {",
  "    if ($path -and (Test-Path $path)) { return $path }",
  "  }",
  '  $cmd = Get-Command "CmRcViewer.exe" -ErrorAction SilentlyContinue',
  "  if ($cmd) { return $cmd.Source }",
  '  throw "CmRcViewer.exe was not found. Install the ConfigMgr console tools on this image."',
  "}",
].join("\n");

function scriptHeader(folder = DEFAULT_SCRIPT_FOLDER) {
  return [
    "# Miami-Dade County Help Desk",
    "# Optional helper. The Help Desk browser can run this tool in memory with",
    "# no file on disk. If you keep a copy, store it in the folder configured in",
    `# Settings (default: ${folder}).`,
    "# The browser supplies -UserId and pipes the password on stdin.",
    "# Never paste a password into this file.",
    "# Double-clicking still works: you will be prompted for User ID and password.",
    "",
  ].join("\n");
}

const ADUC_START = [
  '$mmc = Join-Path $env:SystemRoot "System32\\mmc.exe"',
  "if (-not (Test-Path $mmc)) {",
  '  throw "mmc.exe was not found at $mmc"',
  "}",
  "",
  'Start-Process -FilePath $mmc -ArgumentList "dsa.msc" -Credential $cred -LoadUserProfile -WorkingDirectory $env:SystemRoot',
  "",
].join("\n");

const CMRC_START = [
  "$exe = Find-CmRcViewer",
  "$argList = @()",
  "if ($ComputerName) { $argList += $ComputerName }",
  "",
  "Start-Process -FilePath $exe -ArgumentList $argList -Credential $cred -LoadUserProfile",
  "",
].join("\n");

export function powershellScript(toolId: ElevatedToolId, folder = DEFAULT_SCRIPT_FOLDER): string {
  if (toolId === "cmrc") {
    return [
      scriptHeader(folder),
      "param(",
      "  [string]$UserId,",
      "  [string]$ComputerName",
      ")",
      "",
      '$ErrorActionPreference = "Stop"',
      "",
      READ_PASSWORD,
      "",
      FIND_CMRC,
      "",
      "if (-not $UserId) {",
      '  $UserId = Read-Host "User ID (DOMAIN\\id)"',
      "}",
      "if ([string]::IsNullOrWhiteSpace($UserId)) {",
      '  throw "User ID is required."',
      "}",
      "if (-not $ComputerName -and -not [Console]::IsInputRedirected) {",
      '  $ComputerName = Read-Host "Target computer (blank to open the viewer only)"',
      "}",
      "",
      "$secure = Read-LaunchPassword -UserId $UserId",
      "$cred = New-Object System.Management.Automation.PSCredential ($UserId, $secure)",
      "",
      CMRC_START,
    ].join("\n");
  }
  return [
    scriptHeader(folder),
    "param(",
    "  [string]$UserId",
    ")",
    "",
    '$ErrorActionPreference = "Stop"',
    "",
    READ_PASSWORD,
    "",
    "if (-not $UserId) {",
    '  $UserId = Read-Host "User ID (DOMAIN\\id)"',
    "}",
    "if ([string]::IsNullOrWhiteSpace($UserId)) {",
    '  throw "User ID is required."',
    "}",
    "",
    "$secure = Read-LaunchPassword -UserId $UserId",
    "$cred = New-Object System.Management.Automation.PSCredential ($UserId, $secure)",
    "",
    ADUC_START,
  ].join("\n");
}

/** In-memory launcher: UserId is baked in; password still arrives on stdin. */
export function runtimeScript(toolId: ElevatedToolId, userId: string, computer?: string): string {
  const lines = [
    "# Generated by the Help Desk browser. Do not save a password in this command.",
    '$ErrorActionPreference = "Stop"',
    `$UserId = '${escapePsSingle(userId)}'`,
  ];
  if (toolId === "cmrc") {
    lines.push(
      computer?.trim() ? `$ComputerName = '${escapePsSingle(computer.trim())}'` : "$ComputerName = $null",
    );
  }
  lines.push("", READ_PASSWORD, "");
  if (toolId === "cmrc") lines.push(FIND_CMRC, "");
  lines.push(
    "$secure = Read-LaunchPassword -UserId $UserId",
    "$cred = New-Object System.Management.Automation.PSCredential ($UserId, $secure)",
    "",
  );
  lines.push(toolId === "cmrc" ? CMRC_START : ADUC_START);
  return lines.join("\n");
}
