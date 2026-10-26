// src/components/AuraAssistant.tsx
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import {
  FaUpRightFromSquare,
  FaClockRotateLeft,
  FaMicrophone,
  FaMagnifyingGlass,
  FaPlay,
  FaStop,
  FaTerminal,
  FaBolt,
  FaArrowRight,
  FaTrash,
  FaXmark,
  FaPowerOff,
  FaBell,
  FaChevronDown,
  FaComments,
  FaImages,
  FaGear,
  FaFileLines,
} from "react-icons/fa6";
import { FaRegMoon, FaRegSun } from "react-icons/fa";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import "../css/AuraAssistant.css";
import auraLogo from "../assets/images/Aura-Logo-fix.webp";
import { processCommand } from "../command/AuraCommand";
import { AuraApiError } from "../api/aura-api";
import { clearConversation, getUserProfile } from "../command/AuraConversation";
import {
  initReminders,
  getReminders,
  cancelReminder,
  stopAlarmSound,
  cancelAllAlarms,
  type Reminder,
} from "../command/AuraReminders";

// ── SETTINGS IMPORTS ──
import AuraSettings from "./AuraSettings";
import {
  loadSettings,
  saveSettings,
  type AuraSettings as AuraSettingsType,
} from "../settings/AuraSettingsStore";

import alarmSound from "../assets/sound/alarm-clock.mp3";

import SplashScreen from "./SplashScreen";
import WelcomeScreen from "./WelcomeScreen";
import AuraWorkspace, { type ChatMessage } from "./AuraWorkspace";
import AuraMediaVault from "./AuraMediaVault";

interface CommandDetails {
  title: string;
  category: string;
  match: string;
  type: string;
  data: any;
  weatherIcon?: any;
}

interface HistoryItem {
  id: number;
  command: string;
  timestamp: string;
}

const INITIAL_DETAILS: CommandDetails = {
  title: "Aura Core",
  category: "Voice Assistant",
  match: "READY",
  type: "text",
  data: "Your command results will appear here.",
};

type BootStage = "splash" | "welcome" | "ready";
type MicMode = "off" | "standby" | "active";

const STOP_WORDS = /\b(stop|quiet|cancel|shut up|nevermind|never mind|silence|abort|disregard)\b/i;
const WAIT_WORDS = /\b(wait|hold on|hold up|hold it|pause|one moment|one sec|give me a sec|give me a second|just a moment|stand by|standby)\b/i;
const WAKE_WORDS = /\b(aur+a|aura|hey aura|okay aura|wake up|wake up aura|aura wake up|hey aur+a)\b/i;

const HISTORY_STORAGE_KEY = "aura_history";
const WORKSPACE_STORAGE_KEY = "aura_workspace_messages";

