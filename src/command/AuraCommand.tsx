// src/command/AuraCommand.tsx
import { askAI } from '../api/aura-api';
import {
  addUserTurn,
  addAssistantTurn,
  clearConversation,
  getConversationForPrompt,
  hasRecentConversation,
} from './AuraConversation';

interface CommandProps {
  cmd: string;
  auraDatabase: any;
  setStatusText: (text: string) => void;
  setTranscriptText: (text: string) => void;
  setCommandDetails: (details: { title: string; category: string; match: string; type: string; data: any }) => void;
  auraSpeak: (text: string) => void;
  stopMic: () => void;
}

export const processCommand = async ({
  cmd,
  auraDatabase,
  setStatusText,
  setTranscriptText,
  setCommandDetails,
  auraSpeak,
  stopMic
}: CommandProps) => {
  const lowerCmd = (cmd || "").toLowerCase().trim();

  // 0. INSTANT STOP — also wipes the conversational context.
  if (/\b(stop|quiet|cancel|shut up|nevermind|never mind|silence|abort|disregard)\b/.test(lowerCmd)) {
    stopMic();
    clearConversation();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    setCommandDetails({ title: "Standing By", category: "Awaiting Command", match: "100%", type: "text", data: "I am listening. What would you like to do next?" });
    setTranscriptText(`"Stopped."`);
    setStatusText("Aura Ready");
    return;
  }

  setStatusText("Aura Processing...");

  if (!lowerCmd) {
    setStatusText("Aura Ready");
    return;
  }

  // Helper so every local branch also updates the conversation memory.
  const respond = (spoken: string, details: { title: string; category: string; match?: string; type?: string; data: any }) => {
    addUserTurn(cmd);
    addAssistantTurn(spoken);
    setCommandDetails({
      title: details.title,
      category: details.category,
      match: details.match ?? "100%",
      type: details.type ?? "text",
      data: details.data,
    });
    auraSpeak(spoken);
    setStatusText("Aura Ready");
  };

  // 1. CHECK DATABASE
  if (auraDatabase && auraDatabase.commands) {
    for (const key in auraDatabase.commands) {
      const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(lowerCmd)) {
        const dbCommand = auraDatabase.commands[key];
        respond(dbCommand.speak, {
          title: dbCommand.title,
          category: dbCommand.category,
          data: dbCommand.speak,
        });
        return;
      }
    }
  }

  // 2. CLOSE / TAB MANAGEMENT
  if (/\b(close|quit|exit|shut)\b/.test(lowerCmd) && /\b(window|tab|this|yourself|aura|app|dashboard)\b/.test(lowerCmd)) {
    const msg = "Attempting to close this window. If nothing happens, please click the X button.";
    respond("Closing this window now.", {
      title: "Close Window",
      category: "System Control",
      data: msg,
    });
    setTimeout(() => {
      try { window.close(); } catch (e) { /* ignore */ }
    }, 1200);
    return;
  }

  // 3. TIME & DATE
  if (/\btime\b/.test(lowerCmd) && !/\b(youtube|play|video|song|music)\b/.test(lowerCmd)) {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    respond(`It is currently ${timeString}.`, {
      title: "Current Time",
      category: "System Info",
      data: `It is currently ${timeString}.`,
    });
    return;
  }

  if (/\bdate\b/.test(lowerCmd) || lowerCmd.includes('day is it today')) {
    const now = new Date();
    const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    respond(`Today is ${dateString}.`, {
      title: "Today's Date",
      category: "System Info",
      data: `Today is ${dateString}.`,
    });
    return;
  }

  // 4. YOUTUBE
  if (/\b(youtube|play|music|song|video)\b/.test(lowerCmd)) {
    let query = lowerCmd
      .replace(/\b(can you|please|could you|would you|i want to|i wanna|let me)\b/g, '')
      .replace(/\b(play|listen to|watch|open)\b/g, '')
      .replace(/\b(on|in|at|from)\s+youtube\b/g, '')
      .replace(/\byoutube\b/g, '')
      .replace(/\b(type it in|type|it in|search for|look for)\b/g, '')
      .replace(/\b(music|song|video|for me|for)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (query.length === 0 || query === 'youtube' || query === 'music') {
      const vids = [{ title: "YouTube Home", query: "youtube", img: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=120&q=80" }];
      respond("Opening YouTube.", {
        title: "YouTube",
        category: "Video Streaming",
        type: "video",
        data: vids,
      });
      window.open("https://www.youtube.com", "_blank");
      return;
    }

    const vids = [{ title: `Search: ${query}`, query, img: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=120&q=80" }];
    respond(`Searching YouTube for ${query}.`, {
      title: `YouTube: ${query}`,
      category: "Music / Video Search",
      type: "video",
      data: vids,
    });
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`, "_blank");
    return;
  }

  // 5. GOOGLE SEARCH
  if (/\b(search|google|look up|find|browse|surf)\b/.test(lowerCmd)) {
    let query = lowerCmd
      .replace(/\b(can you|please|could you|would you|i want to|let me)\b/g, '')
      .replace(/\b(search for|search on|search|look up|find on|find|google|browse|surf the web|surf)\b/g, '')
      .replace(/\b(the internet|the web|online|for)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (query.length > 0) {
      respond(`Searching Google for ${query}`, {
        title: `Google: ${query}`,
        category: "Web Search",
        data: `Searching Google for: ${query}`,
      });
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
      return;
    }
  }

  // 6. QUICK OPEN SITES
  const siteMap: Record<string, string> = {
    'gmail': 'https://mail.google.com', 'google drive': 'https://drive.google.com', 'google maps': 'https://maps.google.com',
    'facebook': 'https://www.facebook.com', 'instagram': 'https://www.instagram.com', 'twitter': 'https://www.twitter.com',
    'github': 'https://www.github.com', 'chatgpt': 'https://chat.openai.com', 'stack overflow': 'https://stackoverflow.com',
    'wikipedia': 'https://www.wikipedia.org', 'netflix': 'https://www.netflix.com'
  };
  
  for (const site in siteMap) {
    if (new RegExp(`\\b${site.replace(/ /g, '\\s')}\\b`).test(lowerCmd)) {
      respond(`Opening ${site}`, {
        title: site.toUpperCase(),
        category: "Quick Open",
        data: `Opening ${site}...`,
      });
      window.open(siteMap[site], "_blank");
      return;
    }
  }

  // 7. AI FALLBACK
  setCommandDetails({ title: cmd.toUpperCase(), category: "AI Knowledge", match: "...", type: "text", data: "Thinking..." });

  try {
    const history = getConversationForPrompt();
    const continuing = hasRecentConversation();

    // We let the AI figure out the context from the history!
    let promptWithContext = "";

    if (history) {
      promptWithContext = 
        `You are Aura, a voice assistant. Continue the conversation naturally based on the recent history. ` +
        `Answer the new user message directly in a short, spoken-friendly way. Do not ask for clarification if the history already provides the context.\n\n` +
        `--- Recent conversation ---\n${history}\n--- End of conversation ---\n\n` +
        `User: ${lowerCmd}\nAura:`;
    } else {
      promptWithContext = lowerCmd;
    }

    const reply = await askAI(promptWithContext);
    const safeReply = (reply && reply.trim()) ? reply.trim() : "I couldn't find information on that topic.";

    addUserTurn(cmd);
    addAssistantTurn(safeReply);

    setStatusText("Aura Ready");
    setCommandDetails({ 
      title: cmd.toUpperCase(), 
      category: continuing ? "Conversation Follow-up" : "AI Knowledge", 
      match: "100%", 
      type: "text", 
      data: safeReply 
    });
    auraSpeak(safeReply);
  } catch (error: any) {
    setStatusText("Aura Ready");
    setCommandDetails({ title: "Offline", category: "System Error", match: "0%", type: "text", data: error.message });
    auraSpeak(error.message);
  }
};