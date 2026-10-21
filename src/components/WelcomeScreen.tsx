import React, { useEffect, useRef, useState } from "react";
import "../css/WelcomeScreen.css";
import auraLogo from "../assets/images/Aura-Logo.png";

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);
  const [greeting, setGreeting] = useState("");

  const hasPlayedRef = useRef(false);

  // --- SPEAK "WELCOME BACK, MASTER" ---
  const playWelcomeVoice = () => {
    if (hasPlayedRef.current) return;
    if (!("speechSynthesis" in window)) return;

    hasPlayedRef.current = true;
    
    // Clear any leftover audio from the Splash screen
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance("Welcome back, Master.");
    
    // Monster voice — same settings as Aura core
    utterance.pitch = 0.6;
    utterance.rate = 0.85;

    // Voice loading is async. We check if voices are ready, if not, we wait.
    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const chosenVoice =
        voices.find((v) => v.name.includes("David")) ||
        voices.find((v) => v.lang.includes("en"));

      if (chosenVoice) utterance.voice = chosenVoice;

      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    } else {
      setVoiceAndSpeak();
    }
  };

  useEffect(() => {
    // 1. Try to play immediately
    playWelcomeVoice();

    // 2. Fallback: If the browser blocked autoplay, play on first interaction.
    // Added "touchstart" specifically for mobile devices.
    const handleInteraction = () => {
      if (!hasPlayedRef.current) {
        playWelcomeVoice();
      }
    };
    
    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("touchstart", handleInteraction, { passive: true });

    // 3. Typing Animation
    const fullText = "WELCOME BACK, MASTER";
    let i = 0;
    
    // Clear the greeting on mount to prevent StrictMode duplication issues
    setGreeting("");

    const typing = window.setInterval(() => {
      if (i <= fullText.length) {
        setGreeting(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(typing);
      }
    }, 60);

    // 4. Timers for fade and completion
    const fadeTimer = window.setTimeout(() => setIsFading(true), 2600);
    const completeTimer = window.setTimeout(() => onComplete(), 3200);

    return () => {
      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
      clearInterval(typing);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`welcome-container ${isFading ? "fade-out" : ""}`}>
      <div className="welcome-scanlines" />

      <div className="welcome-content">
        <div className="welcome-logo-wrapper">
          <div className="welcome-ring welcome-ring-outer" />
          <div className="welcome-ring welcome-ring-inner" />
          <img src={auraLogo} alt="Aura Logo" className="welcome-logo" />
        </div>

        <p className="welcome-greeting">
          {greeting}
          <span className="welcome-cursor">_</span>
        </p>

        <p className="welcome-subtext">
          NEURAL LINK ESTABLISHED · ALL SYSTEMS NOMINAL
        </p>

        <div className="welcome-progress">
          <div className="welcome-progress-bar" />
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;