const generateId = (prefix: string) => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).substring(2, 9)}`;
};

const AuraAssistant: React.FC = () => {
  const [bootStage, setBootStage] = useState<BootStage>("splash");

  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("SYSTEM ONLINE");
  
  const [transcriptText, setTranscriptText] = useState(
    "Awaiting your command, Sir."
  );
  
  const [commandDetails, setCommandDetails] = useState<CommandDetails>(INITIAL_DETAILS);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // ── SETTINGS STATE ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AuraSettingsType>(() => loadSettings());

  const lightMode = settings.appearance.lightMode;

  const setLightMode = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setSettings((prev) => {
      const resolved = typeof next === "function" ? (next as any)(prev.appearance.lightMode) : next;
      if (prev.appearance.lightMode === resolved) return prev;
      const nextSettings: AuraSettingsType = {
        ...prev,
        appearance: { ...prev.appearance, lightMode: resolved },
      };
      saveSettings(nextSettings);
      return nextSettings;
    });
  }, []);

  const [themeReady, setThemeReady] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(getUserProfile());
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [embeddedVideo, setEmbeddedVideo] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => {
    return settings.voice.selectedVoiceName || localStorage.getItem("aura_selected_voice") || "";
  });

  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [handsFree, setHandsFree] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>("off");

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });

  const [pendingAlarms, setPendingAlarms] = useState<Reminder[]>([]);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const activeAssistantMsgIdRef = useRef<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const isWorkspaceOpenRef = useRef(false);

  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const speechGenerationRef = useRef<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const historyIdRef = useRef(0);
  const centerContentRef = useRef<HTMLDivElement | null>(null);
  const centerPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const mainAnimationRef = useRef<number>(0);
  const pipAnimationRef = useRef<number>(0);
  const modalAnimationRef = useRef<number>(0);
  const pipWindowRef = useRef<Window | null>(null);
  const mountedRef = useRef(true);
  const lastCommandTextRef = useRef("");

  const ignoreMicRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const micRestartTimeoutRef = useRef<any>(null);

  const stopRequestedRef = useRef(false);
  const autoCloseTimeoutRef = useRef<any>(null);

  const micModeRef = useRef<MicMode>("off");
  const handsFreeRef = useRef(false);
  const wakeCooldownRef = useRef(false);

  const inFlightControllerRef = useRef<AbortController | null>(null);
  const replyTokenRef = useRef(0);
  const lastPartialReplyRef = useRef("");

  const lastActiveImageRef = useRef<string | null>(null);

  const selectedVoiceNameRef = useRef(selectedVoiceName);
  const commandDetailsRef = useRef(commandDetails);
  const toggleMicRef = useRef<() => void>(() => {});
  
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const wasOnlineRef = useRef<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const auraDatabaseRef = useRef<any>(null);

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];

      const maxId = parsed.reduce(
        (max: number, item: HistoryItem) =>
          typeof item?.id === "number" && item.id > max ? item.id : max,
        0
      );
      historyIdRef.current = maxId;

      return parsed;
    } catch {
      return [];
    }
  });

  const requestAudioPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          noiseSuppression: true,
          echoCancellation: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("Mic permission or DSP request failed:", err);
    }
  };

  useEffect(() => {
    if (settings.privacy.persistHistory) {
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
      } catch (error) {
        console.warn("Failed to persist Aura history:", error);
      }
    }
  }, [history, settings.privacy.persistHistory]);

  useEffect(() => {
    if (settings.privacy.persistWorkspace) {
      try {
        localStorage.setItem(
          WORKSPACE_STORAGE_KEY,
          JSON.stringify(chatMessages.slice(-100))
        );
      } catch (error) {
        console.warn("Failed to persist Aura workspace messages:", error);
      }
    }
  }, [chatMessages, settings.privacy.persistWorkspace]);

  useEffect(() => {
    commandDetailsRef.current = commandDetails;
  }, [commandDetails]);

  useEffect(() => {
    isWorkspaceOpenRef.current = workspaceOpen;
    if (workspaceOpen) {
      try { window.speechSynthesis.cancel(); } catch {}
      isSpeakingRef.current = false;
      ignoreMicRef.current = false;
    }
  }, [workspaceOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsVoiceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setThemeReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const method = lightMode ? "remove" : "add";
    root.classList[method]("aura-dark-root");
    body.classList[method]("aura-dark-root");
  }, [lightMode]);

  // ✅ Force the accent color on the root element
  useEffect(() => {
    const ACCENT_COLORS: Record<string, string> = {
      violet: "#8b5cf6", cyan: "#22d3ee", pink: "#ec4899", amber: "#f59e0b", emerald: "#10b981",
    };
    
    let color = ACCENT_COLORS[settings.appearance.accent];
    if (settings.appearance.accent === "custom") {
      color = settings.appearance.customAccent;
    }
    
    if (!color) color = "#8b5cf6";

    document.documentElement.style.setProperty("--aura-violet", color);
    
  }, [settings.appearance.accent, settings.appearance.customAccent]);

  useEffect(() => {
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.document.body.classList.toggle("aura-dark-pip", !lightMode);
      } catch {}
    }
  }, [lightMode]);

  useEffect(() => {
    if (bootStage !== "ready") return;

    initReminders();

    const refresh = () => {
      const all = getReminders().filter((r) => r.active);
      setPendingAlarms(all.sort((a, b) => a.time - b.time));
    };

    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [bootStage]);

  const handleCancelAlarm = (id: string) => {
    cancelReminder(id);
    setPendingAlarms((prev) => prev.filter((r) => r.id !== id));
    setStatusText("ALARM CANCELLED");
    setTimeout(
      () => setStatusText((s) => s === "ALARM CANCELLED" ? "SYSTEM ONLINE" : s), 1500
    );
  };

  const handleStopRinging = useCallback(() => {
    stopAlarmSound();
    cancelAllAlarms();

    if (alarmAudioRef.current) {
      try {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
      } catch {}
      alarmAudioRef.current = null;
    }

    if (audioPlaybackRef.current) {
      try {
        audioPlaybackRef.current.pause();
        audioPlaybackRef.current.currentTime = 0;
      } catch {}
      audioPlaybackRef.current = null;
    }

    try { window.speechSynthesis.cancel(); } catch {}

    setIsAlarmRinging(false);
    setShowResponseModal(false);
    setManualOpen(false);
    setStatusText("SYSTEM ONLINE");
    setTranscriptText("Alarm stopped. Standing by.");
    isSpeakingRef.current = false;
    ignoreMicRef.current = false;
  }, []);

  const handleStopRingingRef = useRef(handleStopRinging);
  useEffect(() => { handleStopRingingRef.current = handleStopRinging; }, [handleStopRinging]);

  useEffect(() => {
    if (!isAlarmRinging) return;

    let stopRecognition: any = null;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      stopRecognition = new SpeechRecognition();
      stopRecognition.continuous = true;
      stopRecognition.interimResults = true;
      stopRecognition.lang = "en-US";

      stopRecognition.onresult = (event: any) => {
        const text = event.results[event.results.length - 1][0].transcript.toLowerCase();
        if (/\b(stop|quiet|shut up|cancel|enough)\b/i.test(text)) {
          handleStopRingingRef.current();
          try { stopRecognition.stop(); } catch {}
        }
      };

      try { stopRecognition.start(); } catch {}
    }

    return () => {
      if (stopRecognition) {
        try { stopRecognition.abort(); } catch {}
      }
    };
  }, [isAlarmRinging]);

  useEffect(() => {
    let interval: any;

    const checkConnection = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch("https://www.google.com/favicon.ico", {
          mode: "no-cors",
          cache: "no-store",
          method: "HEAD",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    checkConnection();
    interval = setInterval(checkConnection, 10000);

    const handleOnline = () => checkConnection();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const profile = getUserProfile();
    const name = profile.name || "Sir";
    setTranscriptText(`Awaiting your command, ${name}.`);
  }, []);

  useEffect(() => {
    if (selectedVoiceName) {
      localStorage.setItem("aura_selected_voice", selectedVoiceName);
    }
  }, [selectedVoiceName]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 760);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { micModeRef.current = micMode; }, [micMode]);
  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { selectedVoiceNameRef.current = selectedVoiceName; }, [selectedVoiceName]);

  useEffect(() => {
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const englishVoices = allVoices.filter((v) => v.lang.startsWith("en"));

      setAvailableVoices(englishVoices);

      if (!selectedVoiceNameRef.current) {
        const saved = localStorage.getItem("aura_selected_voice");
        if (saved) {
          setSelectedVoiceName(saved);
          return;
        }

        const defaultVoice =
          englishVoices.find((v) => v.name.includes("Google US English")) ||
          englishVoices.find((v) => v.name.includes("David")) ||
          englishVoices.find((v) => v.name.includes("Mark")) ||
          englishVoices[0];

        if (defaultVoice) setSelectedVoiceName(defaultVoice.name);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    try {
      const warm = new SpeechSynthesisUtterance(" ");
      warm.volume = 0;
      window.speechSynthesis.speak(warm);
    } catch {}

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      isListeningRef.current = false;

      try { recognitionRef.current?.abort(); } catch {}
      try { inFlightControllerRef.current?.abort(); } catch {}
      inFlightControllerRef.current = null;
      replyTokenRef.current++;

      window.speechSynthesis?.cancel();
      cancelAnimationFrame(mainAnimationRef.current);
      cancelAnimationFrame(pipAnimationRef.current);
      cancelAnimationFrame(modalAnimationRef.current);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      if (micRestartTimeoutRef.current) clearTimeout(micRestartTimeoutRef.current);

      if (pipWindowRef.current) {
        try { pipWindowRef.current.close(); } catch {}
        pipWindowRef.current = null;
      }
    };
  }, []);

  const startAnimation = useCallback(
    (
      canvas: HTMLCanvasElement,
      animRef: React.MutableRefObject<number>,
      targetWindow: Window = window
    ) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return () => {};

      let phase = 0;
      let width = 0;
      let height = 0;
      let frame = 0;
      let disposed = false;

      const isLightPiP = targetWindow.document.body.classList.contains("aura-light-pip");

      const particles = Array.from({ length: 60 }, (_, i) => ({
        angle: (i / 60) * Math.PI * 2,
        size: 0.8 + Math.random() * 1.4,
        speed: 0.7 + Math.random() * 0.6,
        offset: Math.random() * Math.PI * 2,
        color: isLightPiP
          ? i % 2 === 0 ? "electric-blue" : "hot-pink"
          : i % 2 === 0 ? "cyan" : "violet",
      }));

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(targetWindow.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const draw = () => {
        if (disposed) return;

        if (targetWindow.document.visibilityState === "hidden") {
          frame = targetWindow.requestAnimationFrame(draw);
          animRef.current = frame;
          return;
        }

        if (settingsRef.current.appearance.reduceMotion || !settingsRef.current.appearance.showParticles) {
          frame = targetWindow.requestAnimationFrame(draw);
          animRef.current = frame;
          return;
        }

        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.32;
        const active = micModeRef.current === "active" || isSpeakingRef.current;

        phase += active ? 0.045 : 0.012;

        const activeAccent = getComputedStyle(document.documentElement).getPropertyValue('--aura-violet').trim() || "#8b5cf6";

        particles.forEach((particle, i) => {
          const amplitude = active ? 20 : 7;

          const wave =
            Math.sin(particle.angle * 5 + phase * particle.speed) *
            Math.cos(particle.angle * 3 - phase + particle.offset) *
            amplitude;

          const orbit = radius + wave;
          const x = cx + Math.cos(particle.angle) * orbit;
          const y = cy + Math.sin(particle.angle) * orbit;

          const pulse = 0.65 + 0.35 * Math.sin(phase + i * 0.13);
          const size = particle.size * (active ? 1.2 : 0.85);

          ctx.beginPath();

          if (particle.color === "electric-blue") {
            ctx.fillStyle = `rgba(0, 240, 255, ${pulse})`;
            ctx.shadowColor = "#00f0ff";
          } else if (particle.color === "hot-pink") {
            ctx.fillStyle = `rgba(255, 0, 255, ${pulse})`;
            ctx.shadowColor = "#ff00ff";
          } else if (particle.color === "cyan") {
            ctx.fillStyle = `rgba(80, 210, 255, ${pulse})`;
            ctx.shadowColor = "#22d3ee";
          } else {
            ctx.fillStyle = activeAccent; 
            ctx.shadowColor = activeAccent;
          }

          ctx.shadowBlur = active ? 12 : 5;
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.shadowBlur = 0;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(phase * 0.18);

        [0.39, 0.44].forEach((factor, index) => {
          ctx.beginPath();
          ctx.ellipse(
            0, 0, radius * factor * 2.1, radius * factor * 1.1,
            index * 0.4, 0, Math.PI * 2
          );
          ctx.strokeStyle = index === 0
            ? "rgba(34, 211, 238, 0.15)"
            : "rgba(167, 139, 250, 0.13)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });

        ctx.restore();

        frame = targetWindow.requestAnimationFrame(draw);
        animRef.current = frame;
      };

      resize();
      targetWindow.addEventListener("resize", resize);
      draw();

      return () => {
        disposed = true;
        targetWindow.cancelAnimationFrame(frame);
        targetWindow.removeEventListener("resize", resize);
      };
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || bootStage !== "ready") return;
    return startAnimation(canvas, mainAnimationRef, window);
  }, [startAnimation, bootStage]);

  useEffect(() => {
    if (showResponseModal && modalCanvasRef.current) {
      return startAnimation(modalCanvasRef.current, modalAnimationRef, window);
    }
  }, [showResponseModal, startAnimation]);

  const auraSpeak = useCallback((text: string, overrideVoiceName?: string, temporaryOverrides?: Partial<AuraSettingsType["voice"]>) => {
    if (isWorkspaceOpenRef.current) return;

    if (settingsRef.current.voice.muteAura) {
      isSpeakingRef.current = false;
      ignoreMicRef.current = false;
      return;
    }

    if (!text?.trim() || !("speechSynthesis" in window)) return;

    const currentGeneration = ++speechGenerationRef.current;
    const targetVoiceName =
      overrideVoiceName !== undefined
        ? overrideVoiceName
        : selectedVoiceNameRef.current;

    try {
      window.speechSynthesis.cancel();
      if (audioPlaybackRef.current) {
        audioPlaybackRef.current.pause();
        audioPlaybackRef.current.currentTime = 0;
        audioPlaybackRef.current = null;
      }
    } catch {}

    isSpeakingRef.current = true;
    ignoreMicRef.current = true;

    const finishSpeaking = () => {
      if (speechGenerationRef.current !== currentGeneration) return;
      isSpeakingRef.current = false;

      if (micRestartTimeoutRef.current) clearTimeout(micRestartTimeoutRef.current);
      micRestartTimeoutRef.current = setTimeout(() => {
        ignoreMicRef.current = false;
        setStatusText(isListeningRef.current ? "LISTENING" : "SYSTEM ONLINE");
      }, 600);
    };

    const speakNow = (voice: SpeechSynthesisVoice | undefined) => {
      if (speechGenerationRef.current !== currentGeneration) return;

      setStatusText("SPEAKING");

      const utterance = new SpeechSynthesisUtterance(text);
      
      const currentVoiceSettings = temporaryOverrides 
        ? { ...settingsRef.current.voice, ...temporaryOverrides }
        : settingsRef.current.voice;

      utterance.pitch = currentVoiceSettings.pitch ?? 1;
      utterance.rate = currentVoiceSettings.rate ?? 1;
      utterance.volume = currentVoiceSettings.volume ?? 1;

      if (voice) utterance.voice = voice;

      utterance.onend = finishSpeaking;
      utterance.onerror = finishSpeaking;

      window.speechSynthesis.speak(utterance);
    };

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices();

      if (!targetVoiceName) {
        speakNow(
          voices.find((v) => v.name.includes("Google US English")) ||
          voices.find((v) => v.name.includes("David")) ||
          voices.find((v) => v.name.includes("Mark")) ||
          voices.find((v) => v.lang.startsWith("en")) ||
          voices[0]
        );
        return;
      }

      const exact = voices.find((v) => v.name === targetVoiceName);
      if (exact) { speakNow(exact); return; }

      const onVoicesReady = () => {
        window.speechSynthesis.onvoiceschanged = null;
        const retry = window.speechSynthesis
          .getVoices()
          .find((v) => v.name === targetVoiceName);

        if (retry) speakNow(retry);
        else {
          console.warn(`Selected voice "${targetVoiceName}" is not available on this device.`);
          finishSpeaking();
          setStatusText("VOICE UNAVAILABLE");
        }
      };

      window.speechSynthesis.onvoiceschanged = onVoicesReady;

      setTimeout(() => {
        if (speechGenerationRef.current !== currentGeneration) return;
        if (window.speechSynthesis.onvoiceschanged === onVoicesReady) {
          onVoicesReady();
        }
      }, 800);
    };

    setTimeout(doSpeak, 80);
  }, []);

  useEffect(() => {
    if (bootStage !== "ready") return;

    if ((window as any).electronAPI?.onPlayAlarm) {
      (window as any).electronAPI.onPlayAlarm((data: { message: string }) => {
        try {
          const audio = new Audio(alarmSound);
          audio.loop = true;
          audio.volume = settingsRef.current.alarms.volume ?? 1;
          alarmAudioRef.current = audio;
          audio.play().catch(() => {});
        } catch {}

        auraSpeak(`Reminder: ${data.message}`);
        setStatusText("ALARM RINGING");
        setTranscriptText(`⏰ ${data.message}`);
        setIsAlarmRinging(true);

        setCommandDetails({
          title: "Alarm Ringing",
          category: "Time Management",
          match: "100%",
          type: "text",
          data: `**⏰ Alarm:** ${data.message}`,
        });
        setShowResponseModal(true);
      });
    }
  }, [bootStage, auraSpeak]);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (!isOnline && wasOnline) {
      setStatusText("OFFLINE");
      setTranscriptText("No internet connection. Some features are unavailable.");
      try { window.speechSynthesis.cancel(); } catch {}
      auraSpeak("Warning. I've lost internet.");
    } else if (isOnline && !wasOnline) {
      setStatusText("SYSTEM ONLINE");
      setTranscriptText("Connection restored. Aura is back online.");
      auraSpeak("Connection restored.");
    }
  }, [isOnline, auraSpeak]);

  const addHistory = useCallback((command: string) => {
    const cleaned = command.trim();
    if (!cleaned) return;

    setHistory((previous) => [
      {
        id: ++historyIdRef.current,
        command: cleaned,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...previous,
    ].slice(0, 30));
  }, []);

  const stopMic = useCallback(() => {
    stopRequestedRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);

    try { recognitionRef.current?.stop(); } catch {}
    try { inFlightControllerRef.current?.abort(); } catch {}
    inFlightControllerRef.current = null;
    replyTokenRef.current++;

    setStatusText("SYSTEM ONLINE");
  }, []);

  const enterActiveMode = useCallback(() => {
    if (micModeRef.current === "active") return;
    micModeRef.current = "active";
    setMicMode("active");
    setIsListening(true);
    isListeningRef.current = true;
    setStatusText("LISTENING");
    setTranscriptText("I'm listening.");

    try {
      recognitionRef.current?.abort();
      setTimeout(() => {
        if (!stopRequestedRef.current) recognitionRef.current?.start();
      }, 300);
    } catch {}

    auraSpeak("I'm listening.");
  }, [auraSpeak]);

  const enterStandbyMode = useCallback(() => {
    micModeRef.current = "standby";
    setMicMode("standby");
    setIsListening(false);
    isListeningRef.current = false;
    setStatusText("STANDBY");
    setTranscriptText("Say 'Aura, wake up' to begin.");
  }, []);

  const exitHandsFree = useCallback(() => {
    micModeRef.current = "off";
    setMicMode("off");
    setHandsFree(false);
    handsFreeRef.current = false;
    localStorage.setItem("aura_hands_free", "false");
    setIsListening(false);
    isListeningRef.current = false;
    stopRequestedRef.current = true;
    try { recognitionRef.current?.abort(); } catch {}
    try { inFlightControllerRef.current?.abort(); } catch {}
    inFlightControllerRef.current = null;
    replyTokenRef.current++;
    setStatusText("SYSTEM ONLINE");
  }, []);

  const openWorkspace = useCallback(() => setWorkspaceOpen(true), []);
  const closeWorkspace = useCallback(() => setWorkspaceOpen(false), []);

  const clearWorkspace = useCallback(() => {
    setChatMessages([]);
    activeAssistantMsgIdRef.current = null;
    lastActiveImageRef.current = null;
    try { localStorage.removeItem(WORKSPACE_STORAGE_KEY); } catch {}
    clearConversation();
  }, []);

  const stopWorkspace = useCallback(() => {
    try { inFlightControllerRef.current?.abort(); } catch {}
    inFlightControllerRef.current = null;
    replyTokenRef.current++;
    try { window.speechSynthesis.cancel(); } catch {}

    if (activeAssistantMsgIdRef.current) {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === activeAssistantMsgIdRef.current
            ? { ...m, streaming: false, content: m.content || "Stopped." }
            : m
        )
      );
      activeAssistantMsgIdRef.current = null;
    }
    setStatusText("SYSTEM ONLINE");
  }, []);

  const runCommand = useCallback(
    async (command: string) => {
      const isVoiceCommand = !isWorkspaceOpenRef.current;
      let cleaned = command.trim();
      
      if (isVoiceCommand) {
        cleaned = cleaned.replace(/\b(hey aura|okay aura|aura)\b/gi, "").trim();
      }

      if (!cleaned || cleaned.length < 1) return;

      const lowerClean = cleaned.toLowerCase().replace(/[.,!?]/g, "").trim();
      if (["aura", "hey aura", "okay aura", "hi aura", "hello", "hi", "hey"].includes(lowerClean)) {
        const userId = generateId("u");
        const assistantId = generateId("a");
        
        setChatMessages((prev) => [
          ...prev,
          { id: userId, role: "user", content: command.trim(), timestamp: Date.now() },
          {
            id: assistantId,
            role: "assistant",
            content: "Hey Sir! What's up? How can I help you today?",
            timestamp: Date.now(),
            streaming: false,
            category: "Conversation Follow-up",
          },
        ]);

        if (!isWorkspaceOpenRef.current) {
          auraSpeak("Hey Sir! What's up?");
        }
        
        setStatusText("SYSTEM ONLINE");
        setTranscriptText("Awaiting your next command.");
        return;
      }

      const isAskingAboutImage = /\b(describe|what is|who is|look at|see|image|picture|photo|this|that)\b/i.test(cleaned);
      if (!isAskingAboutImage) {
        lastActiveImageRef.current = null;
      }

      if (inFlightControllerRef.current) {
        try { inFlightControllerRef.current.abort(); } catch {}
        inFlightControllerRef.current = null;
      }

      if (!isOnline) {
        setStatusText("OFFLINE");
        setTranscriptText("No internet connection. Try again when you're back online.");
        setCommandDetails({
          title: "Offline",
          category: "Network Error",
          match: "0%",
          type: "text",
          data:
            "**Aura is offline.**\n\n" +
            "Your device has no internet connection. Commands that rely on the AI, " +
            "YouTube search, or web search will not work right now.\n\n" +
            "Local commands (time, date, saved memory, opening apps) may still work.",
        });

        const userId = generateId("u");
        const assistantId = generateId("a");
        setChatMessages((prev) => [
          ...prev,
          { id: userId, role: "user", content: command.trim(), timestamp: Date.now() },
          {
            id: assistantId,
            role: "assistant",
            content:
              "**Aura is offline.** No internet connection — cloud commands are unavailable right now.",
            timestamp: Date.now(),
            streaming: false,
            category: "Network Error",
          },
        ]);

        auraSpeak("I can't reach the network right now.");
        return;
      }

      const controller = new AbortController();
      inFlightControllerRef.current = controller;
      const myToken = ++replyTokenRef.current;
      lastPartialReplyRef.current = "";

      addHistory(command.trim());
      setTranscriptText(`"${command.trim()}"`);
      setStatusText("PROCESSING COMMAND");

      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);

      const userId = generateId("u");
      const assistantId = generateId("a");
      activeAssistantMsgIdRef.current = assistantId;

      setChatMessages((prev) => [
        ...prev,
        { id: userId, role: "user", content: command.trim(), timestamp: Date.now() },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
          streaming: true,
          category: "Processing…",
        },
      ]);

      if (!auraDatabaseRef.current) {
        try {
          const module = await import("../database/aura.json");
          auraDatabaseRef.current = module.default;
        } catch (err) {
          console.error("Failed to load Aura DB:", err);
        }
      }

      const silentAuraSpeak = isWorkspaceOpenRef.current 
        ? () => {} 
        : auraSpeak;

      processCommand({
        cmd: cleaned,
        auraDatabase: auraDatabaseRef.current,
        setStatusText,
        setTranscriptText,
        setCommandDetails,
        auraSpeak: silentAuraSpeak,
        setEmbeddedVideo,
        stopMic,
        signal: controller.signal,
        activeImageUrl: lastActiveImageRef.current, 
        onPartialReply: (partial) => {
          if (myToken !== replyTokenRef.current) return;
          lastPartialReplyRef.current = partial;
          setTranscriptText(partial);

          const id = activeAssistantMsgIdRef.current;
          if (id) {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, content: partial, streaming: true } : m
              )
            );
          }
        },
      })
        .then((result: any) => {
          if (myToken !== replyTokenRef.current) return;
          setUserProfile(getUserProfile());

          const all = getReminders().filter((r) => r.active);
          setPendingAlarms(all.sort((a, b) => a.time - b.time));

          const isMediaResult = result && typeof result === 'object' && 'mediaItems' in result;
          const finalText = isMediaResult 
            ? result.text 
            : (result && typeof result === 'string' && result.trim() ? result : lastPartialReplyRef.current || "Done.");

          if (isMediaResult && result.mediaItems.length > 0) {
            lastActiveImageRef.current = result.mediaItems[0].url;
          }

          const id = activeAssistantMsgIdRef.current;
          if (id) {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === id
                  ? {
                      ...m,
                      content: finalText,
                      streaming: false,
                      mediaItems: isMediaResult ? result.mediaItems : undefined,
                      category: isMediaResult ? "Media Vault" : (commandDetailsRef.current?.category ?? m.category),
                    }
                  : m
              )
            );
            activeAssistantMsgIdRef.current = null;
          }

          if (isMediaResult) {
            // ✅ FIX: Extract the real file name for the title
            const firstUrl = result.mediaItems[0].url;
            const rawFileName = decodeURIComponent(firstUrl.split('/').pop()?.split('?')[0] || "File");
            const cleanTitle = rawFileName.replace(/\.[^/.]+$/, ""); // Remove extension

            setCommandDetails({
              title: cleanTitle,
              category: "Media Vault",
              match: "100%",
              type: "media",
              data: {
                text: result.text,
                mediaItems: result.mediaItems
              }
            });
          } else {
            // Only set the AI text title if we're NOT in the middle of a document read
            // (AuraCommand handles setting the doc title during read)
            if (commandDetailsRef.current?.category !== "AI Knowledge" || !commandDetailsRef.current?.data?.includes("Reading document")) {
               // Do nothing here; AuraCommand already set the correct title in setCommandDetails
            }
          }

          if (!isMobile && !isWorkspaceOpenRef.current && finalText && finalText.trim().length > 0) {
            setTimeout(() => {
              if (myToken !== replyTokenRef.current) return;
              setManualOpen(false);
              setShowResponseModal(true);
            }, 1200);
          }
        })
        .catch((err) => {
          if (err instanceof AuraApiError && err.kind === "aborted") return;
          if (myToken !== replyTokenRef.current) return;
          setStatusText("COMMAND ERROR");
          setTranscriptText("Unable to process this command. Please try again.");

          if (activeAssistantMsgIdRef.current) {
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === activeAssistantMsgIdRef.current
                  ? {
                      ...m,
                      content: "⚠️ Unable to process that command. Please try again.",
                      streaming: false,
                      category: "Error",
                    }
                  : m
              )
            );
            activeAssistantMsgIdRef.current = null;
          }
        })
        .finally(() => {
          if (myToken === replyTokenRef.current) inFlightControllerRef.current = null;
        });
    },
    [addHistory, auraSpeak, stopMic, isMobile, isOnline] 
  );

  const setupSpeechRecognition = useCallback(
    (targetWindow: Window = window) => {
      const SpeechRecognition =
        (targetWindow as any).SpeechRecognition ||
        (targetWindow as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        recognitionRef.current = null;
        return;
      }

      try { recognitionRef.current?.abort(); } catch {}

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        if (isSpeakingRef.current || ignoreMicRef.current) return;

        let interim = "";
        const finalCommands: string[] = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript?.trim();
          if (!text) continue;
          if (result.isFinal) finalCommands.push(text);
          else interim += text;
        }

        const heardText = `${interim} ${finalCommands.join(" ")}`.toLowerCase();

        if (micModeRef.current === "standby") {
          if (WAKE_WORDS.test(heardText) && !wakeCooldownRef.current) {
            wakeCooldownRef.current = true;
            setTimeout(() => { wakeCooldownRef.current = false; }, 2500);
            setTranscriptText(`"${heardText}" → waking up...`);
            enterActiveMode();
            lastCommandTextRef.current = "";
          } else if (interim) {
            setTranscriptText(`Hearing: "${interim}" — say "Aura, wake up"`);
          }
          return;
        }

        if (STOP_WORDS.test(heardText)) {
          try { window.speechSynthesis.cancel(); } catch {}
          try { inFlightControllerRef.current?.abort(); } catch {}
          inFlightControllerRef.current = null;
          replyTokenRef.current++;
          if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);

          if (handsFreeRef.current) {
            setEmbeddedVideo(null);
            setCommandDetails({
              title: "Standing By",
              category: "Awaiting Wake Word",
              match: "100%",
              type: "text",
              data: "Say 'Aura, wake up' to resume.",
            });
            setShowResponseModal(false);
            lastCommandTextRef.current = "";
            enterStandbyMode();
            return;
          }

          stopMic();
          setEmbeddedVideo(null);
          setTranscriptText("Stopped.");
          setCommandDetails({
            title: "Standing By",
            category: "Awaiting Command",
            match: "100%",
            type: "text",
            data: "Paused. Your conversation is still in memory.",
          });
          setShowResponseModal(false);
          lastCommandTextRef.current = "";
          return;
        }

        if (WAIT_WORDS.test(heardText)) {
          try { window.speechSynthesis.cancel(); } catch {}
          if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
          setStatusText("LISTENING");
          setTranscriptText("Waiting...");
          setCommandDetails({
            title: "Waiting",
            category: "Standing By",
            match: "100%",
            type: "text",
            data: "Take your time — say your command when ready.",
          });
          lastCommandTextRef.current = "";
          return;
        }

        if (isSpeakingRef.current) return;

        if (interim && mountedRef.current) setTranscriptText(`"${interim}"`);

        finalCommands.forEach((cmd) => {
          if (cmd !== lastCommandTextRef.current && cmd.length > 1) {
            lastCommandTextRef.current = cmd;
            if (mountedRef.current) setTranscriptText(`"${cmd}"`);
            runCommand(cmd);
            setTimeout(() => {
              if (lastCommandTextRef.current === cmd) lastCommandTextRef.current = "";
            }, 4000);
          }
        });
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        if (handsFreeRef.current && event.error === "network") return;

        isListeningRef.current = false;
        setIsListening(false);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setStatusText("MICROPHONE BLOCKED");
          setTranscriptText("Allow microphone access in your browser settings.");
        } else if (event.error === "network") {
          setStatusText("NETWORK ERROR");
          setTranscriptText("Voice recognition needs a working connection.");
        } else {
          setStatusText("VOICE INPUT ERROR");
          setTranscriptText("Check your microphone and try again.");
        }
      };

      recognition.onend = () => {
        const mode = micModeRef.current;
        if ((mode === "standby" || mode === "active") && !stopRequestedRef.current && !isSpeakingRef.current) {
          try {
            if (micRestartTimeoutRef.current) clearTimeout(micRestartTimeoutRef.current);
            micRestartTimeoutRef.current = setTimeout(() => {
              if (micModeRef.current !== "off" && !stopRequestedRef.current && !isSpeakingRef.current) {
                try { recognition.start(); } catch {}
              }
            }, 500);
          } catch (e) {
            console.error("Mic auto-restart failed:", e);
          }
        } else if (!isSpeakingRef.current && !stopRequestedRef.current) {
          setStatusText((previous: string) =>
            previous === "LISTENING" || previous === "STANDBY" ? "SYSTEM ONLINE" : previous
          );
        }
      };

      recognitionRef.current = recognition;
    },
    [runCommand, stopMic, enterActiveMode, enterStandbyMode]
  );

  useEffect(() => {
    setupSpeechRecognition(window);
    return () => {
      try { recognitionRef.current?.abort(); } catch {}
    };
  }, [setupSpeechRecognition]);

  useEffect(() => {
    if (!handsFree) return;
    const watchdog = setInterval(() => {
      if (micModeRef.current !== "off" && !stopRequestedRef.current && !isSpeakingRef.current) {
        try {
          if (recognitionRef.current) recognitionRef.current.start();
        } catch {}
      }
    }, 3000);
    return () => clearInterval(watchdog);
  }, [handsFree]);

  const startHandsFree = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setStatusText("NOT SUPPORTED");
      setTranscriptText("Your browser does not support speech recognition.");
      return;
    }

    setHandsFree(true);
    handsFreeRef.current = true;
    localStorage.setItem("aura_hands_free", "true");
    stopRequestedRef.current = false;
    lastCommandTextRef.current = "";
    wakeCooldownRef.current = false;

    setupSpeechRecognition(window);

    try {
      recognitionRef.current.start();
      enterStandbyMode();
      auraSpeak("Hands free mode active. Say Aura, wake up.");
    } catch {
      setStatusText("MIC UNAVAILABLE");
    }
  }, [setupSpeechRecognition, enterStandbyMode, auraSpeak]);

  const toggleMic = useCallback(() => {
    // ✅ FIX: If we are currently listening, STOP everything immediately
    if (isListeningRef.current) {
      stopRequestedRef.current = true;
      isListeningRef.current = false;
      setIsListening(false);
      micModeRef.current = "off";
      setMicMode("off");
      
      try { 
        recognitionRef.current?.abort(); 
        recognitionRef.current?.stop(); 
      } catch {}
      
      if (micRestartTimeoutRef.current) clearTimeout(micRestartTimeoutRef.current);
      window.speechSynthesis.cancel();
      setStatusText("SYSTEM ONLINE");
      setShowResponseModal(false);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      return;
    }

    if (handsFreeRef.current && micModeRef.current === "standby") {
      enterActiveMode();
      return;
    }

    if (handsFreeRef.current && micModeRef.current === "active") {
      window.speechSynthesis.cancel();
      exitHandsFree();
      return;
    }

    // ✅ START LISTENING
    stopRequestedRef.current = false;
    setStatusText("INITIALIZING...");
    window.speechSynthesis.cancel();
    lastCommandTextRef.current = "";
    micModeRef.current = "active";
    setMicMode("active");

    requestAudioPermissions();

    setupSpeechRecognition(window);

    try {
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
      setStatusText("LISTENING");
      setTranscriptText("Listening for your command...");
    } catch {
      setStatusText("MICROPHONE UNAVAILABLE");
      setIsListening(false);
      micModeRef.current = "off";
      setMicMode("off");
    }
  }, [setupSpeechRecognition, enterActiveMode, exitHandsFree]);

  useEffect(() => { toggleMicRef.current = toggleMic; }, [toggleMic]);

  useEffect(() => {
    if (bootStage !== "ready") return;
    const savedHandsFree = localStorage.getItem("aura_hands_free");
    if (savedHandsFree === "true") startHandsFree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootStage]);

  useEffect(() => {
    if (!showResponseModal || isMobile || manualOpen) return;

    let isCancelled = false;

    const checkSpeechAndClose = () => {
      if (isCancelled) return;

      if (window.speechSynthesis.speaking || isSpeakingRef.current) {
        setTimeout(checkSpeechAndClose, 500);
        return;
      }

      const delay = commandDetails.category === "Environment" ? 8000 : 4000;
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);

      autoCloseTimeoutRef.current = setTimeout(() => {
        if (!manualOpen) setShowResponseModal(false);
      }, delay);
    };

    const initialDelay = setTimeout(checkSpeechAndClose, 1000);

    return () => {
      isCancelled = true;
      clearTimeout(initialDelay);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, [showResponseModal, isMobile, manualOpen, commandDetails.category]);

  const handlePopOut = useCallback(async () => {
    const browser = window as any;

    if (!browser.documentPictureInPicture) {
      setStatusText("POP-OUT NOT SUPPORTED");
      setTranscriptText("Your browser does not support Document Picture-in-Picture.");
      return;
    }

    if (pipOpen && pipWindowRef.current) {
      try { pipWindowRef.current.focus(); } catch {}
      return;
    }

    try {
      const pipWindow: Window =
        await browser.documentPictureInPicture.requestWindow({
          width: 420,
          height: 620,
        });

      pipWindowRef.current = pipWindow;

      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const css = Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
          const style = pipWindow.document.createElement("style");
          style.textContent = css;
          pipWindow.document.head.appendChild(style);
        } catch {
          if (sheet.href) {
            const link = pipWindow.document.createElement("link");
            link.rel = "stylesheet";
            link.href = sheet.href;
            pipWindow.document.head.appendChild(link);
          }
        }
      });

      const style = pipWindow.document.createElement("style");
      style.textContent = `
        * { box-sizing: border-box; }
        body {
          margin: 0; min-height: 100vh;
          background: radial-gradient(ellipse at 50% 40%, rgba(196, 181, 253, 0.4), transparent 55%), #f2efff;
          color: #1e1b36; font-family: Rajdhani, sans-serif;
          display: flex; align-items: center; justify-content: center;
          padding: 18px; transition: background 250ms ease, color 250ms ease;
        }
        body.aura-dark-pip { background: radial-gradient(ellipse at 50% 40%, rgba(91,33,182,.18), transparent 55%), #080714; color: #f5f3ff; }
        body.aura-dark-pip #auraPipStatus { color: #b4a8d8; }
        body.aura-dark-pip .aura-pip-orb { border-color: rgba(167, 139, 250, 0.42); background: radial-gradient(circle at 50% 45%, rgba(75, 38, 150, .34), rgba(20, 15, 51, .65) 40%, rgba(7, 6, 19, .95) 75%); box-shadow: 0 0 0 8px rgba(139, 92, 246, .025), 0 0 0 18px rgba(139, 92, 246, .02), 0 0 55px rgba(124, 58, 237, .2), inset 0 0 45px rgba(59, 130, 246, .09); }
        body.aura-dark-pip .aura-pip-orb::before { border-color: rgba(167, 139, 250, .23); }
        body.aura-dark-pip .aura-pip-orb .aura-orb-ring-one { border-left-color: rgba(103, 232, 249, .65); border-right-color: rgba(167, 139, 250, .65); }
        body.aura-dark-pip .aura-pip-orb .aura-orb-ring-two { border-top-color: rgba(103, 232, 249, .6); border-bottom-color: rgba(232, 121, 249, .55); }
        body.aura-dark-pip .aura-pip-orb .aura-orb-grid { background: repeating-conic-gradient(from 0deg, rgba(139, 92, 246, .07) 0deg .5deg, transparent .5deg 18deg); border-color: rgba(59, 130, 246, .18); }
        .aura-pip { width: 100%; text-align: center; }
        .aura-pip-orb { position: relative; isolation: isolate; display: grid; place-items: center; width: min(260px, 72vw); aspect-ratio: 1; margin: 0 auto 30px auto; overflow: hidden; border: 1px solid rgba(139, 92, 246, .5); border-radius: 50%; background: radial-gradient(circle at 50% 45%, #e9e4fa, #f6f3ff 60%, #ffffff 85%); box-shadow: 0 0 0 8px rgba(139, 92, 246, .05), 0 0 55px rgba(139, 92, 246, .2), inset 0 0 35px rgba(139, 92, 246, .12); transition: all 250ms ease; }
        .aura-pip-orb::before { content: ""; position: absolute; inset: 9%; border: 1px dashed rgba(139, 92, 246, .3); border-radius: 50%; animation: auraRotate 45s linear infinite; transition: border-color 250ms ease; }
        .aura-pip-orb .aura-orb-grid { position: absolute; inset: 15%; border: 1px solid rgba(139, 92, 246, .15); border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(139, 92, 246, .1) 0deg .5deg, transparent .5deg 18deg); mask-image: radial-gradient(circle, transparent 20%, black 100%); -webkit-mask-image: radial-gradient(circle, transparent 20%, black 100%); transition: all 250ms ease; }
        .aura-pip-orb .aura-orb-ring { position: absolute; border: 1px solid rgba(139, 92, 246, .25); border-radius: 50%; transition: border-color 250ms ease; }
        .aura-pip-orb .aura-orb-ring-one { inset: 22%; border-left-color: #3b82f6; border-right-color: #8b5cf6; transform: rotate(-35deg); animation: auraRotate 12s linear infinite; }
        .aura-pip-orb .aura-orb-ring-two { inset: 29%; border-top-color: #3b82f6; border-bottom-color: #e879f9; transform: rotate(40deg); animation: auraRotateReverse 16s linear infinite; }
        .aura-pip-orb .aura-core-logo { position: absolute; z-index: 2; width: 26%; height: 26%; object-fit: contain; opacity: .92; filter: drop-shadow(0 0 12px rgba(139, 92, 246, .55)) drop-shadow(0 0 25px rgba(59, 130, 246, .32)); pointer-events: none; }
        .aura-pip-orb canvas { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; pointer-events: none; }
        @keyframes auraRotate { to { transform: rotate(325deg); } }
        @keyframes auraRotateReverse { to { transform: rotate(-320deg); } }
        #auraPipStatus { margin: 0 0 16px; color: #6b628a; font-family: Orbitron, sans-serif; font-size: 10px; letter-spacing: .14em; transition: color 250ms ease; }
        .aura-pip button { border: 1px solid rgba(139, 92, 246, .5); background: linear-gradient(110deg, #7c3aed, #6366f1 55%, #3b82f6); color: white; border-radius: 11px; padding: 13px 26px; cursor: pointer; font-family: Orbitron, sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .13em; box-shadow: 0 8px 28px rgba(139, 92, 246, .24), inset 0 1px rgba(255,255,255,.2); transition: filter 180ms ease, transform 180ms ease; }
        .aura-pip button:hover { filter: brightness(1.08); transform: translateY(-1px); }
      `;
      pipWindow.document.head.appendChild(style);

      if (!lightMode) pipWindow.document.body.classList.add("aura-dark-pip");
      else pipWindow.document.body.classList.remove("aura-dark-pip");

      const container = pipWindow.document.createElement("div");
      container.className = "aura-pip";
      container.innerHTML = `
        <div class="aura-pip-orb">
          <div class="aura-orb-grid" aria-hidden="true"></div>
          <div class="aura-orb-ring aura-orb-ring-one"></div>
          <div class="aura-orb-ring aura-orb-ring-two"></div>
          <img src="${auraLogo}" alt="" class="aura-core-logo" />
          <canvas id="auraPipCanvas"></canvas>
        </div>
        <p id="auraPipStatus">AURA IS READY</p>
        <button id="auraPipMic" type="button">START VOICE COMMAND</button>
      `;

      pipWindow.document.body.appendChild(container);

      const pipCanvas = pipWindow.document.getElementById("auraPipCanvas") as HTMLCanvasElement;
      const stopAnimation = startAnimation(pipCanvas, pipAnimationRef, pipWindow);

      const pipStatus = pipWindow.document.getElementById("auraPipStatus");
      const pipMic = pipWindow.document.getElementById("auraPipMic");

      const updatePip = () => {
        const mode = micModeRef.current;
        if (pipStatus) {
          pipStatus.textContent =
            mode === "active" ? "LISTENING..." :
            mode === "standby" ? "SAY 'AURA WAKE UP'" :
            "AURA IS READY";
        }
        if (pipMic) {
          pipMic.textContent =
            mode === "active" ? "END SESSION" :
            mode === "standby" ? "WAKE NOW" :
            "START VOICE COMMAND";
        }
      };

      updatePip();

      const pipClickHandler = () => toggleMicRef.current();
      pipMic?.addEventListener("click", pipClickHandler);

      const syncInterval = window.setInterval(updatePip, 500);

      pipWindow.addEventListener("pagehide", () => {
        try {
          window.clearInterval(syncInterval);
          stopAnimation();
          cancelAnimationFrame(pipAnimationRef.current);
          pipMic?.removeEventListener("click", pipClickHandler);
          pipWindowRef.current = null;
        } finally {
          setPipOpen(false);
        }
      }, { once: true });

      setPipOpen(true);
    } catch (error) {
      console.error("Aura Picture-in-Picture failed:", error);
      setStatusText("POP-OUT FAILED");
      setTranscriptText("Unable to open the floating Aura window.");
    }
  }, [startAnimation, pipOpen, lightMode]);

  const filteredHistory = history.filter((item) =>
    item.command.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectHistory = (item: HistoryItem) => {
    setTranscriptText(`"${item.command}"`);
    setStatusText("COMMAND SELECTED");
    setCommandDetails({
      title: "Previous Command",
      category: "Search History",
      match: "SAVED",
      type: "text",
      data: item.command,
    });
    setManualOpen(true);
    setShowResponseModal(true);
  };

  const clearHistory = () => {
    setHistory([]);
    setSearchQuery("");
    clearConversation();
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch (error) {
      console.warn("Failed to clear Aura history:", error);
    }
    historyIdRef.current = 0;
  };

  const renderResult = () => {
    // ✅ FIXED: Properly handle images, videos, AND documents
    if (commandDetails.type === "media" && commandDetails.data?.mediaItems) {
      return (
        <div className="aura-response" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="aura-markdown-container">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {commandDetails.data.text}
            </ReactMarkdown>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
            gap: '10px',
            marginTop: '10px'
          }}>
            {commandDetails.data.mediaItems.map((media: any, idx: number) => {
              const url: string = media.url || "";
              const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || "file");
              const isImage = media.type === "image" || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
              const isVideo = media.type === "video" || /\.(mp4|webm|ogg|mov)$/i.test(fileName);

              return (
                <div
                  key={idx}
                  style={{
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--aura-border)',
                    background: "var(--aura-panel)",
                  }}
                >
                  {isImage ? (
                    <img
                      src={url}
                      alt={fileName}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  ) : isVideo ? (
                    <video src={url} controls style={{ width: '100%', display: 'block' }} />
                  ) : (
                    // ✅ Document card (.docx, .pdf, .txt, etc.)
                    <div style={{
                      padding: "20px 14px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "10px",
                      minHeight: "150px",
                      justifyContent: "center"
                    }}>
                      <FaFileLines size={38} color="var(--aura-violet)" />
                      <span style={{
                        fontSize: "12px",
                        color: "var(--aura-text)",
                        textAlign: "center",
                        wordBreak: "break-all",
                        lineHeight: 1.4,
                        maxWidth: "100%"
                      }}>
                        {fileName}
                      </span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: "8px 14px",
                          background: "var(--aura-violet)",
                          color: "#fff",
                          borderRadius: "6px",
                          textDecoration: "none",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        Open File
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (commandDetails.type === "video" && Array.isArray(commandDetails.data)) {
      if (commandDetails.data.length === 0)
        return <p className="aura-empty">No video results returned.</p>;

      return commandDetails.data.map((video: any, index: number) => (
        <article className="aura-video" key={`${video.title}-${index}`}>
          {video.img ? (
            <img src={video.img} alt="" loading="lazy" />
          ) : (
            <div className="aura-video-placeholder"><FaPlay /></div>
          )}
          <div className="aura-video-info">
            <strong>{video.title || "Untitled video"}</strong>
            <span>VIDEO RESULT</span>
          </div>
          <button
            type="button"
            className="aura-icon-button"
            aria-label={`Play ${video.title || "video"}`}
            onClick={() => {
              const query = video.query || video.title;
              if (query) {
                setEmbeddedVideo(
                  `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`
                );
              }
            }}
          >
            <FaPlay />
          </button>
        </article>
      ));
    }

    const resultText =
      typeof commandDetails.data === "string"
        ? commandDetails.data
        : JSON.stringify(commandDetails.data, null, 2);

    return (
      <div
        className="aura-response"
        onClick={() => {
          setManualOpen(true);
          setShowResponseModal(true);
        }}
        style={{ cursor: "pointer" }}
      >
        <div className="aura-response-label">
          <span className="aura-live-dot" />
          RESPONSE DATA (CLICK TO EXPAND)
        </div>
        <div className="aura-markdown-container">
          {commandDetails.category === "Environment" && commandDetails.weatherIcon && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              {commandDetails.weatherIcon}
            </div>
          )}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {resultText || "No response data returned."}
          </ReactMarkdown>
        </div>
      </div>
    );
  };

  if (bootStage === "splash") return <SplashScreen onComplete={() => setBootStage("welcome")} />;
  if (bootStage === "welcome") return <WelcomeScreen onComplete={() => setBootStage("ready")} />;

  const orbClass =
    micMode === "active" ? "listening-active" :
    micMode === "standby" ? "orb-standby" :
    "orb-glow";

  const statusIndicatorClass =
    statusText === "SPEAKING"
      ? "active"
      : statusText === "PROCESSING COMMAND" && lastPartialReplyRef.current
      ? "streaming"
      : micMode === "active"
      ? "active"
      : "";

  const rootClass = `aura-app ${lightMode ? "" : "aura-dark"} ${themeReady ? "" : "no-transition"}`.trim();

  return (
    <div className={rootClass}>
      <div className="aura-scanlines" aria-hidden="true" style={{ display: settings.appearance.showScanlines ? "block" : "none" }} />
      <div className="aura-ambient aura-ambient-one" aria-hidden="true" />
      <div className="aura-ambient aura-ambient-two" aria-hidden="true" />

      {!isOnline && (
        <div className="aura-offline-banner" role="alert" aria-live="assertive">
          <img src={auraLogo} alt="Aura" className="aura-offline-logo" />
          <span className="aura-offline-banner-text">
            <strong>OFFLINE</strong>
            <span>No internet connection. Cloud commands are disabled.</span>
          </span>
          <span className="aura-offline-banner-pulse">●</span>
        </div>
      )}

      {showResponseModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowResponseModal(false);
              setManualOpen(false);
            }
          }}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(5, 3, 15, 0.7)",
            backdropFilter: "blur(12px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? "10px" : "20px",
            animation: "auraBackdropIn 300ms ease-out forwards",
          }}
        >
          <div
            style={{
              background: lightMode ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 12, 32, 0.95)",
              border: "1px solid var(--aura-border-bright)", 
              borderRadius: "24px",
              width: "100%",
              maxWidth: isMobile ? "100%" : "900px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 80px var(--aura-border)", 
              overflow: "hidden",
              animation: "auraModalPop 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
              transition: "background 450ms ease, border-color 450ms ease",
            }}
          >
            <div
              style={{
                width: isMobile ? "100%" : "350px",
                flexShrink: 0,
                display: "flex",
                flexDirection: isMobile ? "row" : "column",
                alignItems: "center",
                justifyContent: "center",
                background: lightMode 
                  ? "linear-gradient(135deg, rgba(139,92,246,0.05) 0%, rgba(255,255,255,0) 100%)" 
                  : "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(0,0,0,0) 100%)",
                borderRight: isMobile ? "none" : "1px solid var(--aura-border)",
                borderBottom: isMobile ? "1px solid var(--aura-border)" : "none",
                padding: isMobile ? "15px" : "40px",
                position: "relative",
                gap: "15px",
              }}
            >
              <div
                className={`aura-orb ${
                  statusText === "SPEAKING" || micMode === "active"
                    ? "listening-active"
                    : "orb-glow"
                }`}
                style={{ width: isMobile ? "80px" : "100%", marginBottom: isMobile ? "0" : "20px" }}
              >
                <div className="aura-orb-grid" aria-hidden="true" />
                <div className="aura-orb-ring aura-orb-ring-one" />
                <div className="aura-orb-ring aura-orb-ring-two" />
                <img
                  src={auraLogo}
                  alt="Aura AI"
                  className="aura-core-logo"
                  style={{ width: isMobile ? "40%" : "40%" }}
                />
                <canvas ref={modalCanvasRef} aria-hidden="true" />
              </div>
              <div style={{ textAlign: isMobile ? "left" : "center" }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--aura-display)",
                    color: lightMode ? "#21183c" : "#fff",
                    letterSpacing: "0.1em",
                  }}
                >
                  AURA AI
                </h3>
                <span
                  style={{
                    marginTop: "4px",
                    display: "block",
                    fontSize: "10px",
                    color: "var(--aura-violet)",
                    letterSpacing: "0.2em",
                    fontFamily: "var(--aura-display)",
                  }}
                >
                  {commandDetails.category}
                </span>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                minHeight: "200px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: "20px",
                  borderBottom: "1px solid var(--aura-border)", 
                }}
              >
                <div>
                  <span
                    className="aura-eyebrow"
                    style={{ color: "var(--aura-violet)", letterSpacing: "0.15em" }}
                  >
                    IDENTIFIED SUBJECT
                  </span>
                  <h3
                    style={{
                      margin: "5px 0 0",
                      fontSize: "20px",
                      color: lightMode ? "#21183c" : "#fff",
                      lineHeight: 1.2,
                    }}
                  >
                    {commandDetails.title}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowResponseModal(false);
                    setManualOpen(false);
                  }}
                  style={{
                    background: "var(--aura-border)", 
                    opacity: 0.8,
                    border: "1px solid var(--aura-border-bright)",
                    color: lightMode ? "#21183c" : "#fff", 
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 200ms",
                    flexShrink: 0,
                  }}
                >
                  <FaXmark size={18} />
                </button>
              </div>

              <div
                style={{
                  padding: "20px",
                  overflowY: "auto",
                  flex: 1,
                  color: lightMode ? "#30274b" : "#d2cbe6",
                  fontSize: "16px",
                  lineHeight: "1.8",
                  fontFamily: "var(--aura-font)",
                }}
              >
                {commandDetails.type === "media" || (commandDetails.type === "video" && Array.isArray(commandDetails.data)) ? (
                  renderResult()
                ) : (
                  <div
                    className={`aura-markdown-container ${
                      commandDetails.category === "Environment" ? "aura-weather-grid" : ""
                    }`}
                  >
                    {commandDetails.category === "Environment" && commandDetails.weatherIcon && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          marginBottom: "20px",
                        }}
                      >
                        {commandDetails.weatherIcon}
                      </div>
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {(typeof commandDetails.data === "string"
                        ? commandDetails.data
                        : JSON.stringify(commandDetails.data, null, 2)) ||
                        "No response data returned."}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="aura-header">
        <div className="aura-brand">
          <div className="aura-brand-mark">
            <img src={auraLogo} alt="Aura AI" />
          </div>
          <div>
            <h1>AURA<span> / AI</span></h1>
            <p>NEURAL COMMAND INTERFACE</p>
          </div>
        </div>

        <div className="aura-header-status">
          <span className={`aura-live-dot ${!isOnline ? "offline" : ""}`} />
          <span>{isOnline ? "CORE ONLINE" : "CORE OFFLINE"}</span>
          <span className="aura-header-divider" />
          <span className="aura-system-version">SYS.V 3.2.0</span>
        </div>

        <div className="aura-header-actions">
          {isAlarmRinging && (
            <button
              type="button"
              className="aura-icon-button"
              title="Stop Alarm"
              onClick={handleStopRinging}
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                border: "1px solid #dc2626",
                animation: "pulse 1s infinite",
              }}
            >
              <FaStop />
            </button>
          )}

          <button
            type="button"
            className={`aura-icon-button ${workspaceOpen ? "is-active" : ""}`}
            title="Open Workspace (chat mode)"
            onClick={openWorkspace}
          >
            <FaComments />
          </button>

          <button
            type="button"
            className={`aura-icon-button ${vaultOpen ? "is-active" : ""}`}
            title="Media Vault"
            onClick={() => setVaultOpen(true)}
          >
            <FaImages />
          </button>

          <button
            type="button"
            className={`aura-icon-button ${settingsOpen ? "is-active" : ""}`}
            title="System Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <FaGear />
          </button>
          
          <button
            type="button"
            className={`aura-icon-button ${handsFree ? "is-active" : ""}`}
            title={handsFree ? "Disable hands-free (Aura wake up)" : "Enable hands-free (Aura wake up)"}
            onClick={() => (handsFree ? exitHandsFree() : startHandsFree())}
          >
            <FaPowerOff />
          </button>

          <button
            type="button"
            className="aura-icon-button"
            title={lightMode ? "Switch to dark mode" : "Switch to light mode"}
            onClick={() => setLightMode((value) => !value)}
          >
            {lightMode ? <FaRegMoon /> : <FaRegSun />}
          </button>

          <button
            type="button"
            className={`aura-icon-button ${pipOpen ? "is-active" : ""}`}
            title="Open floating Aura"
            onClick={handlePopOut}
            disabled={pipOpen}
          >
            <FaUpRightFromSquare />
          </button>
        </div>
      </header>

      <main className="aura-dashboard">
        <aside className="aura-panel aura-sidebar">
          <div className="aura-panel-heading">
            <div className="aura-section-icon">
              <FaClockRotateLeft />
            </div>
            <div>
              <span className="aura-eyebrow">DATABASE / 01</span>
              <h2>Command Archive</h2>
            </div>
          </div>

          <button
            type="button"
            className="aura-search-box"
            onClick={() => setShowSearch((value) => !value)}
          >
            <FaMagnifyingGlass />
            <span>{showSearch ? "Hide search" : "Search commands"}</span>
          </button>

          {showSearch && (
            <input
              className="aura-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter your commands..."
            />
          )}

          <div className="aura-archive-heading">
            <span>RECENT ACTIVITY</span>
            <span>{filteredHistory.length.toString().padStart(2, "0")}</span>
          </div>

          <div className="aura-history-list">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item, index) => (
                <button
                  type="button"
                  className="aura-history-item"
                  key={item.id}
                  onClick={() => selectHistory(item)}
                >
                  <span className="aura-history-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="aura-history-copy">
                    <strong title={item.command}>{item.command}</strong>
                    <small>{item.timestamp}</small>
                  </span>
                  <FaArrowRight className="aura-history-arrow" />
                </button>
              ))
            ) : (
              <div className="aura-empty-history">
                <FaTerminal />
                <strong>Archive empty</strong>
                <p>Your commands will appear here after you use Aura.</p>
              </div>
            )}
          </div>

          <div className="aura-sidebar-footer">
            <div>
              <span className="aura-live-dot" /> LOCAL SESSION
            </div>
            <button
              type="button"
              className="aura-clear-button"
              onClick={clearHistory}
              disabled={history.length === 0}
            >
              <FaTrash /> CLEAR
            </button>
          </div>
        </aside>

        <section className="aura-center">
          <div className="aura-center-topline">
            <span>NEURAL INTERFACE</span>
            <span className="aura-center-coordinates">CORE // 001</span>
          </div>

          <div className="aura-core-stage" ref={centerPlaceholderRef}>
            <div className="aura-core-content" ref={centerContentRef}>
              <div id="orbContainer" className={`aura-orb ${orbClass}`}>
                <div className="aura-orb-grid" aria-hidden="true" />
                <div className="aura-orb-ring aura-orb-ring-one" />
                <div className="aura-orb-ring aura-orb-ring-two" />
                <img src={auraLogo} alt="" className="aura-core-logo" />
                <canvas ref={canvasRef} id="waveCanvas" aria-hidden="true" />
                <span className="aura-orb-cross aura-orb-cross-one" />
                <span className="aura-orb-cross aura-orb-cross-two" />
              </div>

              <div className="aura-greeting">
                <span className="aura-eyebrow">
                  {micMode === "active"
                    ? "AUDIO INPUT ACTIVE"
                    : micMode === "standby"
                    ? "STANDING BY"
                    : "AWAITING INPUT"}
                </span>
                <h2>
                  {micMode === "active" ? (
                    <>I'm <span>listening.</span></>
                  ) : micMode === "standby" ? (
                    <>Say <span>"Aura, wake up"</span></>
                  ) : (
                    <>Enter the <span>unknown.</span></>
                  )}
                </h2>
                <p id="transcriptText">{transcriptText}</p>
              </div>

              <div className="aura-status-line">
                <span className={`aura-status-indicator ${statusIndicatorClass}`} />
                <span id="statusText">{statusText}</span>
              </div>

              <button
                type="button"
                id="micBtn"
                className={`aura-mic-button ${isListening ? "is-listening" : ""}`}
                onClick={toggleMic}
                style={{
                  background: isListening
                    ? "linear-gradient(110deg, #dc2626, #ef4444 55%, #b91c1c)"
                    : "",
                  borderColor: isListening ? "rgba(248, 113, 113, 0.6)" : "",
                  boxShadow: isListening
                    ? "0 8px 28px rgba(220, 38, 38, 0.4), inset 0 1px rgba(255, 255, 255, 0.2)"
                    : "",
                  animation: isListening ? "auraMicPulse 1.5s infinite" : "none",
                }}
              >
                {isListening ? <FaStop /> : <FaMicrophone />}
                <span>
                  {isListening
                    ? "STOP LISTENING"
                    : micMode === "standby"
                    ? "WAKE NOW"
                    : "INITIATE VOICE"}
                </span>
              </button>

              <p className="aura-mic-hint">
                {micMode === "active"
                  ? "SPEAK CLEARLY · PRESS TO STOP"
                  : micMode === "standby"
                  ? "HANDS-FREE ARMED · SAY 'AURA, WAKE UP'"
                  : "CLICK TO TRANSMIT YOUR COMMAND"}
              </p>
            </div>
          </div>

          {embeddedVideo && (
            <div className="aura-embed">
              <div className="aura-embed-header">
                <span className="aura-live-dot" />
                <span>EMBEDDED PLAYER</span>
                <button
                  type="button"
                  className="aura-embed-close"
                  onClick={() => setEmbeddedVideo(null)}
                >
                  CLOSE
                </button>
              </div>
              <div className="aura-embed-frame">
                <iframe
                  src={embeddedVideo}
                  title="Aura Embedded Player"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </section>

        <aside className="aura-panel aura-results">
          <div className="aura-panel-heading">
            <div className="aura-section-icon violet">
              <FaBolt />
            </div>
            <div>
              <span className="aura-eyebrow">INTELLIGENCE / 02</span>
              <h2>Command Output</h2>
            </div>
          </div>

          <div className="aura-result-title">
            <span className="aura-eyebrow">IDENTIFIED SUBJECT</span>
            <h3>{commandDetails.title}</h3>
            <span className="aura-category-tag">{commandDetails.category}</span>
          </div>

          <div className="aura-result-metrics">
            <div>
              <span>RESULT STATUS</span>
              <strong>{commandDetails.match}</strong>
            </div>
            <div>
              <span>OUTPUT TYPE</span>
              <strong>{commandDetails.type.toUpperCase()}</strong>
            </div>
          </div>

          <div className="aura-output-heading">
            <span>RESPONSE STREAM</span>
            <span className="aura-live-dot" />
          </div>
          <div className="aura-output-content">{renderResult()}</div>

          <div className="aura-output-footer">
            <FaBolt />
            <span>AURA RESPONSE ENGINE</span>
            <span>READY</span>
          </div>
          <div className="aura-command-tip">
            <span className="aura-tip-symbol">i</span>
            <p>
              Speak a command to populate this panel with results from your existing command
              processor.
            </p>
          </div>
        </aside>
      </main>

      <footer className="aura-footer">
        <span>
          AURA AI <span className="aura-footer-divider">/</span> COMMAND CENTER
        </span>
        <span>
          NEURAL LINK <span className="aura-footer-online">● ACTIVE</span>
        </span>
        <span>COMMAND ARCHIVE PERSISTS LOCALLY</span>
      </footer>

      {workspaceOpen && (
        <AuraWorkspace
          messages={chatMessages}
          onSend={(text) => runCommand(text)}
          onStop={stopWorkspace}
          onClear={clearWorkspace}
          onClose={closeWorkspace}
          isProcessing={statusText === "PROCESSING COMMAND"}
          isListening={isListening}
          lightMode={lightMode}
          transcriptText={transcriptText}
        />
      )}

      {vaultOpen && (
        <AuraMediaVault
          onClose={() => setVaultOpen(false)}
          lightMode={lightMode}
        />
      )}

      {settingsOpen && (
        <AuraSettings
          lightMode={lightMode}
          onClose={() => setSettingsOpen(false)}
          onChange={(newSettings) => {
            setSettings(newSettings);
          }}
          availableVoices={availableVoices}
          selectedVoiceName={selectedVoiceName}
          onVoiceChange={(name) => {
            setSelectedVoiceName(name);
            setSettings((prev) => {
              const next = { ...prev, voice: { ...prev.voice, selectedVoiceName: name } };
              saveSettings(next);
              return next;
            });
          }}
          onTestVoice={(draftVoiceSettings, useCustomTuning) => {
            const voiceNameStr = draftVoiceSettings?.selectedVoiceName;
            
            const finalOverrides = useCustomTuning 
              ? draftVoiceSettings 
              : { ...draftVoiceSettings, rate: 1, pitch: 1, volume: 1 };

            auraSpeak("This is how I sound, Sir.", voiceNameStr, finalOverrides);
          }}
          pendingAlarms={pendingAlarms}
          onCancelAlarm={handleCancelAlarm}
        />
      )}
    </div>
  );
};

export default AuraAssistant;