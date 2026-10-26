// src/components/settings/SettingsAbout.tsx
import React from "react";
import auraLogo from "../../assets/images/Aura-Logo-fix.webp";

const SettingsAbout: React.FC = () => (
  <div 
    className="aura-about-card" 
    style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center",
      textAlign: "center",
      padding: "40px 20px",
      minHeight: "400px"
    }}
  >
    <img src={auraLogo} alt="Aura" className="aura-about-logo" style={{ display: "block" }} />
    
    <h3 className="aura-about-title">AURA AI</h3>
    <p className="aura-about-version">Version 3.2.0</p>
    
    <p className="aura-about-desc" style={{ marginBottom: "30px" }}>
      Aura is a voice-first AI assistant that runs entirely in your browser.
      It listens, remembers, and helps you get things done — from setting alarms
      to searching your files and answering questions.
    </p>

    {/* ✅ Added Developer Section */}
    <div 
      style={{ 
        marginTop: "auto", 
        paddingTop: "20px", 
        borderTop: "1px solid rgba(139, 92, 246, 0.2)",
        width: "100%",
        maxWidth: "400px"
      }}
    >
      <h4 
        style={{ 
          fontSize: "11px", 
          letterSpacing: "0.1em", 
          color: "var(--aura-violet, #8b5cf6)", 
          margin: "0 0 8px 0",
          textTransform: "uppercase",
          fontFamily: "var(--aura-display, Orbitron, sans-serif)"
        }}
      >
        Developer
      </h4>
      <p 
        style={{ 
          fontSize: "13px", 
          margin: 0, 
          opacity: 0.8,
          fontWeight: 600,
          color: "inherit"
        }}
      >
        Juanito Tamboong
      </p>
      <p 
        style={{ 
          fontSize: "11px", 
          margin: "4px 0 0 0", 
          opacity: 0.6,
          fontFamily: "monospace"
        }}
      >
        AI Engineer & Full-Stack Developer
      </p>
    </div>
  </div>
);

export default SettingsAbout;