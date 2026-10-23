// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setAlarm: (id, time, message) =>
    ipcRenderer.send('set-alarm', { id, time, message }),

  cancelAlarm: (id) =>
    ipcRenderer.send('cancel-alarm', id),

  onPlayAlarm: (cb) => {
    ipcRenderer.on('play-alarm', (_event, data) => cb(data));
  },
});