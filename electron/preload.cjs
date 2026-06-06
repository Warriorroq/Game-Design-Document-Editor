const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gddDesktop", {
  isDesktop: true,
  platform: process.platform,
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("window:toggle-maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
    focus: () => ipcRenderer.invoke("window:focus"),
    onMaximizedChanged: (listener) => {
      const handler = (_event, maximized) => listener(Boolean(maximized));
      ipcRenderer.on("window:maximized-changed", handler);
      return () => ipcRenderer.removeListener("window:maximized-changed", handler);
    },
  },
  project: {
    pickFolder: () => ipcRenderer.invoke("project:pick-folder"),
    readFolder: (folderPath) =>
      ipcRenderer.invoke("project:read-folder", folderPath),
    writeFolder: (folderPath, payload) =>
      ipcRenderer.invoke("project:write-folder", folderPath, payload),
  },
  git: {
    isAvailable: () => ipcRenderer.invoke("git:is-available"),
    status: (folderPath) => ipcRenderer.invoke("git:status", folderPath),
    init: (folderPath) => ipcRenderer.invoke("git:init", folderPath),
    commit: (folderPath, message, identity) =>
      ipcRenderer.invoke("git:commit", folderPath, message, identity),
    getIdentity: (folderPath) =>
      ipcRenderer.invoke("git:get-identity", folderPath),
    setIdentity: (folderPath, name, email) =>
      ipcRenderer.invoke("git:set-identity", folderPath, name, email),
    push: (folderPath) => ipcRenderer.invoke("git:push", folderPath),
    pull: (folderPath) => ipcRenderer.invoke("git:pull", folderPath),
    getRemote: (folderPath) => ipcRenderer.invoke("git:get-remote", folderPath),
    setRemote: (folderPath, url) =>
      ipcRenderer.invoke("git:set-remote", folderPath, url),
    authenticate: (folderPath) =>
      ipcRenderer.invoke("git:authenticate", folderPath),
    storeToken: (folderPath, token) =>
      ipcRenderer.invoke("git:store-token", folderPath, token),
    onProgress: (listener) => {
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on("git:progress", handler);
      return () => ipcRenderer.removeListener("git:progress", handler);
    },
  },
});
