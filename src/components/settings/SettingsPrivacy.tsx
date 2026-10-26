import React from "react";
import { getStorageSummary } from "../../settings/AuraSettingsStore";
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["privacy"];
  patch: (v: Partial<AuraSettings["privacy"]>) => void;
  onFactoryReset: () => void;
}

const SettingsPrivacy: React.FC<Props> = ({ settings, patch, onFactoryReset }) => {
  const summary = getStorageSummary();
  return (
    <>
      <div className="aura-settings-section">
        <h3>Storage Options</h3>
        {[
          { key: "persistHistory", label: "Persist command archive" },
          { key: "persistWorkspace", label: "Persist workspace messages" },
          { key: "persistConversation", label: "Persist conversation memory" },
          { key: "telemetry", label: "Share anonymous usage data" },
        ].map((row) => (
          <div key={row.key} className="aura-settings-row">
            <span className="aura-settings-row-label">{row.label}</span>
            <button className={`aura-toggle ${(settings as any)[row.key] ? "is-on" : ""}`} onClick={() => patch({ [row.key]: !(settings as any)[row.key] } as any)} />
          </div>
        ))}
      </div>
      <div className="aura-settings-section">
        <h3>Storage Usage</h3>
        <table className="aura-storage-table">
          <tbody>
            {summary.map((row) => (
              <tr key={row.key}><td>{row.key}</td><td style={{ textAlign: "right" }}>{(row.size / 1024).toFixed(1)} KB</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="aura-settings-section">
        <h3 style={{ color: "#f87171" }}>Danger Zone</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Factory reset</span>
          <button className="aura-settings-btn danger" onClick={onFactoryReset}>Reset</button>
        </div>
      </div>
    </>
  );
};

export default SettingsPrivacy;