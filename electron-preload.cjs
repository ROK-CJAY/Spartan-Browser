const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spartanDesktop", {
  packaged: true,
  version: () => ipcRenderer.invoke("app-version"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  windowsIdentity: () => ipcRenderer.invoke("windows-identity"),
  onOpenTab: (callback) => {
    const listener = (_event, url) => {
      if (typeof url === "string" && url) callback(url);
    };
    ipcRenderer.on("open-new-tab", listener);
    return () => ipcRenderer.removeListener("open-new-tab", listener);
  },
});
