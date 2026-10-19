const { app, BrowserWindow, session, shell } = require("electron");
const path = require("path");
const dotenv = require("dotenv"); // ADDED

// ADDED: Load .env from root in dev, and from resources folder in production .exe
dotenv.config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, ".env")
    : path.resolve(process.cwd(), ".env"),
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    center: true,
    autoHideMenuBar: true,
    backgroundColor: "#080713",
    show: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Display the window only after it is ready.
  win.once("ready-to-show", () => {
    win.show();
  });

  // Allow microphone and media permissions.
  const ses = win.webContents.session;

  ses.setPermissionCheckHandler(
    (_webContents, permission) => {
      return permission === "media";
    }
  );

  ses.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "media");
    }
  );

  // Open external websites in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }

    return { action: "deny" };
  });

  // Load the Vite development server or production build.
  const devUrl = process.env.ELECTRON_START_URL;

  if (devUrl) {
    win.loadURL(devUrl).catch(console.error);
  } else {
    // FIXED: Use app.getAppPath() to correctly find the dist folder inside the .exe
    const indexPath = path.join(app.getAppPath(), "dist/index.html");
    win.loadFile(indexPath).catch(console.error); 
  }

  // Developer Tools open only when explicitly requested.
  if (process.env.OPEN_DEVTOOLS === "true") {
    win.webContents.openDevTools({ mode: "detach" });
  }

  // Optional keyboard shortcut for opening DevTools.
  win.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      input.key === "F12"
    ) {
      win.webContents.toggleDevTools();
    }
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});