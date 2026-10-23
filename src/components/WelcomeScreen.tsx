import React, { useEffect, useRef, useState } from "react";
import "../css/WelcomeScreen.css";
import auraLogo from "../assets/images/Aura-Logo.png";

interface WelcomeScreenProps {
  onComplete: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);
  const [greeting, setGreeting] = useState("");
  
  // ★ NEW: Read the theme from local storage
  const [lightMode] = useState(() => {
    return localStorage.getItem("aura_light_mode") === "true";
  });

  const hasPlayedRef = useRef(false);

  // ★ UPDATED: Use ElevenLabs Premium Voice with Browser Fallback
  const playWelcomeVoice = async () => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // Stop any existing audio
    window.speechSynthesis.cancel();
    
    const text = "Welcome back, Sir.";
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    const voiceId = import.meta.env.VITE_ELEVENLABS_VOICE_ID;

    // Try ElevenLabs First
    if (apiKey && voiceId) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: "POST",
            headers: {
              "Accept": "audio/mpeg",
              "Content-Type": "application/json",
              "xi-api-key": apiKey,
            },
            body: JSON.stringify({
              text: text,
              model_id: "eleven_multilingual_v2", 
              voice_settings: {
                stability: 0.35,
                similarity_boost: 0.75,
                style: 0.0,
                use_speaker_boost: true
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`ElevenLabs API failed with status: ${response.status}`);
        }

        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        await audio.play();
        
        // Clean up memory when done
        audio.onended = () => URL.revokeObjectURL(audioUrl);
        return; // Exit here if successful

      } catch (error) {
        console.warn("Welcome voice ElevenLabs failed, using browser fallback:", error);
      }
    }

    // FALLBACK: Built-in Browser TTS (only runs if ElevenLabs fails)
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 0.85; // Adjusted to match Aura
      utterance.rate = 0.95;

      const savedVoiceName = localStorage.getItem("aura_selected_voice");

      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        
        const chosenVoice = 
          (savedVoiceName ? voices.find(v => v.name === savedVoiceName) : null) ||
          voices.find((v) => v.name.includes("David")) ||
          voices.find((v) => v.name.includes("Mark")) ||
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

  // ★ NEW: Added conditional class here
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