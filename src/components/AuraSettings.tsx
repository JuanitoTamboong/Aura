// src/components/AuraSettings.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  FaXmark, 
  FaGear,          // <-- Fixed: Was FaCog
  FaMicrophone, 
  FaUser, 
  FaBook, 
  FaPalette, 
  FaBell, 
  FaLock, 
  FaCircleInfo, 
  FaWrench 
} from "react-icons/fa6";
import { 
  loadSettings, saveSettings, resetSettings, factoryReset,
  type AuraSettings as AuraSettingsType
} from "../settings/AuraSettingsStore";
import "../css/AuraSettings.css";

// ── IMPORT THE SEPARATE TAB COMPONENTS ──
import SettingsVoice from "./settings/SettingsVoice";
import SettingsProfile from "./settings/SettingsProfile";
import SettingsCommands from "./settings/SettingsCommands";
import SettingsAppearance from "./settings/SettingsAppearance";
import SettingsAlarms from "./settings/SettingsAlarms";
import SettingsPrivacy from "./settings/SettingsPrivacy";
import SettingsAbout from "./settings/SettingsAbout";
import SettingsAdvanced from "./settings/SettingsAdvanced";

type TabId = "voice" | "profile" | "commands" | "appearance" | "alarms" | "privacy" | "about" | "advanced";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "voice",      label: "Voice",       icon: <FaMicrophone /> },
  { id: "profile",    label: "Profile",     icon: <FaUser /> },
  { id: "commands",   label: "Commands",    icon: <FaBook /> },
  { id: "appearance", label: "Appearance",  icon: <FaPalette /> },
  { id: "alarms",     label: "Alarms",      icon: <FaBell /> },
  { id: "privacy",    label: "Privacy",     icon: <FaLock /> },
  { id: "about",      label: "About",       icon: <FaCircleInfo /> },
  { id: "advanced",   label: "Advanced",    icon: <FaWrench /> },
];

interface Props {
  lightMode: boolean;
  onClose: () => void;
  onChange: (next: AuraSettingsType) => void;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  onVoiceChange: (name: string) => void;
  onTestVoice: (voiceName?: string) => void;
  pendingAlarms: any[];
  onCancelAlarm: (id: string) => void;
}

const AuraSettings: React.FC<Props> = ({
  lightMode, onClose, onChange, availableVoices,
  selectedVoiceName, onVoiceChange, onTestVoice,
  pendingAlarms, onCancelAlarm,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("voice");
  const [settings, setSettings] = useState<AuraSettingsType>(() => loadSettings());
  const saveTimerRef = useRef<any>(null);

  // Auto-save with 300ms debounce
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSettings(settings);
      onChange(settings);
    }, 300);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [settings, onChange]);

  const patch = useCallback(
    <K extends keyof AuraSettingsType>(section: K, value: Partial<AuraSettingsType[K]>) => {
      setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
    },
    []
  );

  const handleResetAll = () => {
    if (!window.confirm("Reset all settings to defaults? Your data is kept.")) return;
    const fresh = resetSettings();
    setSettings(fresh);
    saveSettings(fresh);
    onChange(fresh);
  };

  const handleFactoryReset = () => {
    if (!window.confirm("Factory reset — this removes ALL Aura data and reloads. Continue?")) return;
    if (!window.confirm("Are you absolutely sure? This cannot be undone?")) return;
    factoryReset();
  };

  return (
    <div className="aura-settings-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`aura-settings-shell ${lightMode ? "" : "is-dark"}`}>
        
        {/* HEADER */}
        <div className="aura-settings-header">
          <h2><FaGear style={{ marginRight: 8 }} /> AURA SETTINGS</h2>
          <button className="aura-settings-close" onClick={onClose} aria-label="Close settings">
            <FaXmark />
          </button>
        </div>

        {/* BODY */}
        <div className="aura-settings-body">
          <nav className="aura-settings-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="aura-settings-content">
            {activeTab === "voice" && (
              <SettingsVoice 
                settings={settings.voice} patch={(v) => patch("voice", v)} 
                availableVoices={availableVoices} selectedVoiceName={selectedVoiceName} 
                onVoiceChange={onVoiceChange} onTestVoice={onTestVoice} 
              />
            )}
            {activeTab === "profile" && (
              <SettingsProfile settings={settings.profile} patch={(v) => patch("profile", v)} />
            )}
            {activeTab === "commands" && <SettingsCommands />}
            {activeTab === "appearance" && (
              <SettingsAppearance settings={settings.appearance} patch={(v) => patch("appearance", v)} />
            )}
            {activeTab === "alarms" && (
              <SettingsAlarms 
                settings={settings.alarms} patch={(v) => patch("alarms", v)} 
                pendingAlarms={pendingAlarms} onCancelAlarm={onCancelAlarm} 
              />
            )}
            {activeTab === "privacy" && (
              <SettingsPrivacy 
                settings={settings.privacy} patch={(v) => patch("privacy", v)} 
                onFactoryReset={handleFactoryReset} 
              />
            )}
            {activeTab === "about" && <SettingsAbout />}
            {activeTab === "advanced" && (
              <SettingsAdvanced 
                settings={settings.advanced} patch={(v) => patch("advanced", v)} 
                onResetAll={handleResetAll} 
              />
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="aura-settings-footer">
          <button className="aura-settings-btn danger" onClick={handleFactoryReset}>
            Factory Reset
          </button>
          <button className="aura-settings-btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuraSettings;