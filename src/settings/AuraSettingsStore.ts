// src/settings/AuraSettingsStore.ts

export interface AuraSettings {
  voice: {
    selectedVoiceName: string;
    rate: number;            // 0.5 – 1.5, default 0.95
    pitch: number;           // 0.5 – 1.5, default 0.85
    volume: number;          // 0 – 1,   default 1
    muteAura: boolean;       // default false
    wakeWord: string;        // default "aura"
    wakeCooldownMs: number;  // default 2500
    micDeviceId: string;     // "" = system default
  };
  profile: {
    name: string;
    facts: string[];
  };
  appearance: {
    lightMode: boolean;
    accent: "violet" | "cyan" | "pink" | "amber" | "emerald" | "custom";
    customAccent: string;
    reduceMotion: boolean;
    compactMode: boolean;
    showScanlines: boolean;
    showParticles: boolean;
  };
  alarms: {
    defaultSound: "alarm-clock" | "chime" | "beep";
    snoozeMinutes: 5 | 10 | 15;
    volume: number;
    autoDismissSec: 0 | 10 | 30;
    speakMessage: boolean;
  };
  privacy: {
    persistHistory: boolean;
    persistWorkspace: boolean;
    persistConversation: boolean;
    telemetry: boolean;
  };
  advanced: {
    debugMode: boolean;
    showRawPrompt: boolean;
    modelOverride: string;
    maxTokens: number;
    apiEndpoint: string;
  };
}

const STORAGE_KEY = "aura_settings";

export const DEFAULT_SETTINGS: AuraSettings = {
  voice: {
    selectedVoiceName: "",
    rate: 0.95,
    pitch: 0.85,
    volume: 1,
    muteAura: false,
    wakeWord: "aura",
    wakeCooldownMs: 2500,
    micDeviceId: "",
  },
  profile: {
    name: "Sir",
    facts: [],
  },
  appearance: {
    lightMode: true,
    accent: "violet",
    customAccent: "#8b5cf6",
    reduceMotion: false,
    compactMode: false,
    showScanlines: true,
    showParticles: true,
  },
  alarms: {
    defaultSound: "alarm-clock",
    snoozeMinutes: 5,
    volume: 1,
    autoDismissSec: 0,
    speakMessage: true,
  },
  privacy: {
    persistHistory: true,
    persistWorkspace: true,
    persistConversation: true,
    telemetry: false,
  },
  advanced: {
    debugMode: false,
    showRawPrompt: false,
    modelOverride: "",
    maxTokens: 1200,
    apiEndpoint: "",
  },
};

// Deep merge utility to handle backwards compatibility (e.g., if a new setting is added later)
const deepMerge = <T>(base: T, override: any): T => {
  if (override === null || override === undefined) return base;
  if (typeof base !== "object" || Array.isArray(base)) {
    return override as T;
  }
  const out: any = { ...base };
  for (const key of Object.keys(base as any)) {
    if (key in override) {
      out[key] = deepMerge((base as any)[key], override[key]);
    }
  }
  return out;
};

/**
 * Loads settings from localStorage.
 * If no settings exist, it attempts to migrate old single-key settings 
 * (like "aura_light_mode") before falling back to defaults.
 */
export const loadSettings = (): AuraSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    
    // First time loading (no settings object exists)
    if (!raw) {
      const migrated: AuraSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

      const oldLight = localStorage.getItem("aura_light_mode");
      if (oldLight !== null) migrated.appearance.lightMode = oldLight === "true";

      const oldVoice = localStorage.getItem("aura_selected_voice");
      if (oldVoice) migrated.voice.selectedVoiceName = oldVoice;

      return migrated;
    }

    // Settings exist, parse and merge with defaults to catch any missing new keys
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch (err) {
    console.warn("Failed to load Aura settings, using defaults:", err);
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
};

/**
 * Saves settings to localStorage and updates legacy keys
 * so older components don't break if they read them directly.
 */
export const saveSettings = (settings: AuraSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    
    // Write-through compatibility keys
    localStorage.setItem("aura_light_mode", String(settings.appearance.lightMode));
    if (settings.voice.selectedVoiceName) {
      localStorage.setItem("aura_selected_voice", settings.voice.selectedVoiceName);
    }
  } catch (err) {
    console.warn("Failed to save Aura settings:", err);
  }
};

/**
 * Resets settings to defaults but keeps user data (history, etc.)
 */
export const resetSettings = (): AuraSettings => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
};

/**
 * Wipes EVERYTHING (all aura_ keys) and reloads the page.
 * Used by the "Factory Reset" button.
 */
export const factoryReset = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("aura_"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  window.location.reload();
};

/**
 * Analyzes localStorage to show the user how much space Aura is using.
 */
export const getStorageSummary = (): { key: string; size: number }[] => {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith("aura_"))
      .map((k) => {
        const v = localStorage.getItem(k) || "";
        return { key: k, size: new Blob([v]).size };
      })
      .sort((a, b) => b.size - a.size);
  } catch {
    return [];
  }
};