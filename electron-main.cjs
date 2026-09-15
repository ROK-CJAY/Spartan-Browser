const { app, BrowserWindow, ipcMain, session, globalShortcut, shell } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");

const PORT = Number(process.env.SPARTAN_PORT || 47821);
let serverProc = null;

app.commandLine.appendSwitch("auth-server-whitelist", "*.miamidade.gov,*.sharepoint.com,login.microsoftonline.com");
app.commandLine.appendSwitch("auth-negotiate-delegate-whitelist", "*.miamidade.gov,*.sharepoint.com");
app.commandLine.appendSwitch("auth-schemes", "ntlm,negotiate");
app.commandLine.appendSwitch("proxy-auto-detect");

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
  const fs = require("fs");
  return candidates.find((file) => fs.existsSync(file)) ?? candidates[0];
}

function startServer() {
  const entry = serverEntry();
  serverProc = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PORT),
      NITRO_PORT: String(PORT),
      HOST: "127.0.0.1",
      NITRO_HOST: "127.0.0.1",
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
    },
  });
  win.loadURL(`http://127.0.0.1:${PORT}/`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("app-version", () => app.getVersion());
ipcMain.handle("check-for-updates", async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      ok: true,
      version: result?.updateInfo?.version ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
ipcMain.handle("windows-upn", () => {
  return new Promise((resolve) => {
    const child = spawn("whoami", ["/upn"], { windowsHide: true });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk.toString();
    });
    child.on("close", () => resolve(out.trim().toLowerCase()));
    child.on("error", () => resolve(""));
  });
});

app.whenReady().then(async () => {
  startServer();
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  createWindow();
  autoUpdater.autoDownload = true;
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn("updater", err);
  });
  globalShortcut.register("CommandOrControl+T", () => {
    BrowserWindow.getFocusedWindow()?.webContents.send("shortcut:new-tab");
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("login", (event, _webContents, _request, authInfo, callback) => {
  event.preventDefault();
  if (!authInfo.isProxy && /miamidade\.gov|sharepoint\.com|microsoftonline\.com/.test(authInfo.host)) {
    callback("", "");
  } else {
    callback();
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
