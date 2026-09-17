const { app, BrowserWindow, ipcMain, session, globalShortcut, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

const PORT = Number(process.env.SPARTAN_PORT || 47821);
let serverProc = null;

const AUTH_LIST = [
  "*miamidade.gov",
  "*.miamidade.gov",
  "nsd.miamidade.gov",
  "smartit.miamidade.gov",
  "myit.miamidade.gov",
  "*onbmc.com",
  "*.onbmc.com",
  "*sharepoint.com",
  "*.sharepoint.com",
  "login.microsoftonline.com",
  "*.microsoftonline.com",
  "login.windows.net",
  "login.microsoft.com",
  "autologon.microsoftazuread-sso.com",
  "*.microsoftazuread-sso.com",
  "*.msftauth.net",
  "*.msauth.net",
  "*.windows.net",
  "*.office.com",
  "*.office365.com",
].join(",");

const NTLM_URLS = [
  "https://*.miamidade.gov",
  "http://*.miamidade.gov",
  "https://miamidade.gov",
  "https://*.onbmc.com",
  "https://*.sharepoint.com",
  "https://login.microsoftonline.com",
  "https://*.microsoftonline.com",
  "https://login.windows.net",
  "https://login.microsoft.com",
  "https://autologon.microsoftazuread-sso.com",
  "https://*.microsoftazuread-sso.com",
  "https://*.msftauth.net",
  "https://*.msauth.net",
  "https://*.windows.net",
  "https://*.office.com",
  "https://*.office365.com",
];

const COUNTY_AUTH_HOST =
  /miamidade\.gov|onbmc\.com|sharepoint\.com|microsoftonline\.com|microsoft\.com|microsoftazuread-sso\.com|msftauth\.net|msauth\.net|office\.com|office365\.com|windows\.net/i;

const ENTRA_HOST = /login\.microsoftonline\.com|login\.windows\.net|login\.microsoft\.com/i;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let cachedUpn = "";

app.commandLine.appendSwitch("auth-server-whitelist", AUTH_LIST);
app.commandLine.appendSwitch("auth-server-allowlist", AUTH_LIST);
app.commandLine.appendSwitch("auth-negotiate-delegate-whitelist", AUTH_LIST);
app.commandLine.appendSwitch("auth-negotiate-delegate-allowlist", AUTH_LIST);
app.commandLine.appendSwitch("auth-schemes", "ntlm,negotiate");
app.commandLine.appendSwitch("proxy-auto-detect");
app.commandLine.appendSwitch("enable-features", "CloudAPAuth");
app.commandLine.appendSwitch("disable-features", "ThirdPartyStoragePartitioning,TrackingProtection3pcd");
app.userAgentFallback = CHROME_UA;

function serverRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app-server");
  return path.join(__dirname, ".output");
}

function serverEntry() {
  const root = serverRoot();
  const candidates = [
    path.join(root, "server", "index.mjs"),
    path.join(root, "server", "index.js"),
    path.join(root, "index.mjs"),
  ];
  return candidates.find((file) => fs.existsSync(file)) ?? candidates[0];
}

function startServer() {
  const entry = serverEntry();
  const userData = app.getPath("userData");
  serverProc = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      NITRO_PORT: String(PORT),
      HOST: "127.0.0.1",
      NITRO_HOST: "127.0.0.1",
      PGLITE_DATA_DIR: path.join(userData, "pglite"),
    },
    stdio: "pipe",
  });
  serverProc.stdout?.on("data", (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProc.stderr?.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
  serverProc.on("exit", (code) => {
    console.warn(`[server] exited ${code}`);
  });
}

function waitForServer(url, tries = 80) {
  return new Promise((resolve, reject) => {
    const tick = (left) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (left <= 0) reject(new Error("Spartan Browser server did not start"));
        else setTimeout(() => tick(left - 1), 250);
      });
    };
    tick(tries);
  });
}

