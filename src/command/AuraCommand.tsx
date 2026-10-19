// src/command/AuraCommand.tsx
import { askAI } from '../api/aura-api';
import {
  addUserTurn,
  addAssistantTurn,
  clearConversation,
  getConversationForPrompt,
  hasRecentConversation,
} from './AuraConversation';

interface CommandDetails {
  title: string;
  category: string;
  match: string;
  type: string;
  data: any;
}

interface CommandProps {
  cmd: string;
  auraDatabase: any;
  setStatusText: (text: string) => void;
  setTranscriptText: (text: string) => void;
  setCommandDetails: (details: CommandDetails) => void;
  auraSpeak: (text: string) => void | Promise<void>;
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
}: CommandProps): Promise<string> => {
  
  const originalCommand = (cmd || "").trim();
  if (!originalCommand) {
    setStatusText("SYSTEM ONLINE");
    return "";
  }

  const lowerCmd = originalCommand.toLowerCase().trim();

  // 0. INSTANT STOP
  if (/\b(stop|quiet|cancel|shut up|nevermind|never mind|silence|abort|disregard)\b/.test(lowerCmd)) {
    stopMic();
    clearConversation(); // Wipe memory
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    const stopMsg = "I am listening. What would you like to do next?";
    setCommandDetails({ title: "Standing By", category: "Awaiting Command", match: "100%", type: "text", data: stopMsg });
    setTranscriptText(`"Stopped."`);
    setStatusText("SYSTEM ONLINE");
    return stopMsg;
  }

  setStatusText("PROCESSING COMMAND");

  const command = originalCommand.replace(/^\s*aura[\s,.:;-]+/i, "").trim();
  const text = command || originalCommand;
  const normalized = text.toLowerCase();

  // Helper to update UI, speak, and save to YOUR memory file
  const respond = async (
    spoken: string, 
    details: { title: string; category: string; match?: string; type?: string; data: any }
  ): Promise<string> => {
    addUserTurn(originalCommand);      // Save user input
    addAssistantTurn(spoken);          // Save Aura's response
    
    setCommandDetails({
      title: details.title,
      category: details.category,
      match: details.match ?? "100%",
      type: details.type ?? "text",
      data: details.data,
    });
    
    setStatusText("SYSTEM ONLINE");
    await Promise.resolve(auraSpeak(spoken));
    return spoken;
  };

  try {
    // 1. CHECK DATABASE
    if (auraDatabase?.commands) {
      for (const key in auraDatabase.commands) {
        const pattern = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(normalized)) {
          const dbCommand = auraDatabase.commands[key];
          return await respond(dbCommand.speak, {
            title: dbCommand.title,
            category: dbCommand.category,
            data: dbCommand.speak,
          });
        }
      }
    }

    // 2. CLOSE WINDOW
    if (/\b(close|quit|exit|shut)\b/.test(normalized) && /\b(window|tab|this|yourself|aura|app|dashboard)\b/.test(normalized)) {
      const msg = await respond("Closing this window now.", {
        title: "Close Window",
        category: "System Control",
        data: "Attempting to close this window. If nothing happens, please click the X button.",
      });
      setTimeout(() => {
        try { window.close(); } catch (e) { /* ignore */ }
      }, 1200);
      return msg;
    }

    // 3. TIME & DATE
    if (/\btime\b/.test(normalized) && !/\b(youtube|play|video|song|music)\b/.test(normalized)) {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return await respond(`It is currently ${timeString}.`, {
        title: "Current Time",
        category: "System Info",
        data: `It is currently ${timeString}.`,
      });
    }

    if (/\bdate\b/.test(normalized) || normalized.includes('day is it today')) {
      const now = new Date();
      const dateString = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return await respond(`Today is ${dateString}.`, {
        title: "Today's Date",
        category: "System Info",
        data: `Today is ${dateString}.`,
      });
    }

    // 4. YOUTUBE (UPDATED TO IGNORE "PLAY IT")
    if (/\b(youtube|play|music|song|video)\b/.test(normalized)) {
      let query = normalized
        .replace(/\b(can you|please|could you|would you|i want to|i wanna|let me)\b/g, '')
        .replace(/\b(play|listen to|watch|open)\b/g, '')
        .replace(/\b(on|in|at|from)\s+youtube\b/g, '')
        .replace(/\byoutube\b/g, '')
        .replace(/\b(type it in|type|it in|search for|look for)\b/g, '')
        .replace(/\b(music|song|video|for me|for)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // FIXED: Use a broad regex to catch "it", "it play it", "play it play it", etc.
      const isContextualFollowUp = /^(it|that|this|the video|the song|that song|that video|it play it|it it|play it play it|play it it)$/i.test(query) || query.length < 4;

      if (!isContextualFollowUp) {
        if (query.length === 0 || query === 'youtube' || query === 'music') {
          const vids = [{ title: "YouTube Home", query: "youtube", img: "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" }];
          const msg = await respond("Opening YouTube.", {
            title: "YouTube",
            category: "Video Streaming",
            type: "video",
            data: vids,
          });
          window.open("https://www.youtube.com", "_blank");
          return msg;
        }

        const vids = [{ title: `Search: ${query}`, query, img: "https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" }];
        const msg = await respond(`Searching YouTube for ${query}.`, {
          title: `YouTube: ${query}`,
          category: "Music / Video Search",
          type: "video",
          data: vids,
        });
        
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&autoplay=1`, "_blank");
        return msg;
      }
    }

    // 5. GOOGLE SEARCH
    if (/\b(search|google|look up|find|browse|surf)\b/.test(normalized)) {
      let query = normalized
        .replace(/\b(can you|please|could you|would you|i want to|let me)\b/g, '')
        .replace(/\b(search for|search on|search|look up|find on|find|google|browse|surf the web|surf)\b/g, '')
        .replace(/\b(the internet|the web|online|for)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (query.length > 0) {
        const msg = await respond(`Searching Google for ${query}`, {
          title: `Google: ${query}`,
          category: "Web Search",
          data: `Searching Google for: ${query}`,
        });
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
        return msg;
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
      if (new RegExp(`\\b${site.replace(/ /g, '\\s')}\\b`).test(normalized)) {
        const msg = await respond(`Opening ${site}`, {
          title: site.toUpperCase(),
          category: "Quick Open",
          data: `Opening ${site}...`,
        });
        window.open(siteMap[site], "_blank");
        return msg;
      }
    }

    // 7. AI FALLBACK WITH CONVERSATION MEMORY
    setCommandDetails({ title: text.toUpperCase(), category: "AI Knowledge", match: "...", type: "text", data: "Thinking..." });

    const history = getConversationForPrompt(); 
    const continuing = hasRecentConversation();
    
    let enhancedPrompt = text;

    // If user says "play it" or similar, tell the AI to only output the song name
    if (/\b(play|open)\b/i.test(normalized) && /\b(it|this|that|song|video)\b/i.test(normalized)) {
       enhancedPrompt = `${text}. Reply with ONLY the exact name of the song or video they are referring to in the history. Do not add any other words.`;
    }

    let promptWithContext = "";
    if (history) {
      promptWithContext = 
        `You are Aura, a voice assistant. Continue the conversation naturally based on the recent history. ` +
        `Answer the new user message directly in a short, spoken-friendly way. Do not ask for clarification if the history already provides the context.\n\n` +
        `--- Recent conversation ---\n${history}\n--- End of conversation ---\n\n` +
        `User: ${enhancedPrompt}\nAura:`;
    } else {
      promptWithContext = enhancedPrompt;
    }

    const reply = await askAI(promptWithContext);
    let safeReply = (reply && reply.trim()) ? reply.trim() : "I couldn't find information on that topic.";

    // If user said "play it", use the AI's context to open YouTube!
    if (/\b(play|open)\b/i.test(normalized) && /\b(it|this|that|song|video)\b/i.test(normalized)) {
      // Clean up the reply just in case the AI added punctuation
      const songName = safeReply.replace(/["*]/g, '').trim(); 
      
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}&autoplay=1`, "_blank");
      
      const msg = `Playing ${songName} on YouTube.`;
      setCommandDetails({ title: `YouTube: ${songName}`, category: "Music / Video Search", match: "100%", type: "text", data: msg });
      
      addUserTurn(originalCommand);
      addAssistantTurn(msg);
      
      setStatusText("SYSTEM ONLINE");
      await Promise.resolve(auraSpeak(msg));
      return msg;
    }

    // Save to memory and display
    addUserTurn(originalCommand);
    addAssistantTurn(safeReply);

    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ 
      title: text.toUpperCase(), 
      category: continuing ? "Conversation Follow-up" : "AI Knowledge", 
      match: "100%", 
      type: "text", 
      data: safeReply 
    });
    
    await Promise.resolve(auraSpeak(safeReply));
    return safeReply;

  } catch (error: any) {
    const msg = error.message || "Something went wrong.";
    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ title: "Offline", category: "System Error", match: "0%", type: "text", data: msg });
    await Promise.resolve(auraSpeak(msg));
    return msg;
  }
};