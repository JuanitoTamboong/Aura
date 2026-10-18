// electron/preload.cjs
const { contextBridge } = require('electron');

// This exposes a safe "api" object to your React code (window.electronAPI)
contextBridge.exposeInMainWorld('electronAPI', {
  // You can add native functions here later
  showNotification: (title, body) => {
    new Notification(title, { body });
  },
  getSystemInfo: () => {
    return {
      platform: process.platform,
      arch: process.arch,
    };
  }
});