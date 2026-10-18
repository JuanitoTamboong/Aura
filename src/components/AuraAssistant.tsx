import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FaUpRightFromSquare, FaStar, 
  FaClockRotateLeft, FaArrowDown, FaMicrophone, 
  FaHouse, FaMagnifyingGlass, FaLayerGroup, FaFolder,
  FaLocationDot, FaPlay 
} from 'react-icons/fa6';
import { FaRegBell, FaRegMoon } from 'react-icons/fa'; 

import '../css/AuraAssistant.css';
import auraLogo from '../assets/images/Aura-Logo.png';
import auraDatabase from '../database/aura.json';
import { processCommand } from '../command/AuraCommand';

const initialHistory = [
  { title: "WEATHER", percentage: 62 },
  { title: "MEDICAL EQUIPMENT", percentage: 48 },
  { title: "TRAFFIC SIGNALS", percentage: 84 },
  { title: "DATA RECOGNITION", percentage: 56 },
  { title: "ALARM", percentage: 39 },
  { title: "FACTS", percentage: 72 },
  { title: "MOVIES", percentage: 45 },
  { title: "CARTOONS", percentage: 88 },
];

interface CommandDetails {
  title: string;
  category: string;
  match: string;
  type: string;
  data: any;
}

const AuraAssistant: React.FC = () => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>("Aura Ready");
  const [transcriptText, setTranscriptText] = useState<string>('"What\'s the price of hoverboard..."');
  const [commandDetails, setCommandDetails] = useState<CommandDetails>({
    title: "Hover Board",
    category: "Personal Transporter",
    match: "92.8%",
    type: "text",
    data: "Awaiting your command..."
  });
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  
  const centerContentRef = useRef<HTMLDivElement | null>(null);
  const centerPlaceholderRef = useRef<HTMLDivElement | null>(null);
  
  const mainAnimationRef = useRef<number>(0);
  const pipAnimationRef = useRef<number>(0);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // --- 1. Particle Wave Animation ---
  const startAnimation = useCallback((canvas: HTMLCanvasElement, animRef: React.MutableRefObject<number>, win: any = window) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let wavePhase = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    win.addEventListener('resize', resize);
    resize();

    const drawParticleWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const particleCount = 180;
      const radius = Math.min(canvas.width, canvas.height) * 0.3; 

      wavePhase += isListeningRef.current ? 0.08 : 0.02;

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const amp = isListeningRef.current ? 25 : 8;
        const waveOffset = Math.sin(angle * 6 + wavePhase) * Math.cos(angle * 4 + wavePhase) * amp;
        
        const r = radius + waveOffset;
        const x = centerX + r * Math.cos(angle);
        const y = centerY + r * Math.sin(angle);

        const size = isListeningRef.current ? Math.random() * 2.5 + 1 : 1.5;
        const colorRatio = i / particleCount;
        
        ctx.fillStyle = colorRatio > 0.5 
          ? `rgba(0, 240, 255, ${0.4 + Math.random() * 0.4})` 
          : `rgba(168, 85, 247, ${0.4 + Math.random() * 0.4})`;

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      animRef.current = requestAnimationFrame(drawParticleWave);
    };

    drawParticleWave();

    return () => {
      cancelAnimationFrame(animRef.current);
      win.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      return startAnimation(canvas, mainAnimationRef, window);
    }
  }, [startAnimation]);

  // --- 2. Text to Speech ---
  const auraSpeak = useCallback((text: string) => {
    if (!text || text.trim() === "") return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.1;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // --- 3. Speech Recognition ---
  const setupSpeechRecognition = useCallback((win: any = window) => {
    if ('webkitSpeechRecognition' in win || 'SpeechRecognition' in win) {
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // KEEPS LISTENING CONTINUOUSLY
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setTranscriptText(`"${transcript}"`);

        if (event.results[current].isFinal) {
          processCommand({
            cmd: transcript,
            auraDatabase: auraDatabase,
            setStatusText: setStatusText,
            setTranscriptText: setTranscriptText,
            setCommandDetails: setCommandDetails,
            auraSpeak: auraSpeak,
            stopMic: () => {
              setIsListening(false);
              isListeningRef.current = false;
              try { recognitionRef.current?.stop(); } catch(e){}
              setStatusText("Aura Ready");
            }
          });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech Recognition Error Details:", event.error);

        // Ignore 'no-speech' so it doesn't turn off while waiting for you to talk
        if (event.error === 'no-speech') return; 

        setIsListening(false);
        isListeningRef.current = false;

        if (event.error === 'network') {
          setStatusText("Network Error");
          setTranscriptText('"Voice recognition requires an internet connection."');
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setStatusText("Mic Blocked");
          setTranscriptText('"Please allow microphone access."');
        } else if (event.error === 'aborted' || event.error === 'audio-capture') {
          setStatusText("Aura Ready");
        } else {
          setStatusText("Aura Ready");
          setTranscriptText('"Voice input failed. Try again."');
        }

        setTimeout(() => {
          setStatusText("Aura Ready");
          setTranscriptText('"What\'s the price of hoverboard..."');
        }, 4000);
      };

      recognitionRef.current.onend = () => {
        // If the browser auto-stops but we haven't clicked "stop", instantly restart it
        if (isListeningRef.current) {
          try { recognitionRef.current.start(); } catch(e) {}
        } else {
          setStatusText((prev) => prev === "Listening..." ? "Aura Ready" : prev);
        }
      };
    }
  }, [auraSpeak]);

  useEffect(() => {
    setupSpeechRecognition(window);
  }, [setupSpeechRecognition]);

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return alert("Speech recognition not supported.");

    if (isListeningRef.current) {
      // Manually clicking the button to turn it OFF
      try { recognitionRef.current.stop(); } catch(e){}
      setIsListening(false);
      isListeningRef.current = false;
      setStatusText("Aura Ready");
    } else {
      // Manually clicking the button to turn it ON
      try {
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
        setStatusText("Listening...");
        setTranscriptText('"..."');
      } catch(e) {
        console.error(e);
        setStatusText("Aura Ready");
      }
    }
  }, []);

  // --- 4. Picture-in-Picture Logic ---
  const handlePopOut = async () => {
    try {
      if ('documentPictureInPicture' in window) {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 400,
          height: 550,
        });

        cancelAnimationFrame(mainAnimationRef.current);
        
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch(e){}
          setIsListening(false);
          isListeningRef.current = false;
          setStatusText("Aura Ready");
        }

        // Copy styles
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWindow.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href as string;
            pipWindow.document.head.appendChild(link);
          }
        });

        // Move UI
        const centerContent = centerContentRef.current;
        if (centerContent) {
          pipWindow.document.body.appendChild(centerContent);
          pipWindow.document.body.style.backgroundColor = '#05060f';
          pipWindow.document.body.style.display = 'flex';
          pipWindow.document.body.style.justifyContent = 'center';
          pipWindow.document.body.style.alignItems = 'center';
          pipWindow.document.body.style.height = '100vh';
          pipWindow.document.body.style.margin = '0';
        }

        setTimeout(() => {
          const newCanvas = pipWindow.document.getElementById('waveCanvas');
          if (newCanvas) {
            startAnimation(newCanvas, pipAnimationRef, pipWindow);
          }
        }, 100);

        setupSpeechRecognition(pipWindow);

        const newMicBtn = pipWindow.document.getElementById('micBtn');
        if (newMicBtn) {
          newMicBtn.addEventListener('click', toggleMic);
        }

        pipWindow.addEventListener('pagehide', () => {
          cancelAnimationFrame(pipAnimationRef.current);
          
          if (newMicBtn) {
             newMicBtn.removeEventListener('click', toggleMic);
          }

          const originalContainer = centerPlaceholderRef.current;
          if (centerContent && originalContainer) {
            originalContainer.appendChild(centerContent);
          }

          setupSpeechRecognition(window);
          
          setTimeout(() => {
            const mainCanvas = canvasRef.current;
            if (mainCanvas) {
              startAnimation(mainCanvas, mainAnimationRef, window);
            }
          }, 100);
        });

      } else {
        alert("Your browser doesn't support Picture-in-Picture.");
      }
    } catch (error) {
      console.error("PiP Error:", error);
    }
  };

  return (
    <div className="h-screen flex flex-col justify-between p-4 md:p-6 overflow-hidden select-none bg-darkBg font-rajdhani text-white">
      
      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-3 glass-card rounded-2xl mb-4">
        <div className="flex items-center gap-3">
          <img src={auraLogo} alt="Aura Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]" />
          <h1 className="font-orbitron font-bold text-xl tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-cyan-400">
            Aura AI
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" alt="Avatar" className="w-7 h-7 rounded-full object-cover ring-2 ring-cyan-500/50" />
            <span className="text-sm font-semibold text-slate-200 tracking-wide">Juanito Tamboong</span>
          </div>

          <div className="flex items-center gap-5 text-slate-400">
            <button className="hover:text-cyan-400 transition-colors relative flex items-center justify-center" title="Notifications">
              <FaRegBell className="text-xl" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping"></span>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[#111328]"></span>
            </button>

            <button className="hover:text-cyan-400 transition-colors flex items-center justify-center" title="Night Mode">
              <FaRegMoon className="text-xl" />
            </button>

            <button 
              className="hover:text-cyan-400 transition-colors flex items-center justify-center" 
              title="Pop out Aura"
              onClick={handlePopOut}
            >
              <FaUpRightFromSquare className="text-lg" />
            </button>

            <div className="flex items-center gap-1.5 bg-[#2d1b00] border border-amber-500/40 px-3 py-1.5 rounded-lg text-amber-400 text-xs font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <FaStar className="text-amber-400 text-sm" /> Premium
            </div>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
        
        {/* LEFT PANEL */}
        <section className="col-span-3 glass-card rounded-2xl p-5 flex flex-col justify-between overflow-hidden">
          <div>
            <h2 className="font-orbitron font-semibold text-slate-300 text-sm tracking-wider uppercase mb-4 flex items-center justify-between">
              <span>Previous Search History</span>
              <FaClockRotateLeft className="text-xs text-cyan-400" />
            </h2>
            <div className="grid grid-cols-2 gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
              {initialHistory.map((item, index) => (
                <div key={index} className="history-card flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-300 tracking-wider">{item.title}</span>
                  <div>
                    <span className="text-xs text-slate-400">{item.percentage}%</span>
                    <div className="progress-bg">
                      <div className="progress-fill" style={{ width: `${item.percentage}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-center pt-2">
            <button className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 flex items-center justify-center transition-all border border-slate-700">
              <FaArrowDown className="text-xs" />
            </button>
          </div>
        </section>

        {/* CENTER PANEL */}
        <section className="col-span-6 flex flex-col items-center justify-center relative px-4">
          
          <div ref={centerPlaceholderRef} className="flex flex-col items-center justify-center w-full h-full">
            
            <div ref={centerContentRef} className="relative flex flex-col items-center justify-center w-full">
              
              <div id="orbContainer" className={`w-80 h-80 rounded-full glass-card border flex items-center justify-center relative overflow-hidden transition-all duration-500 ${isListening ? 'listening-active' : 'orb-glow'}`}>
                <img src={auraLogo} alt="Core" className="absolute w-32 h-32 object-contain opacity-80 z-0 pointer-events-none drop-shadow-[0_0_20px_rgba(0,240,255,0.8)]" />
                <canvas ref={canvasRef} id="waveCanvas" className="w-full h-full absolute inset-0 z-10 pointer-events-none"></canvas>
              </div>

              <div className="mt-8 text-center min-h-[3rem] px-6">
                <p className="text-slate-400 font-medium text-lg italic tracking-wide transition-opacity">
                  {transcriptText}
                </p>
                <p className={`font-orbitron text-2xl font-bold tracking-widest mt-2 uppercase ${isListening ? 'text-cyan-400' : 'text-slate-100'}`}>
                  {statusText}
                </p>
              </div>
              
              <button 
                id="micBtn"
                onClick={toggleMic}
                className={`mt-5 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-purple-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/40 hover:scale-105 active:scale-95 transition-all ${isListening ? 'ring-4 ring-cyan-400/50' : ''}`}
              >
                <FaMicrophone className="text-xl" />
              </button>

            </div>
          </div>

          <nav className="absolute bottom-2 flex items-center gap-6 bg-slate-900/90 border border-slate-800 backdrop-blur-xl px-8 py-3 rounded-2xl shadow-2xl">
            <button className="text-cyan-400 hover:scale-110 transition-transform"><FaHouse className="text-lg" /></button>
            <button className="text-slate-500 hover:text-cyan-400 hover:scale-110 transition-all"><FaMagnifyingGlass className="text-lg" /></button>
            <button className="text-slate-500 hover:text-cyan-400 hover:scale-110 transition-all"><FaLayerGroup className="text-lg" /></button>
            <button className="text-slate-500 hover:text-cyan-400 hover:scale-110 transition-all"><FaFolder className="text-lg" /></button>
          </nav>
        </section>

        {/* RIGHT PANEL (Dynamic) */}
        <section className="col-span-3 glass-card rounded-2xl p-5 flex flex-col justify-between overflow-y-auto">
          <div>
            <h2 className="font-orbitron font-semibold text-slate-300 text-sm tracking-wider uppercase mb-4 flex items-center justify-between">
              <span>Searched By Command</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h2>
            <div className="space-y-3 mb-6">
              <div>
                <span className="text-xs text-textMuted uppercase font-bold tracking-wider">Title</span>
                <p className="text-base font-semibold text-slate-200 line-clamp-1">{commandDetails.title}</p>
              </div>
              <div>
                <span className="text-xs text-textMuted uppercase font-bold tracking-wider">Category</span>
                <p className="text-sm text-cyan-400 font-medium">{commandDetails.category}</p>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-textMuted uppercase font-bold tracking-wider">Search Results</span>
                  <span className="text-sm font-bold font-orbitron text-cyan-400">{commandDetails.match}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
                  <button className="hover:text-cyan-400 transition-colors">View All</button>
                  <button className="hover:text-cyan-400 transition-colors">View Top Results</button>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <span className="text-xs text-textMuted uppercase font-bold tracking-wider block mb-3">Results</span>
              <div className="space-y-3" id="videoResultsList">
                {/* Conditional rendering for Video vs Text */}
                {commandDetails.type === "video" && Array.isArray(commandDetails.data) ? (
                   commandDetails.data.map((vid: any, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-3">
                        <img src={vid.img} alt={vid.title} className="w-12 h-10 rounded-lg object-cover" />
                        <div>
                          <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">{vid.title}</h4>
                          <span className="text-[10px] text-textMuted uppercase tracking-wider font-bold">YOUTUBE</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(vid.query)}`, '_blank')}
                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-cyan-500 text-slate-300 hover:text-slate-950 flex items-center justify-center transition-all"
                      >
                        <FaPlay className="text-xs ml-0.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-800/80 border border-cyan-500/30 p-4 rounded-xl rounded-tl-none shadow-[0_0_15px_rgba(0,240,255,0.1)] relative mt-2">
                    <div className="absolute -left-2 top-0 w-3 h-3 bg-slate-800/80 border-l border-t border-cyan-500/30 transform rotate-45"></div>
                    <p className="text-sm text-slate-100 leading-relaxed font-rajdhani">
                      {commandDetails.data}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs text-textMuted uppercase font-bold tracking-wider block mb-2">Nearest Stores</span>
              <div className="h-28 rounded-xl relative overflow-hidden border border-slate-800 bg-slate-950 map-grid flex items-center justify-center group cursor-pointer">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
                <img src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=400&q=80" alt="Map Preview" className="w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs">
                  <span className="text-slate-200 font-medium"><FaLocationDot className="text-cyan-400 mr-1 inline" /> Tech Hub Retail</span>
                  <span className="text-cyan-400 font-bold">1.2 km</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AuraAssistant;