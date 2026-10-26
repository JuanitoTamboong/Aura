// src/components/settings/SettingsCommands.tsx
import React, { useState } from "react";
import { AURA_COMMAND_REFERENCE, getCommandCount, type CommandCategory } from "../../data/auraCommands";

// Import all the icons we need
import { 
  FaMicrophone, 
  FaClock, 
  FaCloudSun, 
  FaMusic, 
  FaGlobe, 
  FaBrain, 
  FaFolderOpen, 
  FaComments 
} from "react-icons/fa6";

const SettingsCommands: React.FC = () => {
  const [query, setQuery] = useState("");
  
  // Create a map to bridge the string name in the data to the React Component
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "microphone": return <FaMicrophone />;
      case "clock": return <FaClock />;
      case "cloud": return <FaCloudSun />;
      case "music": return <FaMusic />;
      case "globe": return <FaGlobe />;
      case "brain": return <FaBrain />;
      case "folder": return <FaFolderOpen />;
      case "comments": return <FaComments />;
      default: return null;
    }
  };

  const filtered = AURA_COMMAND_REFERENCE.map((cat) => ({
    ...cat,
    commands: cat.commands.filter((c) => 
      !query || c.phrase.toLowerCase().includes(query.toLowerCase()) || 
      c.description.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((cat) => cat.commands.length > 0);

  return (
    <>
      <div className="aura-settings-section">
        <h3>Command Reference</h3>
        <p className="aura-settings-section-desc">{getCommandCount()} commands available.</p>
        <input 
          className="aura-command-search" 
          placeholder="Search commands…" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
        />
      </div>
      
      {filtered.length === 0 && (
        <p style={{ textAlign: "center", opacity: 0.5, fontSize: 12, marginTop: 20 }}>
          No commands match "{query}"
        </p>
      )}

      {filtered.map((cat: CommandCategory) => (
        <details key={cat.id} className="aura-command-cat" open>
          <summary>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {getIcon(cat.icon)} 
              {cat.label}
            </span>
          </summary>
          {cat.commands.map((cmd, i) => (
            <div 
              key={i} 
              className="aura-command-row" 
              onClick={() => navigator.clipboard?.writeText(cmd.phrase)} 
              title="Click to copy"
            >
              <span className="aura-command-phrase">{cmd.phrase}</span>
              <span className="aura-command-desc">{cmd.description}</span>
            </div>
          ))}
        </details>
      ))}
    </>
  );
};

export default SettingsCommands;