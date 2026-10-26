// src/components/settings/SettingsAppearance.tsx
import React from "react";
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["appearance"];
  patch: (v: Partial<AuraSettings["appearance"]>) => void;
}

const SettingsAppearance: React.FC<Props> = ({ settings, patch }) => {
  const ACCENTS = ["violet", "cyan", "pink", "amber", "emerald"];
  const COLORS: Record<string, string> = { 
    violet: "#8b5cf6", cyan: "#22d3ee", pink: "#ec4899", amber: "#f59e0b", emerald: "#10b981" 
  };

  return (
    <>
      <div className="aura-settings-section">
        <h3>Theme</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Dark mode</span>
          <button className={`aura-toggle ${!settings.lightMode ? "is-on" : ""}`} onClick={() => patch({ lightMode: !settings.lightMode })} />
        </div>
      </div>
      <div className="aura-settings-section">
        <h3>Accent Color</h3>
        <div className="aura-settings-row">
          <div className="aura-swatch-row">
            {ACCENTS.map((a) => (
              <button 
                key={a} 
                className={`aura-swatch ${settings.accent === a ? "is-active" : ""}`} 
                style={{ background: COLORS[a] }} 
                onClick={() => patch({ accent: a as any })} 
              />
            ))}
            <div style={{ position: 'relative' }}>
              <input 
                type="color" 
                className="aura-swatch" 
                style={{ padding: 0, border: "2px dashed rgba(139,92,246,0.4)", background: "transparent" }}
                value={settings.customAccent} 
                onChange={(e) => patch({ accent: "custom", customAccent: e.target.value })} 
              />
            </div>
          </div>
        </div>
      </div>
      <div className="aura-settings-section">
        <h3>Motion & Effects</h3>
        {[
          { key: "reduceMotion", label: "Reduce motion" },
          { key: "showScanlines", label: "Show scanlines" },
          { key: "showParticles", label: "Show orb particles" },
          { key: "compactMode", label: "Compact mode" },
        ].map((row) => (
          <div key={row.key} className="aura-settings-row">
            <span className="aura-settings-row-label">{row.label}</span>
            <button className={`aura-toggle ${(settings as any)[row.key] ? "is-on" : ""}`} onClick={() => patch({ [row.key]: !(settings as any)[row.key] } as any)} />
          </div>
        ))}
      </div>
    </>
  );
};

export default SettingsAppearance;