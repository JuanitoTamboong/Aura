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
} from "react-icons/fa6";

import { FaRegMoon } from "react-icons/fa";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import "../css/AuraAssistant.css";
import auraLogo from "../assets/images/Aura-Logo.png";
import auraDatabase from "../database/aura.json";
import { processCommand } from "../command/AuraCommand";
import { clearConversation, getUserProfile } from "../command/AuraConversation";

import SplashScreen from "./SplashScreen";
import WelcomeScreen from "./WelcomeScreen";

interface CommandDetails {
  title: string;
  category: string;
  match: string;
  type: string;
  data: any;
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

const AuraAssistant: React.FC = () => {
  const [bootStage, setBootStage] = useState<BootStage>("splash");

  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("SYSTEM ONLINE");
  const [transcriptText, setTranscriptText] = useState(
    "Awaiting your command, operator."
  );
  const [commandDetails, setCommandDetails] =
    useState<CommandDetails>(INITIAL_DETAILS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const [showLogs, setShowLogs] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);

  const [userProfile, setUserProfile] = useState(getUserProfile());

  const [showResponseModal, setShowResponseModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [embeddedVideo, setEmbeddedVideo] = useState<string | null>(null);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");

  const [handsFree, setHandsFree] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>("off");

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
  const stopRequestedRef = useRef(false);
  const autoCloseTimeoutRef = useRef<any>(null);

  const micModeRef = useRef<MicMode>("off");
  const handsFreeRef = useRef(false);
  const wakeCooldownRef = useRef(false);

  // Load user's name on boot
  useEffect(() => {
    const profile = getUserProfile();
    if (profile.name && profile.name !== "Operator") {
      setTranscriptText(`Awaiting your command, ${profile.name}.`);
    } else {
      setTranscriptText("Awaiting your command, operator.");
    }
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 760);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    micModeRef.current = micMode;
  }, [micMode]);

  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      if (!selectedVoiceName && voices.length > 0) {
        const defaultVoice = voices.find(v => v.name.includes("David")) ||
                             voices.find(v => v.lang.includes("en"));
        if (defaultVoice) {
          setSelectedVoiceName(defaultVoice.name);
        }
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceName]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      isListeningRef.current = false;

      try {
        recognitionRef.current?.abort();
      } catch {}

      window.speechSynthesis?.cancel();
      cancelAnimationFrame(mainAnimationRef.current);
      cancelAnimationFrame(pipAnimationRef.current);
      cancelAnimationFrame(modalAnimationRef.current);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
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

      const particles = Array.from({ length: 240 }, (_, i) => ({
        angle: (i / 240) * Math.PI * 2,
        size: 0.8 + Math.random() * 1.4,
        speed: 0.7 + Math.random() * 0.6,
        offset: Math.random() * Math.PI * 2,
        color: isLightPiP 
          ? (i % 2 === 0 ? "electric-blue" : "hot-pink") 
          : (i % 2 === 0 ? "cyan" : "violet"),
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

        ctx.clearRect(0, 0, width, height);

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width, height) * 0.32;
        const active =
          micModeRef.current === "active" || window.speechSynthesis.speaking;

        phase += active ? 0.045 : 0.012;

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
            ctx.fillStyle = `rgba(167, 110, 255, ${pulse})`;
            ctx.shadowColor = "#8b5cf6";
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
    if (showResponseModal && !isMobile && modalCanvasRef.current) {
      return startAnimation(modalCanvasRef.current, modalAnimationRef, window);
    }
  }, [showResponseModal, startAnimation, isMobile]);

  // ★ FIX: Added utterance.onerror to ensure mic isn't permanently ignored if speech fails
  const auraSpeak = useCallback((text: string) => {
    if (!text?.trim() || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    ignoreMicRef.current = true;

    const warmUp = new SpeechSynthesisUtterance(" ");
    warmUp.volume = 0;
    window.speechSynthesis.speak(warmUp);

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.6;
      utterance.rate = 0.85;

      const voices = window.speechSynthesis.getVoices();
      const chosenVoice = voices.find(v => v.name === selectedVoiceName);
      if (chosenVoice) utterance.voice = chosenVoice;

      utterance.onend = () => {
        ignoreMicRef.current = false; 
        if (isListeningRef.current) {
          setStatusText((prev) => (prev === "SPEAKING" ? "LISTENING" : prev));
        }
      };

      utterance.onerror = () => {
        ignoreMicRef.current = false; 
      };

      window.speechSynthesis.speak(utterance);
    }, 50);
  }, [selectedVoiceName]);

