import React from "react";
import auraLogo from "../../assets/images/Aura-Logo-fix.webp";

const SettingsAbout: React.FC = () => (
  <div className="aura-about-card">
    <img src={auraLogo} alt="Aura" className="aura-about-logo" />
    <h3 className="aura-about-title">AURA AI</h3>
    <p className="aura-about-version">Version 3.2.0</p>
    <p className="aura-about-desc">
      Aura is a voice-first AI assistant that runs entirely in your browser.
      It listens, remembers, and helps you get things done — from setting alarms
      to searching your files and answering questions.
    </p>
  </div>
);

export default SettingsAbout;