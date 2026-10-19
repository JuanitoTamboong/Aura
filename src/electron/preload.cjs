
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  showNotification: (title, body) => {
    if (typeof title !== "string" || typeof body !== "string") {
      return false;
    }

    if (!("Notification" in window)) {
      return false;
    }

    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return true;
    }

    return false;
  },

  getSystemInfo: () => ({
    platform: process.platform,
    arch: process.arch,
  }),
});
