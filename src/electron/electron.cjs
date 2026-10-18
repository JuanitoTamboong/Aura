// electron/electron.cjs
const { app, BrowserWindow, session, shell } = require('electron');
const path = require('path');

// --- 1. GOOGLE CLOUD API CREDENTIALS ---
// Replace these strings with the actual keys you copied from Google Cloud
process.env.GOOGLE_API_KEY = 'YOUR_API_KEY_HERE';
process.env.GOOGLE_DEFAULT_CLIENT_ID = 'REMOVED';
process.env.GOOGLE_DEFAULT_CLIENT_SECRET = 'REMOVED';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), // Link the preload script
      nodeIntegration: false, // Turn this OFF for security
      contextIsolation: true, // Turn this ON for security
    },
  });

  // --- 2. ALLOW MICROPHONE PERMISSIONS ---
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      return callback(true); // Allow
    }
    return callback(false); // Deny everything else
  });

  // --- 3. OPEN EXTERNAL LINKS IN DEFAULT BROWSER ---
  // This intercepts window.open() calls and opens them in Chrome/Edge
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' }; // Prevent Electron from opening a blank popup
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;
  
  win.loadURL(startUrl);
  
  if (process.env.ELECTRON_START_URL) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});