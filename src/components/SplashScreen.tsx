import React, { useEffect, useState } from "react";
import "../css/SplashScreen.css";
import auraLogo from "../assets/images/Aura-Logo-fix.webp";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [bootText, setBootText] = useState("INITIALIZING CORE...");
  const [isFading, setIsFading] = useState(false);
  
  const [lightMode] = useState(() => {
    return localStorage.getItem("aura_light_mode") === "true";
  });

  // THE SOUND ENGINE
  const playBootSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      
      // Resume context if browser suspended it due to autoplay policies
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sawtooth";
      
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 2);

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.05, now + 0.5);
      oscGain.gain.setValueAtTime(0.05, now + 1.8);
      oscGain.gain.linearRampToValueAtTime(0, now + 2);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2);

      const pingOsc = ctx.createOscillator();
      const pingGain = ctx.createGain();
      pingOsc.type = "sine";
      pingOsc.frequency.setValueAtTime(880, now + 2);
      
      pingGain.gain.setValueAtTime(0, now + 2);
      pingGain.gain.linearRampToValueAtTime(0.1, now + 2.05);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      pingOsc.connect(pingGain);
      pingGain.connect(ctx.destination);
      pingOsc.start(now + 2);
      pingOsc.stop(now + 2.5);
      
    } catch (e) {
      console.log("Audio context not allowed yet", e);
    }
  };

  useEffect(() => {
    // Only attempt to play if user has interacted previously, or wait for click
    playBootSound();

    const handleInteraction = () => {
      playBootSound();
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);

    const messages = [
      "LOADING NEURAL MODULES...",
      "ESTABLISHING SECURE CONNECTION...",
      "CALIBRATING VOICE ENGINE...",
      "SYSTEM ONLINE.",
    ];

    let currentIndex = 0;
    const textInterval = setInterval(() => {
      if (currentIndex < messages.length) {
        setBootText(messages[currentIndex]);
        currentIndex++;
      }
    }, 300); // Sped up text interval to match shorter timer

    // REDUCED TIMERS TO FIX LCP (Largest Contentful Paint)
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 1000); // Was 2500ms

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 1500); // Was 3100ms

    return () => {
      clearInterval(textInterval);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [onComplete]);

  return (
    <div className={`splash-container ${lightMode ? "aura-light" : ""} ${isFading ? "fade-out" : ""}`}>
      <div className="splash-scanlines" />
      
      <div className="splash-content">
        <div className="splash-logo-wrapper">
          <div className="splash-ring splash-ring-outer" />
          <div className="splash-ring splash-ring-inner" />
          {/* Added fetchPriority and eager loading for LCP */}
          <img src={auraLogo} alt="Aura Logo" className="splash-logo" fetchPriority="high" loading="eager" />
        </div>

        <h1 className="splash-title">AURA / AI</h1>
        <div className="splash-boot-text">
          <span className="splash-dot" />
          {bootText}
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;