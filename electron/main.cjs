const { app, BrowserWindow, Menu, ipcMain, dialog, session } = require("electron");
const fs = require("fs");
const path = require("path");
const git = require("./git.cjs");
const project = require("./project.cjs");

const BG = "#0f1117";
const APP_ICON = path.join(__dirname, "icon.png");

let mainWindow = null;
let pendingGdePath = null;

function isGdeFileArg(arg) {
  if (typeof arg !== "string" || !arg || arg.startsWith("-")) return false;
  const normalized = arg.replace(/^"|"$/g, "");
  return normalized.toLowerCase().endsWith(".gde");
}

function extractGdePath(argv) {
  for (const arg of argv) {
    if (isGdeFileArg(arg)) {
      return path.resolve(arg.replace(/^"|"$/g, ""));
    }
  }
  return null;
}

function sendOpenGdeToRenderer(filePath) {
  if (!mainWindow) {
    pendingGdePath = filePath;
    return;
  }

  const deliver = () => {
    mainWindow.webContents.send("project:open-archive", filePath);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  };

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once("did-finish-load", deliver);
  } else {
    deliver();
  }
}

function tryOpenGdePath(filePath) {
  if (!filePath || !isGdeFileArg(filePath)) return;
  const resolved = path.resolve(filePath.replace(/^"|"$/g, ""));
  if (!fs.existsSync(resolved)) return;
  sendOpenGdeToRenderer(resolved);
}

function flushPendingGdeOpen() {
  if (!pendingGdePath) return;
  const next = pendingGdePath;
  pendingGdePath = null;
  tryOpenGdePath(next);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    tryOpenGdePath(extractGdePath(argv));
  });
}

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  tryOpenGdePath(filePath);
});

function registerIpcHandlers(win) {
  ipcMain.handle("window:minimize", () => win.minimize());
  ipcMain.handle("window:toggle-maximize", () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("window:close", () => win.close());
  ipcMain.handle("window:is-maximized", () => win.isMaximized());
  ipcMain.handle("window:focus", () => {
    win.focus();
    win.webContents.focus();
  });

  ipcMain.handle("project:pick-folder", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "Open GDD project folder",
    });
    if (result.canceled || !result.filePaths[0]) {
      return { ok: false, canceled: true };
    }
    const folderPath = result.filePaths[0];
    return {
      ok: true,
      folderPath,
      hasProject: project.hasProjectFile(folderPath),
    };
  });

  ipcMain.handle("project:read-folder", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return project.readProjectFolder(folderPath);
  });

  ipcMain.handle("project:write-folder", (_event, folderPath, payload) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "invalid_payload" };
    }
    return project.writeProjectFolder(folderPath, payload);
  });

  ipcMain.handle("project:read-archive", (_event, filePath) => {
    if (typeof filePath !== "string" || !filePath) {
      return { ok: false, error: "invalid_path" };
    }
    return project.readGdeArchiveFile(filePath);
  });

  ipcMain.handle("git:is-available", () => git.isGitAvailable());

  ipcMain.handle("git:status", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return git.getStatus(folderPath);
  });

  ipcMain.handle("git:init", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return git.initRepo(folderPath);
  });

  ipcMain.handle("git:commit", (_event, folderPath, message, identity) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    if (typeof message !== "string" || !message.trim()) {
      return { ok: false, error: "empty_message" };
    }
    const parsedIdentity =
      identity && typeof identity === "object"
        ? {
            name:
              typeof identity.name === "string" ? identity.name.trim() : "",
            email:
              typeof identity.email === "string" ? identity.email.trim() : "",
          }
        : undefined;
    return git.commit(folderPath, message.trim(), parsedIdentity);
  });

  ipcMain.handle("git:get-identity", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    if (!git.isGitRepo(folderPath)) {
      return { ok: true, name: "", email: "" };
    }
    return git.getIdentity(folderPath);
  });

  ipcMain.handle("git:set-identity", (_event, folderPath, name, email) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    if (typeof name !== "string" || typeof email !== "string") {
      return { ok: false, error: "missing_identity" };
    }
    return git.setIdentity(folderPath, name, email);
  });

  ipcMain.handle("git:push", (event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    const onProgress = (payload) => {
      event.sender.send("git:progress", payload);
    };
    return git.push(folderPath, onProgress);
  });

  ipcMain.handle("git:pull", (event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    const onProgress = (payload) => {
      event.sender.send("git:progress", payload);
    };
    return git.pull(folderPath, onProgress);
  });

  ipcMain.handle("git:stash", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return git.stashChanges(folderPath);
  });

  ipcMain.handle("git:discard-project", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return git.discardProjectChanges(folderPath);
  });

  ipcMain.handle("git:get-remote", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return git.getRemoteUrl(folderPath);
  });

  ipcMain.handle("git:set-remote", (_event, folderPath, url) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    if (typeof url !== "string" || !url.trim()) {
      return { ok: false, error: "invalid_url" };
    }
    return git.setRemoteUrl(folderPath, url.trim());
  });

  ipcMain.handle("git:authenticate", (_event, folderPath) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    return git.authenticateRemote(folderPath);
  });

  ipcMain.handle("git:store-token", (_event, folderPath, token) => {
    if (typeof folderPath !== "string" || !folderPath) {
      return { ok: false, error: "invalid_path" };
    }
    if (typeof token !== "string" || !token.trim()) {
      return { ok: false, error: "missing_token" };
    }
    return git.storeAccessToken(folderPath, token.trim());
  });
}

let ipcRegistered = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    roundedCorners: false,
    backgroundColor: BG,
    icon: APP_ICON,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  if (!ipcRegistered) {
    registerIpcHandlers(win);
    ipcRegistered = true;
  }

  const emitMaxChanged = () =>
    win.webContents.send("window:maximized-changed", win.isMaximized());
  win.on("maximize", emitMaxChanged);
  win.on("unmaximize", emitMaxChanged);

  win.once("ready-to-show", () => win.show());

  win.webContents.once("did-finish-load", () => {
    flushPendingGdeOpen();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function configureEmbedReferrer() {
  const embedReferer = "https://localhost/";
  const filter = {
    urls: [
      "*://*.youtube.com/*",
      "*://*.youtube-nocookie.com/*",
      "*://*.googlevideo.com/*",
      "*://*.ytimg.com/*",
    ],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const headers = { ...details.requestHeaders };
    // file:// app pages send no Referer; YouTube embeds require one (error 153).
    headers.Referer = embedReferer;
    callback({ requestHeaders: headers });
  });
}

if (gotSingleInstanceLock) {
  app.whenReady().then(() => {
    configureEmbedReferrer();
    Menu.setApplicationMenu(null);
    createWindow();
    tryOpenGdePath(extractGdePath(process.argv));

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
