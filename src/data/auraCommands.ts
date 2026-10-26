// src/data/auraCommands.ts

export interface CommandEntry {
  phrase: string;
  description: string;
}

export interface CommandCategory {
  id: string;
  label: string;
  icon: string; // We will use this string to look up the React Icon
  commands: CommandEntry[];
}

export const AURA_COMMAND_REFERENCE: CommandCategory[] = [
  {
    id: "voice",
    label: "Voice Control",
    icon: "microphone", // changed from 🎙️
    commands: [
      { phrase: "Aura, wake up", description: "Activates hands-free mode" },
      { phrase: "Stop / Quiet / Cancel", description: "Cancels speech and mic" },
      { phrase: "Wait / Hold on", description: "Pauses listening temporarily" },
      { phrase: "Continue / Go on", description: "Resumes the last reply" },
    ],
  },
  {
    id: "time",
    label: "Time & Alarms",
    icon: "clock", // changed from ⏰
    commands: [
      { phrase: "Set alarm for 7am", description: "Schedules an alarm" },
      { phrase: "Remind me to call mom", description: "Schedules a reminder" },
      { phrase: "Set timer for 10 minutes", description: "Starts a countdown timer" },
      { phrase: "What time is it?", description: "Speaks the current time" },
      { phrase: "What's the date?", description: "Speaks today's date" },
    ],
  },
  {
    id: "weather",
    label: "Weather",
    icon: "cloud", // changed from 🌤️
    commands: [
      { phrase: "What's the weather?", description: "Local weather report" },
      { phrase: "Weather in Tokyo", description: "Weather for a specific city" },
      { phrase: "Will it rain today?", description: "Rain forecast" },
      { phrase: "How hot is it?", description: "Current temperature" },
    ],
  },
  {
    id: "media",
    label: "Media & Video",
    icon: "music", // changed from 🎵
    commands: [
      { phrase: "Play [song] on YouTube", description: "Searches and embeds the video" },
      { phrase: "Open YouTube", description: "Opens the embedded player" },
      { phrase: "Close the video", description: "Hides the embedded player" },
      { phrase: "Play it", description: "Replays the last found video" },
    ],
  },
  {
    id: "web",
    label: "Web & Search",
    icon: "globe", // changed from 🌐
    commands: [
      { phrase: "Search for [query]", description: "Opens a Google search" },
      { phrase: "Open Gmail", description: "Quick-opens Gmail" },
      { phrase: "Open GitHub", description: "Quick-opens GitHub" },
      { phrase: "Open Netflix", description: "Quick-opens Netflix" },
      { phrase: "Open Facebook", description: "Quick-opens Facebook" },
    ],
  },
  {
    id: "memory",
    label: "Memory & Identity",
    icon: "brain", // changed from 🧠
    commands: [
      { phrase: "My name is [name]", description: "Saves your name" },
      { phrase: "Remember that [fact]", description: "Saves a fact about you" },
      { phrase: "Do you know me?", description: "Recalls your identity" },
      { phrase: "Who am I?", description: "Speaks your saved name" },
      { phrase: "Clear memory", description: "Wipes saved name and facts" },
    ],
  },
  {
    id: "vault",
    label: "Media Vault",
    icon: "folder", // changed from 📁
    commands: [
      { phrase: "Show me the picture of [x]", description: "Searches your vault" },
      { phrase: "Find my [file]", description: "Searches uploaded files" },
      { phrase: "Describe this image", description: "Analyzes the active image" },
      { phrase: "Summarize this PDF", description: "Reads and summarizes documents" },
    ],
  },
  {
    id: "conversation",
    label: "Conversation",
    icon: "comments", // changed from 💬
    commands: [
      { phrase: "Hi / Hello / Hey", description: "Friendly greeting" },
      { phrase: "Continue", description: "Extends the last reply" },
      { phrase: "Wait", description: "Pauses before responding" },
      { phrase: "Thank you", description: "Polite acknowledgment" },
    ],
  },
];

export const getCommandCount = (): number =>
  AURA_COMMAND_REFERENCE.reduce((sum, cat) => sum + cat.commands.length, 0);