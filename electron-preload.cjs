const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spartanDesktop", {
  packaged: true,
  version: () => ipcRenderer.invoke("app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  windowsUpn: () => ipcRenderer.invoke("windows-upn"),
});
