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
  FaHouse,
  FaMagnifyingGlass,
  FaLayerGroup,
  FaFolder,
  FaPlay,
  FaStop,
  FaTerminal,
  FaBolt,
  FaArrowRight,
  FaTrash,
} from "react-icons/fa6";

import { FaRegBell, FaRegMoon } from "react-icons/fa";

import "../css/AuraAssistant.css";
import auraLogo from "../assets/images/Aura-Logo.png";
import auraDatabase from "../database/aura.json";
import { processCommand } from "../command/AuraCommand";

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

const AuraAssistant: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [statusText, setStatusText] = useState("SYSTEM ONLINE");
  const [transcriptText, setTranscriptText] = useState(
    "Awaiting your command, operator."
  );
  const [commandDetails, setCommandDetails] =
    useState<CommandDetails>(INITIAL_DETAILS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeNav, setActiveNav] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const historyIdRef = useRef(0);
  const centerContentRef = useRef<HTMLDivElement | null>(null);
  const centerPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const mainAnimationRef = useRef<number>(0);
  const pipAnimationRef = useRef<number>(0);
  const pipWindowRef = useRef<Window | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      isListeningRef.current = false;

      try {
        recognitionRef.current?.abort();
      } catch {
        // Recognition may already be stopped.
      }

      window.speechSynthesis?.cancel();
      cancelAnimationFrame(mainAnimationRef.current);
      cancelAnimationFrame(pipAnimationRef.current);
    };
  }, []);

  // ---------------------------------------------------------
  // PARTICLE ORB
  // ---------------------------------------------------------

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

      const particles = Array.from({ length: 240 }, (_, i) => ({
        angle: (i / 240) * Math.PI * 2,
        size: 0.8 + Math.random() * 1.4,
        speed: 0.7 + Math.random() * 0.6,
        offset: Math.random() * Math.PI * 2,
        color: i % 2 === 0 ? "cyan" : "violet",
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
        const active = isListeningRef.current;

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
          ctx.fillStyle =
            particle.color === "cyan"
              ? `rgba(80, 210, 255, ${pulse})`
              : `rgba(167, 110, 255, ${pulse})`;

          ctx.shadowBlur = active ? 12 : 5;
          ctx.shadowColor =
            particle.color === "cyan" ? "#22d3ee" : "#8b5cf6";

          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.shadowBlur = 0;

        // Inner orbital rings.
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(phase * 0.18);

        [0.39, 0.44].forEach((factor, index) => {
          ctx.beginPath();
          ctx.ellipse(
            0,
            0,
            radius * factor * 2.1,
            radius * factor * 1.1,
            index * 0.4,
            0,
            Math.PI * 2
          );

          ctx.strokeStyle =
            index === 0
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
    if (!canvas) return;

    return startAnimation(canvas, mainAnimationRef, window);
  }, [startAnimation]);

  // ---------------------------------------------------------
  // SPEECH OUTPUT
  // ---------------------------------------------------------

  const auraSpeak = useCallback((text: string) => {
    if (!text?.trim() || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.05;
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  // ---------------------------------------------------------
  // COMMAND HISTORY
  // ---------------------------------------------------------

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

  const runCommand = useCallback(
    (command: string) => {
      const cleaned = command.trim();
      if (!cleaned) return;

      addHistory(cleaned);
      setTranscriptText(`"${cleaned}"`);
      setStatusText("PROCESSING COMMAND");

      try {
        processCommand({
          cmd: cleaned,
          auraDatabase,
          setStatusText,
          setTranscriptText,
          setCommandDetails,
          auraSpeak,
          stopMic: () => {
            isListeningRef.current = false;
            setIsListening(false);

            try {
              recognitionRef.current?.stop();
            } catch {
              // Recognition may already be stopped.
            }

            setStatusText("SYSTEM ONLINE");
          },
        });
      } catch (error) {
        console.error("Aura command failed:", error);
        setStatusText("COMMAND ERROR");
        setTranscriptText("Unable to process this command. Please try again.");
      }
    },
    [addHistory, auraSpeak]
  );

  // ---------------------------------------------------------
  // SPEECH RECOGNITION
  // ---------------------------------------------------------

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
      } catch {
        // Ignore previous recognition instance.
      }

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

        if (interim && mountedRef.current) {
          setTranscriptText(`"${interim}"`);
        }

        finalCommands.forEach(runCommand);
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") {
          return;
        }

        isListeningRef.current = false;
        setIsListening(false);

        if (event.error === "not-allowed" ||
            event.error === "service-not-allowed") {
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
        if (!isListeningRef.current) {
          setStatusText((previous: string) =>
            previous === "LISTENING" ? "SYSTEM ONLINE" : previous
          );
          return;
        }

        // Restart if the browser automatically ends a listening session.
        try {
          recognition.start();
        } catch {
          // Some browsers briefly reject a restart while stopping.
        }
      };

      recognitionRef.current = recognition;
    },
    [runCommand]
  );

  useEffect(() => {
    setupSpeechRecognition(window);

    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore during cleanup.
      }
    };
  }, [setupSpeechRecognition]);

  const toggleMic = useCallback(() => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setStatusText("VOICE NOT SUPPORTED");
      setTranscriptText(
        "Use a supported browser with microphone access, such as desktop Chrome."
      );
      return;
    }

    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);

      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }

      setStatusText("SYSTEM ONLINE");
      return;
    }

    try {
      recognition.start();
      isListeningRef.current = true;
      setIsListening(true);
      setStatusText("LISTENING");
      setTranscriptText("Listening for your command...");
    } catch (error) {
      console.error("Could not start voice recognition:", error);
      setStatusText("MICROPHONE UNAVAILABLE");
    }
  }, []);

  // ---------------------------------------------------------
  // PICTURE-IN-PICTURE  (fixed: top logo removed, orb centered)
  // ---------------------------------------------------------

  const handlePopOut = useCallback(async () => {
    const browser = window as any;

    if (!browser.documentPictureInPicture) {
      setStatusText("POP-OUT NOT SUPPORTED");
      setTranscriptText(
        "Your browser does not support Document Picture-in-Picture."
      );
      return;
    }

    try {
      const pipWindow: Window =
        await browser.documentPictureInPicture.requestWindow({
          width: 420,
          height: 620,
        });

      pipWindowRef.current = pipWindow;

      // Copy accessible stylesheets to the PiP document.
      [...document.styleSheets].forEach((sheet) => {
        try {
          const css = [...sheet.cssRules]
            .map((rule) => rule.cssText)
            .join("\n");

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
          margin: 0;
          min-height: 100vh;
          background: radial-gradient(ellipse at 50% 40%, rgba(91,33,182,.18), transparent 55%), #080714;
          color: #f5f3ff;
          font-family: Rajdhani, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
        }
        .aura-pip {
          width: 100%;
          text-align: center;
        }
        .aura-pip-orb {
          position: relative;
          isolation: isolate;
          display: grid;
          place-items: center;
          width: min(260px, 72vw);
          aspect-ratio: 1;
          margin: 0 auto 30px auto;
          overflow: hidden;
          border: 1px solid rgba(139, 92, 246, .6);
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 45%,
              rgba(75, 38, 150, .34),
              rgba(20, 15, 51, .65) 40%,
              rgba(7, 6, 19, .95) 75%);
          box-shadow:
            0 0 0 8px rgba(139, 92, 246, .025),
            0 0 0 18px rgba(139, 92, 246, .02),
            0 0 55px rgba(124, 58, 237, .2),
            inset 0 0 45px rgba(59, 130, 246, .09);
        }

        .aura-pip-orb::before {
          content: "";
          position: absolute;
          inset: 9%;
          border: 1px dashed rgba(167, 139, 250, .23);
          border-radius: 50%;
          animation: auraRotate 45s linear infinite;
        }

        .aura-pip-orb .aura-orb-grid {
          position: absolute;
          inset: 15%;
          border: 1px solid rgba(59, 130, 246, .18);
          border-radius: 50%;
          background: repeating-conic-gradient(
            from 0deg,
            rgba(139, 92, 246, .07) 0deg .5deg,
            transparent .5deg 18deg
          );
          mask-image: radial-gradient(circle, transparent 20%, black 100%);
          -webkit-mask-image: radial-gradient(circle, transparent 20%, black 100%);
        }

        .aura-pip-orb .aura-orb-ring {
          position: absolute;
          border: 1px solid rgba(139, 92, 246, .25);
          border-radius: 50%;
        }
        .aura-pip-orb .aura-orb-ring-one {
          inset: 22%;
          border-left-color: rgba(103, 232, 249, .65);
          border-right-color: rgba(167, 139, 250, .65);
          transform: rotate(-35deg);
          animation: auraRotate 12s linear infinite;
        }
        .aura-pip-orb .aura-orb-ring-two {
          inset: 29%;
          border-top-color: rgba(103, 232, 249, .6);
          border-bottom-color: rgba(232, 121, 249, .55);
          transform: rotate(40deg);
          animation: auraRotateReverse 16s linear infinite;
        }

        .aura-pip-orb .aura-core-logo {
          position: absolute;
          z-index: 2;
          width: 26%;
          height: 26%;
          object-fit: contain;
          opacity: .92;
          filter:
            drop-shadow(0 0 12px rgba(167, 139, 250, .65))
            drop-shadow(0 0 25px rgba(59, 130, 246, .32));
          pointer-events: none;
        }

        .aura-pip-orb canvas {
          position: absolute;
          inset: 0;
          z-index: 3;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        @keyframes auraRotate { to { transform: rotate(325deg); } }
        @keyframes auraRotateReverse { to { transform: rotate(-320deg); } }

        #auraPipStatus {
          margin: 0 0 16px;
          color: #b4a8d8;
          font-family: Orbitron, sans-serif;
          font-size: 10px;
          letter-spacing: .14em;
        }

        .aura-pip button {
          border: 1px solid rgba(196,181,253,.42);
          background: linear-gradient(110deg, #5b21b6, #4338ca 55%, #1d4ed8);
          color: white;
          border-radius: 11px;
          padding: 13px 26px;
          cursor: pointer;
          font-family: Orbitron, sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: .13em;
          box-shadow: 0 8px 28px rgba(91,33,182,.24), inset 0 1px rgba(255,255,255,.12);
          transition: filter 180ms ease, transform 180ms ease;
        }
        .aura-pip button:hover { filter: brightness(1.12); transform: translateY(-1px); }
      `;
      pipWindow.document.head.appendChild(style);

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

      const pipCanvas = pipWindow.document.getElementById(
        "auraPipCanvas"
      ) as HTMLCanvasElement;

      const stopAnimation = startAnimation(
        pipCanvas,
        pipAnimationRef,
        pipWindow
      );

      const pipStatus = pipWindow.document.getElementById("auraPipStatus");
      const pipMic = pipWindow.document.getElementById("auraPipMic");

      const updatePip = () => {
        if (pipStatus) {
          pipStatus.textContent = isListeningRef.current
            ? "LISTENING..."
            : "AURA IS READY";
        }

        if (pipMic) {
          pipMic.textContent = isListeningRef.current
            ? "STOP LISTENING"
            : "START VOICE COMMAND";
        }
      };

      updatePip();
      pipMic?.addEventListener("click", toggleMic);

      const syncInterval = window.setInterval(updatePip, 500);

      pipWindow.addEventListener(
        "pagehide",
        () => {
          window.clearInterval(syncInterval);
          stopAnimation();
          cancelAnimationFrame(pipAnimationRef.current);
          pipWindowRef.current = null;
          setPipOpen(false);
        },
        { once: true }
      );

      setPipOpen(true);
    } catch (error) {
      console.error("Aura Picture-in-Picture failed:", error);
      setStatusText("POP-OUT FAILED");
      setTranscriptText("Unable to open the floating Aura window.");
    }
  }, [startAnimation, toggleMic]);

  // ---------------------------------------------------------
  // NAVIGATION AND FILTERING
  // ---------------------------------------------------------

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
  };

  const clearHistory = () => {
    setHistory([]);
    setSearchQuery("");
  };

  const renderResult = () => {
    if (commandDetails.type === "video" &&
        Array.isArray(commandDetails.data)) {
      if (commandDetails.data.length === 0) {
        return <p className="aura-empty">No video results returned.</p>;
      }

      return commandDetails.data.map((video: any, index: number) => (
        <article className="aura-video" key={`${video.title}-${index}`}>
          {video.img ? (
            <img src={video.img} alt="" loading="lazy" />
          ) : (
            <div className="aura-video-placeholder">
              <FaPlay />
            </div>
          )}

          <div className="aura-video-info">
            <strong>{video.title || "Untitled video"}</strong>
            <span>VIDEO RESULT</span>
          </div>

          <button
            type="button"
            className="aura-icon-button"
            aria-label={`Search YouTube for ${video.title || "video"}`}
            onClick={() => {
              const query = video.query || video.title;
              if (query) {
                window.open(
                  `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
                  "_blank",
                  "noopener,noreferrer"
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
      <div className="aura-response">
        <div className="aura-response-label">
          <span className="aura-live-dot" />
          RESPONSE DATA
        </div>
        <p>{resultText || "No response data returned."}</p>
      </div>
    );
  };

  return (
    <div className={`aura-app ${lightMode ? "aura-light" : ""}`}>
      <div className="aura-scanlines" aria-hidden="true" />
      <div className="aura-ambient aura-ambient-one" aria-hidden="true" />
      <div className="aura-ambient aura-ambient-two" aria-hidden="true" />

      {/* HEADER */}
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
          <button
            type="button"
            className="aura-icon-button"
            title="Notifications"
            aria-label="Notifications"
            onClick={() => setShowNotifications((value) => !value)}
          >
            <FaRegBell />
          </button>

          <button
            type="button"
            className="aura-icon-button"
            title="Toggle appearance"
            aria-label="Toggle appearance"
            onClick={() => setLightMode((value) => !value)}
          >
            <FaRegMoon />
          </button>

          <button
            type="button"
            className="aura-icon-button"
            title="Open floating Aura"
            aria-label="Open floating Aura"
            onClick={handlePopOut}
          >
            <FaUpRightFromSquare />
          </button>
        </div>
      </header>

      {showNotifications && (
        <div className="aura-notification">
          <strong>System notifications</strong>
          <p>
            {pipOpen
              ? "Floating Aura window is open."
              : "No new notifications."}
          </p>
          <button
            type="button"
            onClick={() => setShowNotifications(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* MAIN COMMAND CENTER */}
      <main className="aura-dashboard">
        {/* LEFT: COMMAND ARCHIVE */}
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
            <span className="aura-shortcut">⌕</span>
          </button>

          {showSearch && (
            <input
              className="aura-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Filter your commands..."
              aria-label="Filter command history"
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
                    <strong>{item.command}</strong>
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
              <span className="aura-live-dot" />
              LOCAL SESSION
            </div>
            <button
              type="button"
              className="aura-clear-button"
              onClick={clearHistory}
              disabled={history.length === 0}
              title="Clear session history"
            >
              <FaTrash /> CLEAR
            </button>
          </div>
        </aside>

        {/* CENTER: NEURAL CORE */}
        <section className="aura-center">
          <div className="aura-center-topline">
            <span>NEURAL INTERFACE</span>
            <span className="aura-center-coordinates">CORE // 001</span>
          </div>

          <div
            className="aura-core-stage"
            ref={centerPlaceholderRef}
          >
            <div
              className="aura-core-content"
              ref={centerContentRef}
            >
              <div
                id="orbContainer"
                className={`aura-orb ${isListening ? "listening-active" : "orb-glow"}`}
              >
                <div className="aura-orb-grid" aria-hidden="true" />
                <div className="aura-orb-ring aura-orb-ring-one" />
                <div className="aura-orb-ring aura-orb-ring-two" />
                <img src={auraLogo} alt="" className="aura-core-logo" />
                <canvas
                  ref={canvasRef}
                  id="waveCanvas"
                  aria-hidden="true"
                />
                <span className="aura-orb-cross aura-orb-cross-one" />
                <span className="aura-orb-cross aura-orb-cross-two" />
              </div>

              <div className="aura-greeting">
                <span className="aura-eyebrow">
                  {isListening ? "AUDIO INPUT ACTIVE" : "AWAITING INPUT"}
                </span>
                <h2>
                  {isListening ? (
                    <>I'm <span>listening.</span></>
                  ) : (
                    <>Enter the <span>unknown.</span></>
                  )}
                </h2>
                <p id="transcriptText">{transcriptText}</p>
              </div>

              <div className="aura-status-line">
                <span className={`aura-status-indicator ${isListening ? "active" : ""}`} />
                <span id="statusText">{statusText}</span>
              </div>

              <button
                type="button"
                id="micBtn"
                className={`aura-mic-button ${isListening ? "is-listening" : ""}`}
                onClick={toggleMic}
                aria-label={isListening ? "Stop listening" : "Start voice command"}
                aria-pressed={isListening}
              >
                {isListening ? <FaStop /> : <FaMicrophone />}
                <span>{isListening ? "END SESSION" : "INITIATE VOICE"}</span>
              </button>

              <p className="aura-mic-hint">
                {isListening
                  ? "SPEAK CLEARLY · PRESS TO STOP"
                  : "CLICK TO TRANSMIT YOUR COMMAND"}
              </p>
            </div>
          </div>

          <nav className="aura-dock" aria-label="Main navigation">
            {[
              { id: "home", icon: <FaHouse />, label: "Core" },
              { id: "search", icon: <FaMagnifyingGlass />, label: "Search" },
              { id: "layers", icon: <FaLayerGroup />, label: "Systems" },
              { id: "archive", icon: <FaFolder />, label: "Archive" },
            ].map((item) => (
              <button
                type="button"
                key={item.id}
                className={activeNav === item.id ? "active" : ""}
                onClick={() => {
                  setActiveNav(item.id);

                  if (item.id === "home") {
                    setCommandDetails(INITIAL_DETAILS);
                  } else if (item.id === "search") {
                    setShowSearch(true);
                  } else if (item.id === "archive") {
                    setShowSearch(false);
                  } else {
                    setCommandDetails({
                      title: "System Overview",
                      category: "Aura Interface",
                      match: "ONLINE",
                      type: "text",
                      data: "Voice recognition, command processing, and the neural interface are available in this session.",
                    });
                  }

                  if (item.id === "archive" || item.id === "search") {
                    document.querySelector(".aura-sidebar")?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    });
                  }
                }}
                aria-label={item.label}
                title={item.label}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </section>

        {/* RIGHT: LIVE OUTPUT */}
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
            <span className="aura-category-tag">
              {commandDetails.category}
            </span>
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

          <div className="aura-output-content">
            {renderResult()}
          </div>

          <div className="aura-output-footer">
            <FaBolt />
            <span>AURA RESPONSE ENGINE</span>
            <span>READY</span>
          </div>

          <div className="aura-command-tip">
            <span className="aura-tip-symbol">i</span>
            <p>
              Speak a command to populate this panel with results from your
              existing command processor.
            </p>
          </div>
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