function encodePowerShell(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

const IDENTITY_SCRIPT = `$ErrorActionPreference = 'SilentlyContinue'
$upn = (whoami /upn | Select-Object -First 1)
if (-not $upn) {
  try {
    $upn = [System.DirectoryServices.AccountManagement.UserPrincipal]::Current.UserPrincipalName
  } catch {}
}
if (-not $upn -and $env:USERNAME) { $upn = $env:USERNAME + '@miamidade.gov' }
$account = whoami
Write-Output 'MDC_IDENTITY'
Write-Output ('UPN=' + $upn)
Write-Output ('ACCOUNT=' + $account)
Write-Output ('USER=' + $env:USERNAME)
Write-Output ('DOMAIN=' + $env:USERDOMAIN)
`;

function parseIdentity(raw) {
  const text = String(raw || "").trim();
  const upnLine = text.match(/(?:^|\n)\s*UPN=([^\r\n]+)/i);
  const accountLine = text.match(/(?:^|\n)\s*ACCOUNT=([^\r\n]+)/i);
  const upn = (upnLine?.[1] || text).trim().toLowerCase();
  if (!upn.includes("@miamidade.gov")) return null;
  return { upn, account: (accountLine?.[1] || "").trim() };
}

function identityFromEnv() {
  const user = String(process.env.USERNAME || process.env.USER || "").trim();
  const domain = String(process.env.USERDOMAIN || "").trim();
  const upnEnv = String(process.env.USERPRINCIPALNAME || "").trim().toLowerCase();
  const account = domain && user ? `${domain}\\${user}` : user;
  if (upnEnv.includes("@miamidade.gov")) return { upn: upnEnv, account };
  if (user) return { upn: `${user.toLowerCase()}@miamidade.gov`, account };
  return null;
}

function runTimed(command, args, ms) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let out = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve("");
    }, ms);
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    const done = () => {
      clearTimeout(timer);
      resolve(out.trim());
    };
    child.on("close", done);
    child.on("error", () => {
      clearTimeout(timer);
      resolve("");
    });
  });
}

async function readWindowsIdentity() {
  const upnOut = (await runTimed("whoami", ["/upn"], 2500)).toLowerCase();
  if (upnOut.includes("@miamidade.gov")) {
    const account = await runTimed("whoami", [], 1500);
    return { upn: upnOut.split(/\s+/)[0], account };
  }
  const scriptOut = await runTimed(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodePowerShell(IDENTITY_SCRIPT)],
    3000,
  );
  return parseIdentity(scriptOut) || identityFromEnv();
}

const POP_TYPE = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;

[StructLayout(LayoutKind.Sequential)]
public struct ProofOfPossessionCookieInfo {
  [MarshalAs(UnmanagedType.LPWStr)] public string Name;
  [MarshalAs(UnmanagedType.LPWStr)] public string Data;
  public uint Flags;
  [MarshalAs(UnmanagedType.LPWStr)] public string P3PHeader;
}

[ComImport, Guid("CDAECE56-4EDF-43DF-B113-88E4556FA1BB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IProofOfPossessionCookieInfoManager {
  void GetCookieInfoForUri([MarshalAs(UnmanagedType.LPWStr)] string uri, out uint cookieCount, out IntPtr cookieInfo);
}

[ComImport, Guid("A9927F85-A304-4390-8B23-A75F1C668600")]
public class WindowsProofOfPossessionCookieInfoManager { }

public static class SpartanPopHelper {
  public static string Get(string uri) {
    var mgr = (IProofOfPossessionCookieInfoManager)new WindowsProofOfPossessionCookieInfoManager();
    uint count;
    IntPtr ptr;
    mgr.GetCookieInfoForUri(uri, out count, out ptr);
    var sb = new StringBuilder();
    int size = Marshal.SizeOf(typeof(ProofOfPossessionCookieInfo));
    for (int i = 0; i < count; i++) {
      var info = Marshal.PtrToStructure<ProofOfPossessionCookieInfo>(IntPtr.Add(ptr, i * size));
      if (string.IsNullOrEmpty(info.Name)) continue;
      if (sb.Length > 0) sb.Append('\n');
      sb.Append(info.Name).Append('=').Append(info.Data ?? "");
    }
    return sb.ToString();
  }
}
`;

const popCache = new Map();
const ssoSessions = new WeakSet();

function parsePopLines(raw) {
  return String(raw || "")
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("=");
      if (idx < 1) return null;
      return { name: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((row) => row && row.name && row.value);
}

async function proofOfPossessionCookies(uri) {
  if (process.platform !== "win32") return [];
  const key = (() => {
    try {
      return new URL(uri).origin;
    } catch {
      return uri;
    }
  })();
  const hit = popCache.get(key);
  if (hit && Date.now() - hit.at < 45_000) return hit.cookies;
  const escaped = String(uri).replace(/'/g, "''");
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
${POP_TYPE}
'@
[SpartanPopHelper]::Get('${escaped}')
`;
  const raw = await runTimed(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encodePowerShell(script)],
    4000,
  );
  const cookies = parsePopLines(raw);
  popCache.set(key, { at: Date.now(), cookies });
  return cookies;
}

