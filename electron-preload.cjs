const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spartanDesktop", {
  packaged: true,
  version: () => ipcRenderer.invoke("app-version"),
  windowsIdentity: () => ipcRenderer.invoke("windows-identity"),
  getUpdateStatus: () => ipcRenderer.invoke("updater:get"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
  onOpenTab: (callback) => {
    const listener = (_event, url) => {
      if (typeof url === "string" && url) callback(url);
    };
    ipcRenderer.on("open-new-tab", listener);
    return () => ipcRenderer.removeListener("open-new-tab", listener);
  },
});
