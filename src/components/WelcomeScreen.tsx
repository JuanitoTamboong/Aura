import React, { useEffect, useRef, useState } from "react";
import "../css/WelcomeScreen.css";
import auraLogo from "../assets/images/Aura-Logo-fix.webp";

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);
  const [greeting, setGreeting] = useState("");

  // Read the theme from local storage
  const [lightMode] = useState(() => {
    return localStorage.getItem("aura_light_mode") === "true";
  });

  const hasPlayedRef = useRef(false);

  // Use the built-in browser voice (no ElevenLabs)
  const playWelcomeVoice = () => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // Stop any existing audio
    try {
      window.speechSynthesis.cancel();
    } catch {}

    const text = "Welcome back, Sir.";

    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.85;
    utterance.rate = 0.95;

    const savedVoiceName = localStorage.getItem("aura_selected_voice");

    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();

      const chosenVoice =
        (savedVoiceName ? voices.find((v) => v.name === savedVoiceName) : null) ||
        voices.find((v) => v.name.includes("Google US English")) ||
        voices.find((v) => v.name.includes("David")) ||
        voices.find((v) => v.name.includes("Mark")) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];

      if (chosenVoice) utterance.voice = chosenVoice;
      window.speechSynthesis.speak(utterance);
    };

    // Voices load asynchronously on some browsers (especially mobile)
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
    playWelcomeVoice();

    const handleInteraction = () => {
      if (!hasPlayedRef.current) {
        playWelcomeVoice();
      }
    };

    window.addEventListener("click", handleInteraction);
    window.addEventListener("keydown", handleInteraction);
    window.addEventListener("touchstart", handleInteraction, { passive: true });

    const fullText = "WELCOME BACK, SIR";
    let i = 0;
    setGreeting("");

    const typing = window.setInterval(() => {
      if (i <= fullText.length) {
        setGreeting(fullText.slice(0, i));
        i++;
      } else {
        clearInterval(typing);
      }
    }, 60);

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
    <div className={`welcome-container ${lightMode ? "aura-light" : ""} ${isFading ? "fade-out" : ""}`}>
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