function withEntraHints(urlString, upn) {
  if (!upn) return null;
  try {
    const url = new URL(urlString);
    if (!ENTRA_HOST.test(url.hostname)) return null;
    if (!/oauth2|authorize|login/i.test(url.pathname + url.search)) return null;
    if (url.searchParams.get("login_hint") === upn) return null;
    url.searchParams.set("login_hint", upn);
    url.searchParams.set("domain_hint", "miamidade.gov");
    return url.toString();
  } catch {
    return null;
  }
}

function entraAutofillScript(upn) {
  return `(function(){
    var upn = ${JSON.stringify(upn)};
    if (!upn) return;
    var input = document.querySelector('input[name="loginfmt"], input[type="email"]#i0116, input[type="email"]');
    if (!input) return;
    var current = (input.value || "").trim().toLowerCase();
    if (current === upn.toLowerCase()) return;
    var desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    if (desc && desc.set) desc.set.call(input, upn);
    else input.value = upn;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    var btn = document.querySelector("#idSIButton9");
    if (btn && !input.closest("form")?.querySelector('input[type="password"]')) btn.click();
  })();`;
}

function installCountySso(ses) {
  if (!ses || ssoSessions.has(ses)) return;
  ssoSessions.add(ses);
  try {
    ses.allowNTLMCredentialsForUrls(NTLM_URLS);
  } catch (err) {
    console.warn("[auth] NTLM allow list", err);
  }
  ses.setProxy({ mode: "system" }).catch(() => {});
  try {
    ses.setUserAgent(CHROME_UA);
  } catch {
    /* older electron */
  }
  ses.webRequest.onBeforeRequest({ urls: ["https://login.microsoftonline.com/*", "https://login.windows.net/*", "https://login.microsoft.com/*"] }, (details, callback) => {
    if (details.method !== "GET") return callback({});
    const next = withEntraHints(details.url, cachedUpn);
    if (next) return callback({ redirectURL: next });
    callback({});
  });
  ses.webRequest.onBeforeSendHeaders(
    {
      urls: [
        "https://login.microsoftonline.com/*",
        "https://login.windows.net/*",
        "https://login.microsoft.com/*",
        "https://autologon.microsoftazuread-sso.com/*",
        "https://*.msftauth.net/*",
        "https://*.msauth.net/*",
      ],
    },
    (details, callback) => {
      const headers = { ...(details.requestHeaders || {}) };
      proofOfPossessionCookies(details.url)
        .then((cookies) => {
          if (cookies.length) {
            const extra = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
            headers.Cookie = headers.Cookie ? `${headers.Cookie}; ${extra}` : extra;
          }
          callback({ requestHeaders: headers });
        })
        .catch(() => callback({ requestHeaders: headers }));
    },
  );
}

function attachEntraHelpers(contents) {
  contents.on("did-finish-load", () => {
    const url = contents.getURL?.() || "";
    if (!cachedUpn || !ENTRA_HOST.test(url)) return;
    contents.executeJavaScript(entraAutofillScript(cachedUpn)).catch(() => {});
  });
  try {
    contents.setUserAgent(CHROME_UA);
  } catch {
    /* guest may not support it yet */
  }
}