  // ★ FIX: Add a dedicated effect to test the voice when the user changes it in the dropdown
  const prevVoiceRef = useRef<string>("");
  useEffect(() => {
    // Only speak if the voice actually changed (ignores initial setup) and it's not empty
    if (selectedVoiceName && prevVoiceRef.current && prevVoiceRef.current !== selectedVoiceName) {
      auraSpeak("Voice updated. How does this sound?");
    }
    prevVoiceRef.current = selectedVoiceName;
  }, [selectedVoiceName, auraSpeak]);

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
    
    try {
      recognitionRef.current?.stop();
    } catch {}
    
    setStatusText("SYSTEM ONLINE");
  }, []);

  const enterActiveMode = useCallback(() => {
    if (micModeRef.current === "active") return;
    micModeRef.current = "active";
    setMicMode("active");
    setIsListening(true);
    isListeningRef.current = true;
    setStatusText("LISTENING");
    setTranscriptText("I'm listening. Say your command.");
    
    try {
      recognitionRef.current?.abort(); 
      setTimeout(() => { recognitionRef.current?.start(); }, 100);
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
    setStatusText("SYSTEM ONLINE");
    setTranscriptText("Voice mode off. Click INITIATE VOICE to restart.");
  }, []);

  const runCommand = useCallback(
    (command: string) => {
      const cleaned = command.trim().replace(/\b(hey aura|okay aura|aura)\b/gi, "").trim();
      
      if (!cleaned || cleaned.length < 2) return;

      console.log("[Aura] Processing command:", cleaned);

      addHistory(cleaned);
      setTranscriptText(`"${cleaned}"`);
      setStatusText("PROCESSING COMMAND");

      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }

      try {
        processCommand({
          cmd: cleaned,
          auraDatabase,
          setStatusText,
          setTranscriptText,
          setCommandDetails,
          auraSpeak,
          setEmbeddedVideo,
          stopMic,
        }).then(() => {
          setUserProfile(getUserProfile());
        });
        
        if (!isMobile) {
          setTimeout(() => {
            setShowResponseModal(true);
          }, 300);
        }

      } catch (error) {
        console.error("Aura command failed:", error);
        setStatusText("COMMAND ERROR");
        setTranscriptText("Unable to process this command. Please try again.");
      }
    },
    [addHistory, auraSpeak, stopMic, isMobile]
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

      try {
        recognitionRef.current?.abort();
      } catch {}

      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        const finalCommands: string[] = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0]?.transcript?.trim();

          if (!text) continue;

          if (result.isFinal) {
            finalCommands.push(text);
          } else {
            interim += text;
          }
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

          if (handsFreeRef.current) {
            if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
            
            clearConversation();
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

          if (!handsFreeRef.current) {
            if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);

            stopMic(); 
            clearConversation();
            setEmbeddedVideo(null);
            setTranscriptText(`Stopped.`); 
            setCommandDetails({
              title: "Standing By",
              category: "Awaiting Command",
              match: "100%",
              type: "text",
              data: "System paused. Click INITIATE VOICE to start a new session.",
            });
            setShowResponseModal(false); 
            lastCommandTextRef.current = ""; 
            return;
          }
        }

        if (WAIT_WORDS.test(heardText)) {
          try { window.speechSynthesis.cancel(); } catch {}
          
          if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
          
          setStatusText("LISTENING");
          setTranscriptText(`Waiting...`); 
          setCommandDetails({
            title: "Waiting",
            category: "Standing By",
            match: "100%",
            type: "text",
            data: "I'm listening. Take your time — say your command when ready.",
          });
          lastCommandTextRef.current = ""; 
          return;
        }

        if (window.speechSynthesis.speaking || ignoreMicRef.current) {
          return; 
        }

        if (interim && mountedRef.current) {
          setTranscriptText(`"${interim}"`);
        }

        finalCommands.forEach((cmd) => {
          if (cmd !== lastCommandTextRef.current && cmd.length > 1) {
            lastCommandTextRef.current = cmd; 
            
            if (mountedRef.current) {
              setTranscriptText(`"${cmd}"`); 
            }

            runCommand(cmd);       
            
            setTimeout(() => {
              if (lastCommandTextRef.current === cmd) lastCommandTextRef.current = "";
            }, 3000);
          }
        });
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
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
        
        if ((mode === "standby" || mode === "active") && !stopRequestedRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error("Mic auto-restart failed:", e);
          }
        } else {
          setStatusText((previous: string) =>
            previous === "LISTENING" || previous === "STANDBY"
              ? "SYSTEM ONLINE"
              : previous
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
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, [setupSpeechRecognition]);

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
    } catch (err) {
      console.error("Hands-free start failed:", err);
      setStatusText("MIC UNAVAILABLE");
    }
  }, [setupSpeechRecognition, enterStandbyMode, auraSpeak]);

  const toggleMic = useCallback(() => {
    if (handsFreeRef.current) {
      if (micModeRef.current === "standby") {
        enterActiveMode();
        return;
      }
      window.speechSynthesis.cancel();
      exitHandsFree();
      return;
    }

    if (isListeningRef.current) {
      stopRequestedRef.current = true;
      isListeningRef.current = false;
      setIsListening(false);
      try { recognitionRef.current?.abort(); } catch {}
      
      window.speechSynthesis.cancel(); 
      
      setStatusText("SYSTEM ONLINE");
      setShowResponseModal(false);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);

      return;
    }

    stopRequestedRef.current = false; 
    setStatusText("INITIALIZING...");
    window.speechSynthesis.cancel();
    lastCommandTextRef.current = ""; 
    
    setupSpeechRecognition(window);
    
    try {
      recognitionRef.current.start();
      isListeningRef.current = true;
      setIsListening(true);
      setStatusText("LISTENING");
      setTranscriptText("Listening for your command...");
    } catch (error) {
      console.error("Could not start voice recognition:", error);
      setStatusText("MICROPHONE UNAVAILABLE");
    }
  }, [setupSpeechRecognition, enterActiveMode, exitHandsFree]);

  useEffect(() => {
    if (bootStage === "ready") {
      const savedHandsFree = localStorage.getItem("aura_hands_free");
      if (savedHandsFree === "true") {
        startHandsFree();
      }
    }
  }, [bootStage, startHandsFree]);

  // ★ NEW: Auto-close modal AFTER Aura finishes speaking
  useEffect(() => {
    if (!showResponseModal || isMobile) return;

    const checkSpeechAndClose = () => {
      // If Aura is not speaking anymore, start the 3-second close timer
      if (!window.speechSynthesis.speaking) {
        if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
        
        autoCloseTimeoutRef.current = setTimeout(() => {
          setShowResponseModal(false);
        }, 3000);
      } else {
        // If still speaking, keep checking
        setTimeout(checkSpeechAndClose, 500);
      }
    };

    // Initial delay to allow the speech synthesis to start
    const initialDelay = setTimeout(checkSpeechAndClose, 1000);
    
    return () => {
      clearTimeout(initialDelay);
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    };
  }, [showResponseModal, isMobile]);

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
          width: 420, height: 620,
        });

      pipWindowRef.current = pipWindow;

      [...document.styleSheets].forEach((sheet) => {
        try {
          const css = [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
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
          background: radial-gradient(ellipse at 50% 40%, rgba(91,33,182,.18), transparent 55%), #080714;
          color: #f5f3ff; font-family: Rajdhani, sans-serif;
          display: flex; align-items: center; justify-content: center;
          padding: 18px; transition: background 250ms ease, color 250ms ease;
        }
        body.aura-light-pip { background: radial-gradient(ellipse at 50% 40%, rgba(196, 181, 253, 0.4), transparent 55%), #f2efff; color: #1e1b36; }
        body.aura-light-pip #auraPipStatus { color: #6b628a; }
        body.aura-light-pip .aura-pip-orb { border-color: rgba(139, 92, 246, 0.4); background: radial-gradient(circle at 50% 45%, rgba(75, 38, 150, .34), rgba(20, 15, 51, .65) 40%, rgba(7, 6, 19, .95) 75%); box-shadow: 0 0 0 8px rgba(139, 92, 246, 0.1), 0 0 55px rgba(139, 92, 246, 0.25), inset 0 0 45px rgba(139, 92, 246, 0.2); }
        body.aura-light-pip .aura-pip-orb::before { border-color: rgba(139, 92, 246, 0.3); }
        body.aura-light-pip .aura-pip-orb .aura-orb-ring-one { border-left-color: #3b82f6; border-right-color: #8b5cf6; }
        body.aura-light-pip .aura-pip-orb .aura-orb-ring-two { border-top-color: #3b82f6; border-bottom-color: #e879f9; }
        body.aura-light-pip .aura-pip-orb .aura-orb-grid { background: repeating-conic-gradient(from 0deg, rgba(139, 92, 246, 0.15) 0deg 0.5deg, transparent 0.5deg 18deg); border-color: rgba(139, 92, 246, 0.2); }
        .aura-pip { width: 100%; text-align: center; }
        .aura-pip-orb { position: relative; isolation: isolate; display: grid; place-items: center; width: min(260px, 72vw); aspect-ratio: 1; margin: 0 auto 30px auto; overflow: hidden; border: 1px solid rgba(139, 92, 246, .6); border-radius: 50%; background: radial-gradient(circle at 50% 45%, rgba(75, 38, 150, .34), rgba(20, 15, 51, .65) 40%, rgba(7, 6, 19, .95) 75%); box-shadow: 0 0 0 8px rgba(139, 92, 246, .025), 0 0 0 18px rgba(139, 92, 246, .02), 0 0 55px rgba(124, 58, 237, .2), inset 0 0 45px rgba(59, 130, 246, .09); transition: all 250ms ease; }
        .aura-pip-orb::before { content: ""; position: absolute; inset: 9%; border: 1px dashed rgba(167, 139, 250, .23); border-radius: 50%; animation: auraRotate 45s linear infinite; transition: border-color 250ms ease; }
        .aura-pip-orb .aura-orb-grid { position: absolute; inset: 15%; border: 1px solid rgba(59, 130, 246, .18); border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(139, 92, 246, .07) 0deg .5deg, transparent .5deg 18deg); mask-image: radial-gradient(circle, transparent 20%, black 100%); -webkit-mask-image: radial-gradient(circle, transparent 20%, black 100%); transition: all 250ms ease; }
        .aura-pip-orb .aura-orb-ring { position: absolute; border: 1px solid rgba(139, 92, 246, .25); border-radius: 50%; transition: border-color 250ms ease; }
        .aura-pip-orb .aura-orb-ring-one { inset: 22%; border-left-color: rgba(103, 232, 249, .65); border-right-color: rgba(167, 139, 250, .65); transform: rotate(-35deg); animation: auraRotate 12s linear infinite; }
        .aura-pip-orb .aura-orb-ring-two { inset: 29%; border-top-color: rgba(103, 232, 249, .6); border-bottom-color: rgba(232, 121, 249, .55); transform: rotate(40deg); animation: auraRotateReverse 16s linear infinite; }
        .aura-pip-orb .aura-core-logo { position: absolute; z-index: 2; width: 26%; height: 26%; object-fit: contain; opacity: .92; filter: drop-shadow(0 0 12px rgba(167, 139, 250, .65)) drop-shadow(0 0 25px rgba(59, 130, 246, .32)); pointer-events: none; }
        .aura-pip-orb canvas { position: absolute; inset: 0; z-index: 3; width: 100%; height: 100%; pointer-events: none; }
        @keyframes auraRotate { to { transform: rotate(325deg); } }
        @keyframes auraRotateReverse { to { transform: rotate(-320deg); } }
        #auraPipStatus { margin: 0 0 16px; color: #b4a8d8; font-family: Orbitron, sans-serif; font-size: 10px; letter-spacing: .14em; transition: color 250ms ease; }
        .aura-pip button { border: 1px solid rgba(196,181,253,.42); background: linear-gradient(110deg, #5b21b6, #4338ca 55%, #1d4ed8); color: white; border-radius: 11px; padding: 13px 26px; cursor: pointer; font-family: Orbitron, sans-serif; font-size: 10px; font-weight: 600; letter-spacing: .13em; box-shadow: 0 8px 28px rgba(91,33,182,.24), inset 0 1px rgba(255,255,255,.12); transition: filter 180ms ease, transform 180ms ease; }
        .aura-pip button:hover { filter: brightness(1.12); transform: translateY(-1px); }
      `;
      pipWindow.document.head.appendChild(style);

      if (lightMode) {
        pipWindow.document.body.classList.add("aura-light-pip");
      }

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
      pipMic?.addEventListener("click", toggleMic);

      const syncInterval = window.setInterval(updatePip, 500);

      pipWindow.addEventListener("pagehide", () => {
        window.clearInterval(syncInterval);
        stopAnimation();
        cancelAnimationFrame(pipAnimationRef.current);
        pipWindowRef.current = null;
        setPipOpen(false);
      }, { once: true });

      setPipOpen(true);
    } catch (error) {
      console.error("Aura Picture-in-Picture failed:", error);
      setStatusText("POP-OUT FAILED");
      setTranscriptText("Unable to open the floating Aura window.");
    }
  }, [startAnimation, toggleMic, pipOpen, lightMode]);

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
    if (!isMobile) setShowResponseModal(true);
  };

  const clearHistory = () => {
    setHistory([]);
    setSearchQuery("");
    clearConversation();
  };

  const renderResult = () => {
    if (commandDetails.type === "video" && Array.isArray(commandDetails.data)) {
      if (commandDetails.data.length === 0) return <p className="aura-empty">No video results returned.</p>;

      return commandDetails.data.map((video: any, index: number) => (
        <article className="aura-video" key={`${video.title}-${index}`}>
          {video.img ? <img src={video.img} alt="" loading="lazy" /> : <div className="aura-video-placeholder"><FaPlay /></div>}
          <div className="aura-video-info">
            <strong>{video.title || "Untitled video"}</strong>
            <span>VIDEO RESULT</span>
          </div>
          <button type="button" className="aura-icon-button" aria-label={`Play ${video.title || "video"}`}
            onClick={() => {
              const query = video.query || video.title;
              if (query) setEmbeddedVideo(`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1`);
            }}
          >
            <FaPlay />
          </button>
        </article>
      ));
    }

    const resultText = typeof commandDetails.data === "string" ? commandDetails.data : JSON.stringify(commandDetails.data, null, 2);

    return (
      <div 
        className="aura-response" 
        onClick={() => {
          if (!isMobile) setShowResponseModal(true);
        }}
        style={{ cursor: isMobile ? "default" : "pointer" }}
      >
        <div className="aura-response-label">
          <span className="aura-live-dot" />
          RESPONSE DATA {!isMobile && "(CLICK TO EXPAND)"}
        </div>
        <div className="aura-markdown-container">
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

  return (
    <div className={`aura-app ${lightMode ? "aura-light" : ""}`}>
      <div className="aura-scanlines" aria-hidden="true" />
      <div className="aura-ambient aura-ambient-one" aria-hidden="true" />
      <div className="aura-ambient aura-ambient-two" aria-hidden="true" />

      {showResponseModal && !isMobile && (
        <div 
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(5, 3, 15, 0.7)",
            backdropFilter: "blur(12px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            animation: "auraEmbedIn 200ms ease"
          }}
        >
          <div 
            style={{
              background: lightMode ? "rgba(255, 255, 255, 0.95)" : "rgba(15, 12, 32, 0.95)",
              border: "1px solid rgba(139, 92, 246, 0.4)",
              borderRadius: "24px",
              width: "100%",
              maxWidth: "900px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "row",
              boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 80px rgba(139, 92, 246, 0.15)",
              overflow: "hidden"
            }}
          >
            <div style={{ 
              width: "350px", 
              flexShrink: 0,
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center", 
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(0,0,0,0) 100%)",
              borderRight: "1px solid rgba(139, 92, 246, 0.2)",
              padding: "40px",
              position: "relative"
            }}>
              <div 
                className={`aura-orb ${statusText === "SPEAKING" || micMode === "active" ? "listening-active" : "orb-glow"}`} 
                style={{ width: "100%", marginBottom: "20px" }}
              >
                <div className="aura-orb-grid" aria-hidden="true" />
                <div className="aura-orb-ring aura-orb-ring-one" />
                <div className="aura-orb-ring aura-orb-ring-two" />
                <img src={auraLogo} alt="Aura AI" className="aura-core-logo" style={{ width: "40%" }} />
                <canvas ref={modalCanvasRef} aria-hidden="true" />
              </div>
              <h3 style={{ 
                margin: 0, 
                fontFamily: "var(--aura-display)", 
                color: lightMode ? "#21183c" : "#fff",
                letterSpacing: "0.1em",
                textAlign: "center"
              }}>
                AURA AI
              </h3>
              <span style={{ 
                marginTop: "8px", 
                fontSize: "10px", 
                color: "#a78bfa",
                letterSpacing: "0.2em",
                fontFamily: "var(--aura-display)"
              }}>
                {commandDetails.category}
              </span>
            </div>

            <div style={{ 
              flex: 1, 
              display: "flex", 
              flexDirection: "column",
              position: "relative"
            }}>
              <div style={{ 
                display: "flex", justifyContent: "space-between", alignItems: "flex-start", 
                padding: "24px 30px", 
                borderBottom: "1px solid rgba(139, 92, 246, 0.15)",
              }}>
                <div>
                  <span className="aura-eyebrow" style={{ color: "#a78bfa", letterSpacing: "0.15em" }}>IDENTIFIED SUBJECT</span>
                  <h3 style={{ margin: "5px 0 0", fontSize: "22px", color: lightMode ? "#21183c" : "#fff", lineHeight: 1.2 }}>
                    {commandDetails.title}
                  </h3>
                </div>
                <button 
                  onClick={() => {
                    setShowResponseModal(false);
                    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
                  }}
                  style={{
                    background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.3)",
                    color: "#a78bfa", width: "36px", height: "36px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 200ms", flexShrink: 0
                  }}
                >
                  <FaXmark size={18} />
                </button>
              </div>

              <div style={{ 
                padding: "30px", overflowY: "auto", flex: 1, 
                color: lightMode ? "#30274b" : "#d2cbe6",
                fontSize: "16px", lineHeight: "1.8",
                fontFamily: "var(--aura-font)"
              }}>
                {commandDetails.type === "video" && Array.isArray(commandDetails.data) ? (
                  renderResult()
                ) : (
                  <div className="aura-markdown-container">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {(typeof commandDetails.data === "string" ? commandDetails.data : JSON.stringify(commandDetails.data, null, 2)) || "No response data returned."}
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
          <span className="aura-live-dot" />
          <span>CORE ONLINE</span>
          <span className="aura-header-divider" />
          <span className="aura-system-version">SYS.V 2.0</span>
        </div>

        <div className="aura-header-actions">
          <button type="button" className="aura-icon-button" title="System Logs" onClick={() => setShowLogs((value) => !value)}><FaTerminal /></button>
          <button
            type="button"
            className={`aura-icon-button ${handsFree ? "is-active" : ""}`}
            title={handsFree ? "Disable hands-free (Aura wake up)" : "Enable hands-free (Aura wake up)"}
            onClick={() => (handsFree ? exitHandsFree() : startHandsFree())}
          >
            <FaPowerOff />
          </button>
          <button type="button" className="aura-icon-button" title="Toggle appearance" onClick={() => setLightMode((value) => !value)}><FaRegMoon /></button>
          <button type="button" className={`aura-icon-button ${pipOpen ? "is-active" : ""}`} title="Open floating Aura" onClick={handlePopOut} disabled={pipOpen}><FaUpRightFromSquare /></button>
        </div>
      </header>

      {showLogs && (
        <div className="aura-notification">
          <strong style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--aura-violet)', fontSize: '11px' }}><FaTerminal /> SYSTEM SETTINGS & LOGS</strong>
          
          <div style={{ marginTop: '15px', marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: 'var(--aura-muted)', marginBottom: '5px', fontFamily: 'monospace' }}>SELECT AURA'S VOICE:</label>
            <select 
              value={selectedVoiceName} 
              onChange={(e) => setSelectedVoiceName(e.target.value)} 
              style={{ 
                width: '100%', padding: '8px', 
                background: lightMode ? '#ffffff' : '#0f0d23', 
                color: lightMode ? '#21183c' : '#fff', 
                border: '1px solid var(--aura-border-bright)', 
                borderRadius: '5px', fontSize: '12px', outline: 'none',
                colorScheme: lightMode ? 'light' : 'dark' // ★ FIX: Helps native dropdown styling
              }}
            >
              {availableVoices.map((voice, idx) => (
                <option 
                  key={idx} 
                  value={voice.name}
                  style={{
                    background: lightMode ? '#ffffff' : '#0f0d23',
                    color: lightMode ? '#21183c' : '#fff'
                  }}
                >
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '5px', border: '1px solid var(--aura-border)' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--aura-muted)', marginBottom: '5px', fontFamily: 'monospace' }}>
              <span>USER MEMORY PROFILE:</span>
              <span style={{ color: 'var(--aura-violet)', cursor: 'pointer' }} onClick={() => setUserProfile(getUserProfile())}>↻ REFRESH</span>
            </label>
            
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--aura-text)', fontFamily: 'monospace' }}>
              <strong>Name:</strong> {userProfile.name}
            </p>
            
            {userProfile.facts && userProfile.facts.length > 0 ? (
               <p style={{ margin: '5px 0 0', fontSize: '11px', color: 'var(--aura-text)', fontFamily: 'monospace' }}>
                 <strong>Facts:</strong>
                 <br/>
                 {userProfile.facts.map((fact, idx) => (
                   <span key={idx}>• {fact}<br/></span>
                 ))}
               </p>
            ) : (
              <p style={{ margin: '5px 0 0', fontSize: '10px', color: 'var(--aura-subtle)', fontFamily: 'monospace', fontStyle: 'italic' }}>
                No additional facts saved yet.
              </p>
            )}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--aura-muted)', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', borderTop: '1px solid var(--aura-border)', paddingTop: '10px' }}>
            <p>• Core initialisation successful.</p>
            <p>• Speech recognition ready.</p>
            {handsFree && <p style={{ color: 'var(--aura-violet)' }}>• Hands-free mode active ({micMode}).</p>}
            {history.length > 0 && <p style={{ color: 'var(--aura-violet)' }}>• Last command: "{history[0].command}"</p>}
            {embeddedVideo && <p style={{ color: 'var(--aura-cyan)' }}>• Embedded player active.</p>}
            {pipOpen && <p style={{ color: 'var(--aura-cyan)' }}>• Floating Aura window active.</p>}
          </div>
          <button type="button" onClick={() => setShowLogs(false)} style={{ marginTop: '15px', width: '100%' }}>Close Settings</button>
        </div>
      )}

      <main className="aura-dashboard">
        <aside className="aura-panel aura-sidebar">
          <div className="aura-panel-heading">
            <div className="aura-section-icon"><FaClockRotateLeft /></div>
            <div><span className="aura-eyebrow">DATABASE / 01</span><h2>Command Archive</h2></div>
          </div>

          <button type="button" className="aura-search-box" onClick={() => setShowSearch((value) => !value)}>
            <FaMagnifyingGlass /><span>{showSearch ? "Hide search" : "Search commands"}</span>
          </button>

          {showSearch && <input className="aura-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Filter your commands..." />}

          <div className="aura-archive-heading">
            <span>RECENT ACTIVITY</span><span>{filteredHistory.length.toString().padStart(2, "0")}</span>
          </div>

          <div className="aura-history-list">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item, index) => (
                <button type="button" className="aura-history-item" key={item.id} onClick={() => selectHistory(item)}>
                  <span className="aura-history-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="aura-history-copy"><strong>{item.command}</strong><small>{item.timestamp}</small></span>
                  <FaArrowRight className="aura-history-arrow" />
                </button>
              ))
            ) : (
              <div className="aura-empty-history"><FaTerminal /><strong>Archive empty</strong><p>Your commands will appear here after you use Aura.</p></div>
            )}
          </div>

          <div className="aura-sidebar-footer">
            <div><span className="aura-live-dot" /> LOCAL SESSION</div>
            <button type="button" className="aura-clear-button" onClick={clearHistory} disabled={history.length === 0}><FaTrash /> CLEAR</button>
          </div>
        </aside>

        <section className="aura-center">
          <div className="aura-center-topline">
            <span>NEURAL INTERFACE</span><span className="aura-center-coordinates">CORE // 001</span>
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
                  {micMode === "active" ? "AUDIO INPUT ACTIVE"
                   : micMode === "standby" ? "STANDING BY"
                   : "AWAITING INPUT"}
                </span>
                <h2>
                  {micMode === "active" ? <>I'm <span>listening.</span></>
                   : micMode === "standby" ? <>Say <span>"Aura, wake up"</span></>
                   : <>Enter the <span>unknown.</span></>}
                </h2>
                <p id="transcriptText">{transcriptText}</p>
              </div>

              <div className="aura-status-line">
                <span className={`aura-status-indicator ${micMode === "active" ? "active" : ""}`} />
                <span id="statusText">{statusText}</span>
              </div>

              <button type="button" id="micBtn" className={`aura-mic-button ${micMode === "active" ? "is-listening" : ""}`} onClick={toggleMic}>
                {micMode === "active" ? <FaStop /> : <FaMicrophone />}
                <span>
                  {micMode === "active" ? "END SESSION"
                   : micMode === "standby" ? "WAKE NOW"
                   : "INITIATE VOICE"}
                </span>
              </button>

              <p className="aura-mic-hint">
                {micMode === "active" ? "SPEAK CLEARLY · PRESS TO STOP"
                 : micMode === "standby" ? "HANDS-FREE ARMED · SAY 'AURA, WAKE UP'"
                 : "CLICK TO TRANSMIT YOUR COMMAND"}
              </p>
            </div>
          </div>

          {embeddedVideo && (
            <div className="aura-embed">
              <div className="aura-embed-header"><span className="aura-live-dot" /><span>EMBEDDED PLAYER</span><button type="button" className="aura-embed-close" onClick={() => setEmbeddedVideo(null)}>CLOSE</button></div>
              <div className="aura-embed-frame"><iframe src={embeddedVideo} title="Aura Embedded Player" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
            </div>
          )}
        </section>

        <aside className="aura-panel aura-results">
          <div className="aura-panel-heading">
            <div className="aura-section-icon violet"><FaBolt /></div>
            <div><span className="aura-eyebrow">INTELLIGENCE / 02</span><h2>Command Output</h2></div>
          </div>

          <div className="aura-result-title">
            <span className="aura-eyebrow">IDENTIFIED SUBJECT</span><h3>{commandDetails.title}</h3><span className="aura-category-tag">{commandDetails.category}</span>
          </div>

          <div className="aura-result-metrics">
            <div><span>RESULT STATUS</span><strong>{commandDetails.match}</strong></div>
            <div><span>OUTPUT TYPE</span><strong>{commandDetails.type.toUpperCase()}</strong></div>
          </div>

          <div className="aura-output-heading"><span>RESPONSE STREAM</span><span className="aura-live-dot" /></div>
          <div className="aura-output-content">{renderResult()}</div>

          <div className="aura-output-footer"><FaBolt /><span>AURA RESPONSE ENGINE</span><span>READY</span></div>
          <div className="aura-command-tip"><span className="aura-tip-symbol">i</span><p>Speak a command to populate this panel with results from your existing command processor.</p></div>
        </aside>
      </main>

      <footer className="aura-footer">
        <span>AURA AI <span className="aura-footer-divider">/</span> COMMAND CENTER</span>
        <span>NEURAL LINK <span className="aura-footer-online">● ACTIVE</span></span>
        <span>SESSION HISTORY IS NOT PERSISTED</span>
      </footer>
    </div>
  );
};

export default AuraAssistant;