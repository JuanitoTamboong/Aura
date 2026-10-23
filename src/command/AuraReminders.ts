// src/command/AuraReminders.ts

// ★ Import your custom sound
import alarmSound from "../assets/sound/alarm-clock.mp3";

export interface Reminder {
  id: string;
  time: number; // Timestamp
  message: string;
  active: boolean;
}

const STORAGE_KEY = "aura_reminders";

let activeAudio: HTMLAudioElement | null = null;

// ★ Map of reminder.id → timeout handle so multiple alarms coexist in browser mode
const activeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

// ★ NEW: Global EventTarget to broadcast stop signals to React
export const alarmEvents = new EventTarget();

/* ------------------------------------------------------------------ */
/* Storage                                                            */
/* ------------------------------------------------------------------ */

export const getReminders = (): Reminder[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveReminders = (reminders: Reminder[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch (e) {
    console.warn("Failed to save reminders:", e);
  }
};

export const removeReminder = (id: string) => {
  saveReminders(getReminders().filter((r) => r.id !== id));
};

/* ------------------------------------------------------------------ */
/* Time parsing                                                       */
/* ------------------------------------------------------------------ */

export const parseTime = (timeStr: string): Date | null => {
  const now = new Date();
  const lowerStr = timeStr.toLowerCase().trim();

  // ★ FIXED: Match durations like "for 2 minutes", "in 5 hours", "for 1 minute"
  const durationMatch = lowerStr.match(/(?:in|for)\s+(\d+)\s*(second|minute|hour)s?/);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2];
    const target = new Date(now);
    if (unit === "second") target.setSeconds(target.getSeconds() + amount);
    if (unit === "minute") target.setMinutes(target.getMinutes() + amount);
    if (unit === "hour") target.setHours(target.getHours() + amount);
    return target;
  }

  // Match simple duration like "2 minutes"
  const simpleDuration = lowerStr.match(/^(\d+)\s*(second|minute|hour)s?$/);
  if (simpleDuration) {
    const amount = parseInt(simpleDuration[1], 10);
    const unit = simpleDuration[2];
    const target = new Date(now);
    if (unit === "second") target.setSeconds(target.getSeconds() + amount);
    if (unit === "minute") target.setMinutes(target.getMinutes() + amount);
    if (unit === "hour") target.setHours(target.getHours() + amount);
    return target;
  }

  // Match clock times like "3:20 am", "15:30", "8 pm"
  const timeMatch = lowerStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3];

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    if (hours > 23 || minutes > 59) return null;

    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target;
  }

  return null;
};

/* ------------------------------------------------------------------ */
/* Set reminder                                                       */
/* ------------------------------------------------------------------ */

const randomOf = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

export const setReminder = (
  command: string
): { success: boolean; message: string } => {
  
  // ★ FIXED: Prioritize matching duration phrases over clock times
  let timeMatch = command.match(/(?:in|for)\s+\d+\s*(?:second|minute|hour)s?/i);
  
  if (!timeMatch) {
    timeMatch = command.match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i);
  }

  if (!timeMatch) {
    return {
      success: false,
      message: randomOf([
        "I caught the alarm request, but I'm missing a time. When should I wake you?",
        "I need a time to lock this in. Try something like '3:20 PM' or 'in ten minutes'.",
        "I'm ready to set it, but I need the 'when'. What time works?",
        "Hmm, no time detected. Give me a clock time or a duration.",
      ]),
    };
  }

  const timeString = timeMatch[0];
  const targetDate = parseTime(timeString);
  
  if (!targetDate) {
    return {
      success: false,
      message: randomOf([
        "That time didn't parse for me. Try '3:20 PM' or 'in 20 minutes'.",
        "I recognized a time but couldn't read it. Mind saying it again?",
        "Something about that time didn't land. Try 'at 6 AM' or 'in 15 minutes'.",
      ]),
    };
  }

  // Extract the reminder text (whatever follows the time)
  let message = "Aura Reminder";
  const afterTime = command
    .slice(command.indexOf(timeString) + timeString.length)
    .trim();

  const messageMatch = afterTime.match(/^(?:to|that)\s+(.+)$/i);
  if (messageMatch) {
    message = messageMatch[1].trim();
  } else if (/\bwake me\b/i.test(command)) {
    message = "Wake up!";
  } else if (afterTime.length > 0) {
    message = afterTime.replace(/^[.,\s-]+/, "").trim() || message;
  }

  // Request notification permission now
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }

  const newReminder: Reminder = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: targetDate.getTime(),
    message,
    active: true,
  };

  const reminders = getReminders();
  reminders.push(newReminder);
  saveReminders(reminders);

  scheduleAlarm(newReminder);

  const timeFormatted = targetDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isTomorrow =
    targetDate.toDateString() !== new Date().toDateString();

  return {
    success: true,
    message: randomOf([
      `Locked in for ${timeFormatted}${isTomorrow ? " tomorrow" : ""}. I'll remind you: "${message}".`,
      `Alarm armed for ${timeFormatted}${isTomorrow ? " tomorrow" : ""}. Reminder: "${message}".`,
      `Got it — I'll chime at ${timeFormatted}${isTomorrow ? " tomorrow" : ""} with: "${message}".`,
      `Scheduled for ${timeFormatted}${isTomorrow ? " tomorrow" : ""}. I'll be there with: "${message}".`,
    ]),
  };
};

