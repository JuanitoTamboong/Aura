import React, { useState, useEffect } from "react";
import { getUserProfile, saveUserProfile, clearUserMemory, getConversationTurns, clearConversation } from "../../command/AuraConversation";
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["profile"];
  patch: (v: Partial<AuraSettings["profile"]>) => void;
}

const SettingsProfile: React.FC<Props> = () => {
  const [profile, setProfile] = useState(getUserProfile());
  const [newFact, setNewFact] = useState("");
  const [turnCount, setTurnCount] = useState(0);

  const refresh = () => { setProfile(getUserProfile()); setTurnCount(getConversationTurns().length); };
  useEffect(() => { refresh(); }, []);

  const handleNameChange = (name: string) => { saveUserProfile({ name }); refresh(); };
  
  const handleAddFact = () => {
    const trimmed = newFact.trim();
    if (!trimmed) return;
    const facts = profile.facts || [];
    if (!facts.includes(trimmed)) { saveUserProfile({ facts: [...facts, trimmed] }); refresh(); }
    setNewFact("");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ name: profile.name, facts: profile.facts, turns: getConversationTurns() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `aura-profile.json`; a.click();
  };

  return (
    <>
      <div className="aura-settings-section">
        <h3>Identity</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Your name</span>
          <input className="aura-settings-input" value={profile.name} onChange={(e) => handleNameChange(e.target.value)} />
        </div>
      </div>
      <div className="aura-settings-section">
        <h3>Saved Facts</h3>
        {(profile.facts || []).map((fact, i) => (
          <div key={i} className="aura-fact-row">
            <span>{fact}</span>
            <button onClick={() => { saveUserProfile({ facts: profile.facts.filter((f) => f !== fact) }); refresh(); }}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input className="aura-settings-input" style={{ flex: 1 }} placeholder="Add a new fact…" 
                 value={newFact} onChange={(e) => setNewFact(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddFact()} />
          <button className="aura-settings-btn" onClick={handleAddFact}>+ Add</button>
        </div>
      </div>
      <div className="aura-settings-section">
        <h3>Memory</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">{turnCount} turns stored</span>
          <button className="aura-settings-btn danger" onClick={() => { clearConversation(); refresh(); }}>Clear Conversation</button>
        </div>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Wipe name + facts</span>
          <button className="aura-settings-btn danger" onClick={() => { clearUserMemory(); refresh(); }}>Clear Memory</button>
        </div>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Export profile</span>
          <button className="aura-settings-btn" onClick={handleExport}>Download</button>
        </div>
      </div>
    </>
  );
};

export default SettingsProfile;