// src/command/AuraCommand.tsx
import { askAI } from '../api/aura-api';
import {
  addUserTurn,
  addAssistantTurn,
  clearConversation,
  getConversationForPrompt,
  getConversationTurns,
  hasRecentConversation,
  getUserProfile,
  saveUserProfile,
  clearUserMemory,
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
  setEmbeddedVideo?: (url: string | null) => void;
}

export const processCommand = async ({
  cmd,
  auraDatabase,
  setStatusText,
  setTranscriptText,
  setCommandDetails,
  auraSpeak,
  stopMic,
  setEmbeddedVideo,
}: CommandProps): Promise<string> => {
  
  const originalCommand = (cmd || "").trim();
  if (!originalCommand) {
    setStatusText("SYSTEM ONLINE");
    return "";
  }

  const lowerCmd = originalCommand.toLowerCase().trim();

  // 0. INSTANT ABSOLUTE STOP
  if (/\b(stop|quiet|cancel|shut up|nevermind|never mind|silence|abort|disregard)\b/.test(lowerCmd)) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopMic(); 
    clearConversation();
    setEmbeddedVideo?.(null);
    setTranscriptText(`Stopped.`); 
    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ 
      title: "Standing By", category: "Awaiting Command", match: "100%", type: "text", 
      data: "System paused. Click INITIATE VOICE to start a new session." 
    });
    return "Stopped.";
  }

  // ★ IGNORE WAKE WORD IF IT SLIPS THROUGH
  if (/^(wake up|aura|hey aura|okay aura|wake up aura|hey aur+a)$/i.test(lowerCmd)) {
    return ""; // Silently ignore and do nothing
  }

  // 0.25 WAIT / HOLD ON
  if (/\b(wait|hold on|hold up|hold it|pause|one moment|one sec|give me a sec|give me a second|just a moment|stand by|standby)\b/.test(lowerCmd)) {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setCommandDetails({
      title: "Waiting", category: "Standing By", match: "100%", type: "text",
      data: "I'm listening. Take your time — say your command when ready.",
    });
    setTranscriptText(`Waiting...`);
    setStatusText("LISTENING");
    return "";
  }

  // 0.5 CONTINUE SPEAKING
  if (/\b(continue|go on|keep going|resume|tuloy mo)\b/.test(lowerCmd)) {
    const history = getConversationTurns();
    const lastAssistantTurn = [...history].reverse().find(t => t.role === "assistant");
    if (lastAssistantTurn) {
      setTranscriptText(`Continuing...`);
      setStatusText("SPEAKING");
      await Promise.resolve(auraSpeak(lastAssistantTurn.text));
      setStatusText("SYSTEM ONLINE");
      return lastAssistantTurn.text;
    } else {
      const msg = "There is nothing to continue. Please ask a new question.";
      setStatusText("SYSTEM ONLINE");
      await Promise.resolve(auraSpeak(msg));
      return msg;
    }
  }

  // 0.75 CLOSE MEDIA PLAYER
  if (/\b(close|hide|exit|dismiss)\b/.test(lowerCmd) && /\b(video|player|it|youtube|that)\b/.test(lowerCmd)) {
    setEmbeddedVideo?.(null);
    const msg = "Closing the video player.";
    setTranscriptText(`"${originalCommand}"`);
    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ title: "Player Closed", category: "System Control", match: "100%", type: "text", data: "Embedded player hidden." });
    await Promise.resolve(auraSpeak(msg));
    return msg;
  }

  setStatusText("PROCESSING COMMAND");

  // ★ FIXED: This now strips "aura" from ANYWHERE in the string, not just the beginning.
  const command = originalCommand.replace(/\baura\b/gi, "").replace(/^\s*[\s,.:;-]+/, "").trim();
  const text = command || originalCommand;
  
  // ★ FIXED: Clean the prompt sent to the AI so it doesn't say "Hello!"
  const normalized = text.toLowerCase().replace(/\b(aur+a|hey aura|okay aura)\b/gi, "").trim();

  const respond = async (
    spoken: string, 
    details: { title: string; category: string; match?: string; type?: string; data: any }
  ): Promise<string> => {
    addUserTurn(originalCommand);
    addAssistantTurn(spoken);
    setCommandDetails({
      title: details.title, category: details.category, match: details.match ?? "100%",
      type: details.type ?? "text", data: details.data,
    });
    setStatusText("SYSTEM ONLINE");
    await Promise.resolve(auraSpeak(spoken));
    return spoken;
  };

  const searchYouTube = async (query: string) => {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("Missing YouTube API key");
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`
    );
    if (!res.ok) throw new Error("Search failed");
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      return { id: data.items[0].id.videoId, title: data.items[0].snippet.title };
    }
    return null;
  };

  try {
    // --- USER MEMORY SAVING ---
    
    // 1. CLEAR MEMORY COMMAND
    if (/\b(clear memory|clear my memory|forget everything|forget me|wipe memory|delete memory)\b/i.test(normalized)) {
      clearUserMemory();
      return await respond("I have completely wiped my memory bank. We are starting fresh.", {
        title: "Memory Cleared", category: "System",
        data: "All saved names and facts have been deleted.",
      });
    }

    // 2. SAVE NAME
    if (/\b(my name is|i am|ako si|pangalan ko ay)\b/i.test(normalized)) {
      let rawName = originalCommand.replace(/.*\b(my name is|i am|ako si|pangalan ko ay)\b/gi, "").trim();
      let newName = rawName.replace(/\b(save|it|check|the|database|and|please|thanks|thank|you|remember|this|search|open|play|aura)\b/gi, '').replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();

      if (newName) {
        saveUserProfile({ name: newName });
        return await respond(`Nice to meet you, ${newName}. I have saved your name to my memory.`, {
          title: "Memory Updated", category: "System",
          data: `I will remember that your name is ${newName}.`,
        });
      }
    }

    // 3. SAVE FACTS
    if (/\b(remember|keep in mind|tandaan mo|remember that)\b/i.test(normalized)) {
      let fact = originalCommand.replace(/\b(remember|that|keep in mind|tandaan mo)\b/gi, "").trim();
      
      fact = fact
        .replace(/\b(aura|this|my|the|a|an)\b/gi, "")
        .replace(/\s+/g, ' ')
        .trim();
        
      fact = fact.charAt(0).toUpperCase() + fact.slice(1);

      if (fact.length > 0) {
        const profile = getUserProfile();
        const currentFacts = profile.facts || [];
        if (!currentFacts.includes(fact)) {
          saveUserProfile({ facts: [...currentFacts, fact] });
        }
        return await respond(`Got it. I've added that to my memory.`, {
          title: "Memory Updated", category: "System",
          data: `Saved to memory: ${fact}`,
        });
      }
    }

    if (/\b(kilala mo ako|do you know me|who am i|sino ako)\b/i.test(normalized)) {
      const profile = getUserProfile();
      if (profile.name !== "Operator") {
         return await respond(`Yes, you are ${profile.name}. I remember you.`, {
           title: "User Identity", category: "Memory", data: `You are ${profile.name}.`,
         });
      } else {
         return await respond(`I don't know your name yet. Try saying "My name is [your name]".`, {
           title: "Unknown User", category: "Memory", data: "I don't know you yet.",
         });
      }
    }

    // 4. CHECK DATABASE (★ FIXED BUG HERE)
    if (auraDatabase?.commands) {
      const isSystemCommand =
        /\b(search|google|youtube|play|open|facebook|gmail|netflix|github)\b/i.test(
          normalized
        );

      if (!isSystemCommand) {
        const sortedKeys = Object.keys(auraDatabase.commands).sort(
          (a, b) => b.length - a.length
        );

        for (const key of sortedKeys) {
          const dbCommand = auraDatabase.commands[key];

          if (typeof dbCommand?.speak !== "string") {
            continue;
          }

          const escapedKey = key
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\s+/g, "\\s+");

          const exactPhrase = new RegExp(
            `\\b${escapedKey}\\b`,
            "i"
          );

          // Greetings should match only a greeting command,
          // not a word inside a longer question.
          const isGreeting = /^(hi|hey|hello|greetings)[.!?,\s]*$/i.test(
            normalized
          );

          if (
            exactPhrase.test(normalized) &&
            (!/^(hi|hey|hello|greetings)$/i.test(key) ||
              isGreeting)
          ) {
            return await respond(dbCommand.speak, {
              title: dbCommand.title || key,
              category: dbCommand.category || "Conversation",
              data: dbCommand.speak,
            });
          }
        }
      }
    }

    // 5. CLOSE WINDOW
    if (/\b(close|quit|exit|shut)\b/.test(normalized) && /\b(window|tab|yourself|aura|app|dashboard)\b/.test(normalized)) {
      const msg = await respond("Closing this window now.", { title: "Close Window", category: "System Control", data: "Attempting to close this window." });
      setTimeout(() => { try { window.close(); } catch (e) {} }, 1200);
      return msg;
    }

    // 6. TIME & DATE
    if (/\btime\b/.test(normalized) && !/\b(youtube|play|video|song|music)\b/.test(normalized)) {
      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return await respond(`It is currently ${timeString}.`, { title: "Current Time", category: "System Info", data: `It is currently ${timeString}.` });
    }

    if (/\bdate\b/.test(normalized) || normalized.includes('day is it today')) {
      const dateString = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return await respond(`Today is ${dateString}.`, { title: "Today's Date", category: "System Info", data: `Today is ${dateString}.` });
    }

    // 7. YOUTUBE
    const isYouTubeCommand = /\b(play|open|launch|watch|search)\b/i.test(normalized);
    if (isYouTubeCommand && /\b(youtube|music|song|video|it|that|this)\b/.test(normalized)) {
      const isJustOpenYouTube = /^(go\s*to\s+youtube|open\s+youtube|youtube|launch\s+youtube|show\s+(me\s+)?youtube)$/i.test(normalized);
      const isContextualFollowUp = /^(it|that|this|the\s+video|the\s+song|that\s+song|that\s+video|it\s+play\s+it|it\s+it|play\s+it\s+play\s+it|play\s+it\s+it|play\s+it)$/i.test(normalized.trim());
      let query = normalized
        .replace(/\b(can you|could you|would you|please|i want to|i wanna|let me)\b/g, '')
        .replace(/\b(go\s*to|goto|launch)\b/g, '')
        .replace(/\b(on|in|at|from)\s+youtube\b/g, '')
        .replace(/\byoutube\b/g, '')
        .replace(/\b(type it in|type|it in|search for|look for)\b/g, '')
        .replace(/\b(and|then|now|for me|for)\b/g, '')
        .replace(/\b(play it|play|listen to|watch|open)\b/g, '')
        .replace(/\bit\b/g, '')
        .replace(/\b(music|song|video)\b/g, '')
        .replace(/\s+/g, ' ').trim();

      if (isJustOpenYouTube) {
        setEmbeddedVideo?.("https://www.youtube.com/embed/0Bmhjf0rKe8?autoplay=1");
        return await respond("YouTube is open inside Aura.", { title: "YouTube", category: "Video Streaming", data: "Say a song name to play it here." });
      }

      if (!isContextualFollowUp && query.length > 0) {
        setStatusText("SEARCHING YOUTUBE...");
        try {
          const result = await searchYouTube(query);
          if (result) {
            setEmbeddedVideo?.(`https://www.youtube.com/embed/${result.id}?autoplay=1`);
            return await respond(`Playing ${result.title} inside Aura.`, { title: `YouTube: ${query}`, category: "Music / Video Search", data: result.title });
          } else {
            return await respond(`I couldn't find any videos for ${query}.`, { title: "Not Found", category: "Error", data: "No results found." });
          }
        } catch (err: any) {
          return await respond(`I had trouble searching YouTube for ${query}.`, { title: "Error", category: "System", data: err.message });
        }
      }
    }

    // 8. GOOGLE SEARCH
    if (/\b(search|google|look up|find|browse|surf)\b/.test(normalized)) {
      let query = normalized
        .replace(/\b(can you|please|could you|would you|i want to|let me)\b/g, '')
        .replace(/\b(search for|search on|search|look up|find on|find|google|browse|surf the web|surf)\b/g, '')
        .replace(/\b(the internet|the web|online|for)\b/g, '')
        .replace(/\s+/g, ' ').trim();

      if (query.length > 0) {
        const msg = await respond(`Searching Google for ${query}`, { title: `Google: ${query}`, category: "Web Search", data: `Searching Google for: ${query}` });
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
        return msg;
      }
    }

    // 9. QUICK OPEN SITES
    const siteMap: Record<string, string> = {
      'gmail': 'https://mail.google.com', 'google drive': 'https://drive.google.com', 'google maps': 'https://maps.google.com',
      'facebook': 'https://www.facebook.com', 'instagram': 'https://www.instagram.com', 'twitter': 'https://www.twitter.com',
      'github': 'https://www.github.com', 'chatgpt': 'https://chat.openai.com', 'stack overflow': 'https://stackoverflow.com',
      'wikipedia': 'https://www.wikipedia.org', 'netflix': 'https://www.netflix.com'
    };
    
    for (const site in siteMap) {
      if (new RegExp(`\\b${site.replace(/ /g, '\\s')}\\b`).test(normalized)) {
        const msg = await respond(`Opening ${site}`, { title: site.toUpperCase(), category: "Quick Open", data: `Opening ${site}...` });
        window.open(siteMap[site], "_blank");
        return msg;
      }
    }

    // 10. AI FALLBACK
    setCommandDetails({ title: text.toUpperCase(), category: "AI Knowledge", match: "...", type: "text", data: "Thinking..." });

    const history = getConversationForPrompt(); 
    const continuing = hasRecentConversation();
    let enhancedPrompt = text;

    if (/\b(play|open)\b/i.test(normalized) && /\b(it|this|that|song|video)\b/i.test(normalized)) {
       enhancedPrompt = `${text}. Reply with ONLY the exact name of the song or video they are referring to in the history. Do not add any other words.`;
    }

    const profile = getUserProfile();
    
    const factsList = profile.facts && profile.facts.length > 0 
      ? `\nHere is a list of facts you remember about the user:\n- ${profile.facts.join("\n- ")}\n` 
      : "";

    // ★ FIXED PROMPT: Removed the conversation history wrapper that caused the AI to say "Hello!"
    let promptWithContext = "";
    if (history) {
      promptWithContext = 
        `You are Aura, a highly capable AI terminal assistant. The user is ${profile.name}.${factsList}\n` +
        `Keep your responses direct, helpful, and concise. Do not use roleplay asterisks like *stretching* or emojis unless explicitly asked.\n` +
        `DO NOT GREET THE USER. Answer the question directly.\n` +
        `If the user asks for a quiz, story, list, or code, YOU MUST GENERATE IT DIRECTLY. Do not refuse.\n\n` +
        `--- Recent conversation ---\n${history}\n--- End of conversation ---\n\n` +
        `User: ${enhancedPrompt}\nAura:`;
    } else {
      promptWithContext = 
        `You are Aura, a highly capable AI terminal assistant. The user is ${profile.name}.${factsList}\n` +
        `Keep your responses direct, helpful, and concise. Do not use roleplay asterisks like *stretching* or emojis unless explicitly asked.\n` +
        `DO NOT GREET THE USER. Answer the question directly.\n` +
        `If the user asks for a quiz, story, list, or code, YOU MUST GENERATE IT DIRECTLY. Do not refuse.\n\n` +
        `User: ${enhancedPrompt}\nAura:`;
    }

    const reply = await askAI(promptWithContext);
    let safeReply = (reply && reply.trim()) ? reply.trim() : "I couldn't find information on that topic.";

    // AI Fallback for "play it"
    if (/\b(play|open)\b/i.test(normalized) && /\b(it|this|that|song|video)\b/i.test(normalized)) {
      const songName = safeReply.replace(/["*]/g, '').trim(); 
      try {
        setStatusText("SEARCHING YOUTUBE...");
        const result = await searchYouTube(songName);
        if (result) {
          setEmbeddedVideo?.(`https://www.youtube.com/embed/${result.id}?autoplay=1`);
          const msg = `Playing ${songName} inside Aura.`;
          setCommandDetails({ title: `YouTube: ${songName}`, category: "Music / Video Search", match: "100%", type: "text", data: msg });
          addUserTurn(originalCommand);
          addAssistantTurn(msg);
          setStatusText("SYSTEM ONLINE");
          await Promise.resolve(auraSpeak(msg));
          return msg;
        }
      } catch (err) {
         console.error("YT API Error:", err);
      }
    }

    addUserTurn(originalCommand);
    addAssistantTurn(safeReply);

    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ 
      title: text.toUpperCase(), 
      category: continuing ? "Conversation Follow-up" : "AI Knowledge", 
      match: "100%", type: "text", data: safeReply 
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