/* ------------------------------------------------------------------ */
/* Schedule alarm                                                     */
/* ------------------------------------------------------------------ */

export const scheduleAlarm = (reminder: Reminder) => {
  // 1. Try to use Electron's Main Process Timer
  if ((window as any).electronAPI?.setAlarm) {
    (window as any).electronAPI.setAlarm(
      reminder.id,
      reminder.time,
      reminder.message
    );
    return;
  }

  // 2. Fallback to Browser setTimeout
  const delay = reminder.time - Date.now();

  if (delay <= 0) {
    triggerAlarm(reminder);
    return;
  }

  const existing = activeTimeouts.get(reminder.id);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(() => {
    activeTimeouts.delete(reminder.id);
    triggerAlarm(reminder);
  }, delay);

  activeTimeouts.set(reminder.id, timeout);
};

/* ------------------------------------------------------------------ */
/* Trigger alarm (Browser Fallback Only)                              */
/* ------------------------------------------------------------------ */

function triggerAlarm(reminder: Reminder) {
  activeTimeouts.delete(reminder.id);

  // ★ Use stopAlarmSound() to clear previous audio cleanly
  stopAlarmSound();

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Aura Alarm", {
        body: reminder.message,
        icon: "/aura-logo.png",
        requireInteraction: true,
      });
    } catch (e) {
      console.warn("Notification failed:", e);
    }
  }

  try {
    const audio = new Audio(alarmSound);
    audio.loop = true;
    audio.volume = 1;
    audio
      .play()
      .then(() => {
        activeAudio = audio;
      })
      .catch(() => fallbackBeep());
  } catch {
    fallbackBeep();
  }

  try {
    const utterance = new SpeechSynthesisUtterance(
      `Reminder: ${reminder.message}`
    );
    utterance.pitch = 0.7;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {}

  setTimeout(() => {
    if (activeAudio) {
      try {
        activeAudio.pause();
      } catch {}
      activeAudio = null;
    }
  }, 30_000);

  const reminders = getReminders().map((r) =>
    r.id === reminder.id ? { ...r, active: false } : r
  );
  saveReminders(reminders);
}

function fallbackBeep() {
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();

    let toggles = 0;
    const id = setInterval(() => {
      toggles++;
      gain.gain.value = toggles % 2 === 0 ? 0.15 : 0;
      if (toggles >= 20) {
        clearInterval(id);
        osc.stop();
        ctx.close();
      }
    }, 500);
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Init / cancel                                                      */
/* ------------------------------------------------------------------ */

export const initReminders = () => {
  const reminders = getReminders();
  const now = Date.now();

  reminders
    .filter((r) => r.active && r.time > now)
    .forEach((reminder) => scheduleAlarm(reminder));

  const stale = reminders.filter((r) => r.active && r.time <= now);
  if (stale.length > 0) {
    saveReminders(
      reminders.map((r) =>
        stale.some((s) => s.id === r.id) ? { ...r, active: false } : r
      )
    );
  }
};

export const cancelReminder = (id: string) => {
  if ((window as any).electronAPI?.cancelAlarm) {
    (window as any).electronAPI.cancelAlarm(id);
  }

  const t = activeTimeouts.get(id);
  if (t) {
    clearTimeout(t);
    activeTimeouts.delete(id);
  }
  
  removeReminder(id);
};

// ★ Stops the audio, the voice, and broadcasts to React
export const stopAlarmSound = () => {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {}
    activeAudio = null;
  }

  try {
    window.speechSynthesis.cancel();
  } catch {}

  // ★ Broadcast the stop event to React
  alarmEvents.dispatchEvent(new Event("stop"));
};

// ★ Cancels all timers and triggers the global stop event
export const cancelAllAlarms = () => {
  activeTimeouts.forEach((t) => clearTimeout(t));
  activeTimeouts.clear();
  
  const reminders = getReminders().map((r) => ({ ...r, active: false }));
  saveReminders(reminders);
  
  stopAlarmSound();
};