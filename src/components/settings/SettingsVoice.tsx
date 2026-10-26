import React from "react";
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["voice"];
  patch: (v: Partial<AuraSettings["voice"]>) => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  onVoiceChange: (name: string) => void;
  onTestVoice: (voiceName?: string) => void;
}

const SettingsVoice: React.FC<Props> = ({
  settings, patch, availableVoices, selectedVoiceName, onVoiceChange, onTestVoice,
}) => (
  <>
    <div className="aura-settings-section">
      <h3>Voice Selection</h3>
      <p className="aura-settings-section-desc">Pick the voice Aura uses to speak.</p>
      <div className="aura-settings-row">
        <span className="aura-settings-row-label">Browser voice</span>
        <select className="aura-settings-select" value={selectedVoiceName} onChange={(e) => onVoiceChange(e.target.value)}>
          <option value="">Browser Default</option>
          {availableVoices.map((v) => (
            <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
          ))}
        </select>
      </div>
      <div className="aura-settings-row">
        <span />
        <button className="aura-settings-btn" onClick={() => onTestVoice()}>Test Voice</button>
      </div>
    </div>

    <div className="aura-settings-section">
      <h3>Speech Tuning</h3>
      {[
        { label: "Rate", key: "rate", min: 0.5, max: 1.5, step: 0.05 },
        { label: "Pitch", key: "pitch", min: 0.5, max: 1.5, step: 0.05 },
        { label: "Volume", key: "volume", min: 0, max: 1, step: 0.05 },
      ].map((s) => (
        <div key={s.key} className="aura-settings-row">
          <span className="aura-settings-row-label">{s.label}: {(settings as any)[s.key].toFixed(2)}</span>
          <input type="range" className="aura-settings-range" min={s.min} max={s.max} step={s.step} 
                 value={(settings as any)[s.key]} onChange={(e) => patch({ [s.key]: Number(e.target.value) })} />
        </div>
      ))}
      <div className="aura-settings-row">
        <span />
        <button className="aura-settings-btn" onClick={() => onTestVoice()}>Preview</button>
      </div>
    </div>

    <div className="aura-settings-section">
      <h3>Mute & Wake Word</h3>
      <div className="aura-settings-row">
        <div>
          <div className="aura-settings-row-label">Mute spoken responses</div>
          <div className="aura-settings-row-hint">Aura will still show text replies.</div>
        </div>
        <button className={`aura-toggle ${settings.muteAura ? "is-on" : ""}`} onClick={() => patch({ muteAura: !settings.muteAura })} />
      </div>
      <div className="aura-settings-row">
        <div>
          <div className="aura-settings-row-label">Wake word</div>
          <div className="aura-settings-row-hint">Say "Hey {settings.wakeWord}" to wake.</div>
        </div>
        <input className="aura-settings-input" value={settings.wakeWord} 
               onChange={(e) => patch({ wakeWord: e.target.value.replace(/[^a-zA-Z ]/g, "").slice(0, 20) })} />
      </div>
    </div>
  </>
);

export default SettingsVoice;