const DESKTOP_LAUNCHERS = {
  notepad: [{ cmd: "notepad.exe" }],
  calc: [{ cmd: "calc.exe" }],
  teamviewer: [
    { path: "C:\\Program Files\\TeamViewer\\TeamViewer.exe" },
    { path: "C:\\Program Files (x86)\\TeamViewer\\TeamViewer.exe" },
    { cmd: "TeamViewer.exe" },
  ],
  mainframe: [
    { path: "C:\\Program Files\\MochaSoft\\Mocha TN3270\\tn3270.exe" },
    { path: "C:\\Program Files (x86)\\MochaSoft\\Mocha TN3270\\tn3270.exe" },
    { path: "C:\\Program Files\\Mocha TN3270\\tn3270.exe" },
    { cmd: "tn3270.exe" },
  ],
  lockout: [
    { path: "C:\\Program Files\\Windows Resource Kits\\Tools\\lockoutstatus.exe" },
    { path: "C:\\Program Files (x86)\\Windows Resource Kits\\Tools\\lockoutstatus.exe" },
    { cmd: "lockoutstatus.exe" },
  ],
  aduc: [{ cmd: "mmc.exe", args: ["dsa.msc"] }],
  cmrc: [
    {
      path: "C:\\Program Files (x86)\\Microsoft Configuration Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe",
    },
    { path: "C:\\Program Files\\Microsoft Configuration Manager\\AdminConsole\\bin\\i386\\CmRcViewer.exe" },
    { cmd: "CmRcViewer.exe" },
  ],
};

function spawnDetached(cmd, args = []) {
  const child = spawn(cmd, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
    shell: false,
  });
  child.unref();
}

async function launchDesktopApp(id) {
  const key = String(id || "").toLowerCase();
  const candidates = DESKTOP_LAUNCHERS[key];
  if (!candidates) return { ok: false, error: "Unknown desktop app." };
  const errors = [];
  for (const item of candidates) {
    try {
      if (item.path) {
        if (!fs.existsSync(item.path)) continue;
        const err = await shell.openPath(item.path);
        if (!err) return { ok: true };
        errors.push(err);
        continue;
      }
      spawnDetached(item.cmd, item.args || []);
      return { ok: true };
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return {
    ok: false,
    error: `Could not open this tool. Install it on this PC${errors[0] ? ` (${errors[0]})` : ""}.`,
  };
}

function isSafeElevatedCommand(command) {
  return /^powershell\.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand [A-Za-z0-9+/=]+$/i.test(
    String(command || "").trim(),
  );
}

function launchElevated(payload) {
  const command = String(payload?.command || "").trim();
  const password = String(payload?.password || "");
  if (!isSafeElevatedCommand(command)) {
    return { ok: false, error: "That launch command is not allowed." };
  }
  const parts = command.split(" ");
  const encoded = parts[parts.length - 1];
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { windowsHide: false, stdio: ["pipe", "ignore", "ignore"] },
  );
  child.stdin.write(`${password}\n`);
  child.stdin.end();
  child.unref();
  return { ok: true };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Spartan Browser",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "electron-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      partition: "persist:spartan",
    },
  });
  win.loadURL(`http://127.0.0.1:${PORT}/`);
}

function keepInsideSpartan(url) {
  if (!url || url === "about:blank") return { action: "deny" };
  if (url.startsWith("mailto:") || url.startsWith("tel:")) {
    shell.openExternal(url);
    return { action: "deny" };
  }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("open-new-tab", url);
  }
  return { action: "deny" };
}

ipcMain.handle("app-version", () => app.getVersion());
ipcMain.handle("windows-identity", async () => {
  try {
    const identity = (await readWindowsIdentity()) || identityFromEnv();
    if (identity?.upn) cachedUpn = identity.upn;
    return identity;
  } catch {
    const identity = identityFromEnv();
    if (identity?.upn) cachedUpn = identity.upn;
    return identity;
  }
});
ipcMain.handle("desktop:launch", async (_event, id) => launchDesktopApp(id));
ipcMain.handle("desktop:elevated", async (_event, payload) => launchElevated(payload));

const updateState = {
  phase: "idle",
  currentVersion: "",
  latestVersion: null,
  percent: 0,
  error: null,
};

