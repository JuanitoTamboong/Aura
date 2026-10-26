// src/components/settings/SettingsAdvanced.tsx
import React from "react";
// ✅ Fixed: FaCheckCircle is now FaCircleCheck in FA6
import { FaCircleCheck, FaCircleXmark } from "react-icons/fa6"; 
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["advanced"];
  patch: (v: Partial<AuraSettings["advanced"]>) => void;
  onResetAll: () => void;
}

const SettingsAdvanced: React.FC<Props> = ({ settings, patch, onResetAll }) => {
  const isSpeechSupported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;

  return (
    <>
      <div className="aura-settings-section">
        <h3>Diagnostics</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Network</span>
          <span style={{ fontSize: 12, color: navigator.onLine ? "#10b981" : "#f87171", display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: 16 }}>●</span> {navigator.onLine ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Speech Recognition API</span>
          <span style={{ fontSize: 16, color: isSpeechSupported ? "#10b981" : "#f87171" }}>
            {/* ✅ Swapped to the correctly named component */}
            {isSpeechSupported ? <FaCircleCheck /> : <FaCircleXmark />} 
          </span>
        </div>
      </div>
      
      <div className="aura-settings-section">
        <h3>Advanced AI</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Max Tokens</span>
          <input 
            type="number" 
            className="aura-settings-input" 
            value={settings.maxTokens} 
            onChange={(e) => patch({ maxTokens: Number(e.target.value) })} 
          />
        </div>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Debug Mode</span>
          <button 
            className={`aura-toggle ${settings.debugMode ? "is-on" : ""}`} 
            onClick={() => patch({ debugMode: !settings.debugMode })} 
          />
        </div>
      </div>

      <div className="aura-settings-section">
        <h3>Reset</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Reset settings to default</span>
          <button className="aura-settings-btn danger" onClick={onResetAll}>Reset</button>
        </div>
      </div>
    </>
  );
};

export default SettingsAdvanced;