// src/types/electron.d.ts

export interface ElectronAPI {
  setAlarm: (id: string, time: number, message: string) => void;
  cancelAlarm: (id: string) => void;
  onPlayAlarm: (cb: (data: { message: string }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}