function snapshotUpdate() {
  return {
    ...updateState,
    currentVersion: app.isReady() ? app.getVersion() : updateState.currentVersion,
    packaged: app.isPackaged,
  };
}

function broadcastUpdate() {
  const payload = snapshotUpdate();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("updater:status", payload);
  }
}

function setupUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => {
    updateState.phase = "checking";
    updateState.error = null;
    broadcastUpdate();
  });
  autoUpdater.on("update-available", (info) => {
    updateState.phase = "available";
    updateState.latestVersion = info?.version ?? null;
    updateState.error = null;
    broadcastUpdate();
  });
  autoUpdater.on("update-not-available", (info) => {
    updateState.phase = "current";
    updateState.latestVersion = info?.version ?? app.getVersion();
    updateState.percent = 0;
    updateState.error = null;
    broadcastUpdate();
  });
  autoUpdater.on("download-progress", (progress) => {
    updateState.phase = "downloading";
    updateState.percent = Math.max(0, Math.min(100, Math.round(progress?.percent || 0)));
    broadcastUpdate();
  });
  autoUpdater.on("update-downloaded", (info) => {
    updateState.phase = "ready";
    updateState.latestVersion = info?.version ?? updateState.latestVersion;
    updateState.percent = 100;
    updateState.error = null;
    broadcastUpdate();
  });
  autoUpdater.on("error", (err) => {
    updateState.phase = "error";
    updateState.error = err instanceof Error ? err.message : String(err);
    broadcastUpdate();
  });
}

ipcMain.handle("updater:get", () => snapshotUpdate());
ipcMain.handle("updater:check", async () => {
  if (!app.isPackaged) {
    updateState.phase = "error";
    updateState.error = "Install Spartan Browser to receive desktop updates.";
    broadcastUpdate();
    return snapshotUpdate();
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    updateState.phase = "error";
    updateState.error = err instanceof Error ? err.message : String(err);
    broadcastUpdate();
  }
  return snapshotUpdate();
});
ipcMain.handle("updater:install", () => {
  if (updateState.phase !== "ready") return { ok: false };
  if (serverProc && !serverProc.killed) serverProc.kill();
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 200);
  return { ok: true };
});

app.on("web-contents-created", (_event, contents) => {
  installCountySso(contents.session);
  attachEntraHelpers(contents);
  contents.setWindowOpenHandler(({ url }) => keepInsideSpartan(url));
  contents.on("will-attach-webview", (_event, prefs) => {
    prefs.partition = "persist:spartan";
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
  });
  contents.on("did-attach-webview", (_event, guest) => {
    installCountySso(guest.session);
    attachEntraHelpers(guest);
    try {
      guest.setUserAgent(CHROME_UA);
    } catch {
      /* ignore */
    }
  });
  contents.on("will-navigate", (event, url) => {
    if (contents.getType() !== "window") return;
    if (url.startsWith(`http://127.0.0.1:${PORT}`)) return;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      event.preventDefault();
      keepInsideSpartan(url);
    }
  });
});

app.whenReady().then(async () => {
  const ses = session.fromPartition("persist:spartan");
  installCountySso(ses);
  installCountySso(session.defaultSession);
  const bootId = identityFromEnv();
  if (bootId?.upn) cachedUpn = bootId.upn;
  readWindowsIdentity()
    .then((identity) => {
      if (identity?.upn) cachedUpn = identity.upn;
    })
    .catch(() => {});
  startServer();
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  createWindow();
  setupUpdater();
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.warn("updater", err);
      });
    }, 4000);
  }
  globalShortcut.register("CommandOrControl+T", () => {
    BrowserWindow.getFocusedWindow()?.webContents.send("shortcut:new-tab");
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("login", (event, _webContents, _request, authInfo, callback) => {
  const scheme = String(authInfo.scheme || "").toLowerCase();
  const host = String(authInfo.host || "");
  if (authInfo.isProxy || scheme === "ntlm" || scheme === "negotiate" || COUNTY_AUTH_HOST.test(host)) {
    event.preventDefault();
    callback("", "");
    return;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProc && !serverProc.killed) serverProc.kill();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
