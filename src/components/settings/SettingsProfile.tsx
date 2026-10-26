// src/components/settings/SettingsProfile.tsx
import React, { useState, useEffect } from "react";
import { 
  clearUserMemory, getConversationTurns, clearConversation 
} from "../../command/AuraConversation";
import type { AuraSettings } from "../../settings/AuraSettingsStore";

interface Props {
  settings: AuraSettings["profile"];
  patch: (v: Partial<AuraSettings["profile"]>) => void;
}

const SettingsProfile: React.FC<Props> = ({ settings, patch }) => {
  const [newFact, setNewFact] = useState("");
  const [turnCount, setTurnCount] = useState(0);

  // Only refresh the conversation count, not the profile itself
  const refresh = () => { 
    setTurnCount(getConversationTurns().length); 
  };
  
  useEffect(() => { refresh(); }, []);

  const handleAddFact = () => {
    const trimmed = newFact.trim();
    if (!trimmed) return;
    const facts = settings.facts || [];
    if (!facts.includes(trimmed)) { 
      // ✅ Only updates the draft state
      patch({ facts: [...facts, trimmed] }); 
    }
    setNewFact("");
  };

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ name: settings.name, facts: settings.facts, turns: getConversationTurns() }, null, 2)], 
      { type: "application/json" }
    );
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(blob); 
    a.download = `aura-profile.json`; 
    a.click();
  };

  return (
    <>
      <div className="aura-settings-section">
        <h3>Identity</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Your name</span>
          {/* ✅ Only updates the draft state */}
          <input 
            className="aura-settings-input" 
            value={settings.name} 
            onChange={(e) => patch({ name: e.target.value })} 
          />
        </div>
      </div>
      
      <div className="aura-settings-section">
        <h3>Saved Facts</h3>
        {(settings.facts || []).length === 0 ? (
          <p style={{ fontSize: 12, opacity: 0.55, fontStyle: "italic", margin: "10px 0" }}>
            No facts saved yet.
          </p>
        ) : (
          (settings.facts || []).map((fact, i) => (
            <div key={i} className="aura-fact-row">
              <span>{fact}</span>
              {/* ✅ Only updates the draft state */}
              <button onClick={() => { 
                patch({ facts: settings.facts.filter((f) => f !== fact) }); 
              }}>
                ✕
              </button>
            </div>
          ))
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input 
            className="aura-settings-input" 
            style={{ flex: 1 }} 
            placeholder="Add a new fact…" 
            value={newFact} 
            onChange={(e) => setNewFact(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && handleAddFact()} 
          />
          <button className="aura-settings-btn" onClick={handleAddFact}>+ Add</button>
        </div>
      </div>

      <div className="aura-settings-section">
        <h3>Memory</h3>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">{turnCount} turns stored</span>
          <button className="aura-settings-btn danger" onClick={() => { 
            clearConversation(); 
            refresh(); 
          }}>
            Clear Conversation
          </button>
        </div>
        <div className="aura-settings-row">
          <span className="aura-settings-row-label">Wipe name + facts</span>
          <button className="aura-settings-btn danger" onClick={() => { 
            clearUserMemory(); 
            // ✅ Revert draft to defaults
            patch({ name: "Sir", facts: [] }); 
            refresh(); 
          }}>
            Clear Memory
          </button>
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