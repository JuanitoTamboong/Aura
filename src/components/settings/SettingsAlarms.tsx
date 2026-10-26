import React from "react";
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["alarms"];
  patch: (v: Partial<AuraSettings["alarms"]>) => void;
  pendingAlarms: any[];
  onCancelAlarm: (id: string) => void;
}

const SettingsAlarms: React.FC<Props> = ({ settings, patch, pendingAlarms, onCancelAlarm }) => (
  <>
    <div className="aura-settings-section">
      <h3>Pending Alarms</h3>
      {pendingAlarms.length === 0 ? <p style={{ fontSize: 12, opacity: 0.5 }}>No alarms scheduled.</p> : 
        pendingAlarms.map((alarm: any) => (
          <div key={alarm.id} className="aura-fact-row">
            <span><strong>{new Date(alarm.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong> — {alarm.message}</span>
            <button onClick={() => onCancelAlarm(alarm.id)}>✕</button>
          </div>
        ))
      }
    </div>
    <div className="aura-settings-section">
      <h3>Behavior</h3>
      <div className="aura-settings-row">
        <span className="aura-settings-row-label">Snooze duration</span>
        <select className="aura-settings-select" value={settings.snoozeMinutes} onChange={(e) => patch({ snoozeMinutes: Number(e.target.value) as any })}>
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
          <option value={15}>15 min</option>
        </select>
      </div>
      <div className="aura-settings-row">
        <span className="aura-settings-row-label">Speak alarm message</span>
        <button className={`aura-toggle ${settings.speakMessage ? "is-on" : ""}`} onClick={() => patch({ speakMessage: !settings.speakMessage })} />
      </div>
    </div>
  </>
);

export default SettingsAlarms;