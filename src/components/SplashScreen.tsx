import React, { useEffect, useState } from "react";
import "../css/SplashScreen.css";
import auraLogo from "../assets/images/Aura-Logo.png";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [bootText, setBootText] = useState("INITIALIZING CORE...");
  const [isFading, setIsFading] = useState(false);
  
  // ★ NEW: Read the theme from local storage
  const [lightMode] = useState(() => {
    return localStorage.getItem("aura_light_mode") === "true";
  });

  // --- 1. THE SOUND ENGINE ---
  const playBootSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
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
    }, 600);

    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2500);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3100);

    return () => {
      clearInterval(textInterval);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [onComplete]);

  // ★ NEW: Added conditional class here
  return (
    <div className={`splash-container ${lightMode ? "aura-light" : ""} ${isFading ? "fade-out" : ""}`}>
      <div className="splash-scanlines" />
      
      <div className="splash-content">
        <div className="splash-logo-wrapper">
          <div className="splash-ring splash-ring-outer" />
          <div className="splash-ring splash-ring-inner" />
          <img src={auraLogo} alt="Aura Logo" className="splash-logo" />
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