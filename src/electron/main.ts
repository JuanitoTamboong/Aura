// electron/main.ts
import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

// ★ This will be used below, which removes the warning
const alarmTimers = new Map<string, NodeJS.Timeout>();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ... your existing loadURL logic (e.g., mainWindow.loadURL(...)) ...

  // ★ THIS IS THE MISSING PART THAT USES 'alarmTimers'
  ipcMain.on('set-alarm', (_event, payload: { id: string; time: number; message: string }) => {
    const { id, time, message } = payload;
    const delay = time - Date.now();
    
    if (delay <= 0) return;

    // Check if there's already a timer for this ID and cancel it
    if (alarmTimers.has(id)) {
      clearTimeout(alarmTimers.get(id));
    }

    // Set the timer
    const timer = setTimeout(() => {
      // 1. Show OS Notification
      new Notification({
        title: 'Aura Alarm',
        body: message,
        urgency: 'critical',
      }).show();

      // 2. Bring window to front & tell React to play sound
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('play-alarm', { message });
      }

      // Clean up
      alarmTimers.delete(id);
    }, delay);

    // Save the timer reference
    alarmTimers.set(id, timer);
  });

  ipcMain.on('cancel-alarm', (_event, id: string) => {
    const t = alarmTimers.get(id);
    if (t) {
      clearTimeout(t);
      alarmTimers.delete(id);
    }
  });
  // ★ End of missing part
}

// ★ Uses 'app' so you don't get a warning for that either
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});