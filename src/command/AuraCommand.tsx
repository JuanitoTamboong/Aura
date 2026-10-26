// src/command/AuraCommand.tsx
import {
  askAIStream, buildMessages, toSpokenText, AuraApiError, askAIVision,
  type ChatMessage,
} from "../api/aura-api";
import {
  addUserTurn, addAssistantTurn,
  getConversationTurns,
  getUserProfile, saveUserProfile, clearUserMemory,
  type ConversationTurn,
} from "./AuraConversation";
import { setReminder } from "./AuraReminders";
import { getWeather } from "./AuraWeather";
import { supabase } from "../../supabase/supabase-client";

interface CommandDetails {
  title: string; category: string; match: string;
  type: string; data: any; weatherIcon?: any; skipModal?: boolean;
}

interface CommandProps {
  cmd: string;
  auraDatabase: any;
  setStatusText: (text: string) => void;
  setTranscriptText: (text: string) => void;
  setCommandDetails: (d: CommandDetails) => void;
  auraSpeak: (text: string) => void | Promise<void>;
  stopMic: () => void;
  setEmbeddedVideo?: (url: string | null) => void;
  signal?: AbortSignal;
  onPartialReply?: (partial: string) => void;
  activeImageUrl?: string | null;
}

const turnsToMessages = (t: ConversationTurn[]): ChatMessage[] =>
  t.map((x) => ({ role: x.role, content: x.text }));

export const processCommand = async ({
  cmd, auraDatabase, setStatusText, setTranscriptText,
  setCommandDetails, auraSpeak, stopMic, setEmbeddedVideo,
  signal, onPartialReply,
  activeImageUrl,
}: CommandProps): Promise<any> => {

  const originalCommand = (cmd || "").trim();
  if (!originalCommand) { setStatusText("SYSTEM ONLINE"); return ""; }
  const lowerCmd = originalCommand.toLowerCase().trim();

  // ── 0. STOP ──────────────────
  if (/\b(stop|quiet|cancel|shut up|nevermind|never mind|silence|abort|disregard)\b/.test(lowerCmd)) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopMic();
    setEmbeddedVideo?.(null);
    setTranscriptText("Stopped.");
    setStatusText("SYSTEM ONLINE");
    setCommandDetails({
      title: "Standing By", category: "Awaiting Command", match: "100%", type: "text",
      data: "Paused. Your conversation is still in memory — say something to continue.",
    });
    return "Stopped.";
  }

  // ── Wake word ─────────────────────────────────────────────────
  if (/^(wake up|aura|hey aura|okay aura|wake up aura|hey aur+a)$/i.test(lowerCmd)) return "";

  // ── Wait ────────────────────────────────────────────────────────
  if (/\b(wait|hold on|hold up|hold it|pause|one moment|one sec|give me a sec|give me a second|just a moment|stand by|standby)\b/.test(lowerCmd)) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setCommandDetails({ title: "Waiting", category: "Standing By", match: "100%", type: "text",
      data: "I'm listening. Take your time." });
    setTranscriptText("Waiting...");
    setStatusText("LISTENING");
    return "";
  }

  // ── Continue ──────────────────────
  if (/\b(continue|go on|keep going|resume|tuloy mo)\b/.test(lowerCmd)) {
    const turns = getConversationTurns();
    if (turns.length === 0) {
      const msg = "There's nothing to continue yet. Ask me something first.";
      await Promise.resolve(auraSpeak(msg));
      return msg;
    }
    const messages = buildMessages([
      ...turnsToMessages(turns),
      { role: "user", content: "Keep going from where you left off. Continue naturally." },
    ]);
    let partial = "";
    const reply = await askAIStream(messages, {
      maxTokens: 320, signal,
      onToken: (d) => { partial += d; onPartialReply?.(partial); },
    });
    addUserTurn("continue");
    addAssistantTurn(reply);
    setStatusText("SPEAKING");
    await Promise.resolve(auraSpeak(toSpokenText(reply)));
    setStatusText("SYSTEM ONLINE");
    return reply;
  }

  // ── Close media player ──────────────────────────────────────────
  if (/\b(close|hide|exit|dismiss)\b/.test(lowerCmd) && /\b(video|player|it|youtube|that)\b/.test(lowerCmd)) {
    setEmbeddedVideo?.(null);
    const msg = "Closing the video player.";
    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ title: "Player Closed", category: "System Control", match: "100%", type: "text", data: "Player hidden." });
    await Promise.resolve(auraSpeak(msg));
    return msg;
  }

  // ── Alarms ──────────────────────────────────────────
  if (/\b(set\s+alarm|alarm|remind\s+me|reminder|wake\s+me|set\s+timer|timer)\b/i.test(lowerCmd)) {
    setStatusText("SETTING ALARM...");
    const result = setReminder(originalCommand);
    setCommandDetails({
      title: result.success ? "Alarm Scheduled" : "Alarm Error",
      category: "Time Management", match: result.success ? "100%" : "0%",
      type: "text", data: result.message,
    });
    setTranscriptText(result.message);
    setStatusText(result.success ? "ALARM SET" : "SYSTEM ONLINE");
    if (result.success) {
      addUserTurn(originalCommand);
      addAssistantTurn(result.message);
    }
    await Promise.resolve(auraSpeak(result.message));
    return result.message;
  }

  setStatusText("PROCESSING COMMAND");

  const command = originalCommand.replace(/\baura\b/gi, "").replace(/^\s*[\s,.:;-]+/, "").trim();
  
  let text = command || originalCommand;
  
  const normalized = text.toLowerCase().replace(/\b(aur+a|hey aura|okay aura)\b/gi, "").trim();

  const respond = async (
    spoken: string,
    details: { title: string; category: string; match?: string; type?: string; data: any }
  ): Promise<string> => {
    addUserTurn(originalCommand);
    addAssistantTurn(spoken);
    setCommandDetails({
      title: details.title, category: details.category,
      match: details.match ?? "100%", type: details.type ?? "text", data: details.data,
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
    const hit = data?.items?.[0];
    return hit ? { id: hit.id.videoId, title: hit.snippet.title } : null;
  };

  try {
    // ── SUPABASE MEDIA VAULT SEARCH ─────────────────
    const cleanNormalized = normalized.replace(/[.,!?;:]/g, "").trim();
    const isAskingForMedia = /\b(show me|find my|get my|send me|send the|send that|pic of|picture of|photo of|image of|where is)\b/i.test(cleanNormalized);

    if (isAskingForMedia) {
      setStatusText("SEARCHING MEDIA VAULT");
      setTranscriptText("Looking through your Supabase storage...");

      const searchQuery = cleanNormalized
        .replace(/\b(can you|could you|would you|please|kindly|for me|show|me|find|my|get|send|the|that|this|pic|pictures?|photos?|images?|of|where|is|are|in|a|an|vault|media|from|file|files|uploaded)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (searchQuery.length > 1) {
        try {
          const { data, error } = await supabase.storage.from("aura-media").list();

          if (error) {
            console.error("Supabase list error:", error);
            setStatusText("SYSTEM ONLINE");
            return await respond(
              `I couldn't reach your Media Vault right now.`,
              { title: "Vault Error", category: "Media", match: "0%", data: error.message }
            );
          }

          if (data) {
            const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
            
            const matchedFiles = data.filter(file => {
              if (file.name === ".emptyFolderPlaceholder") return false;
              const fileNameLower = file.name.toLowerCase();
              
              if (queryWords.length === 0) return fileNameLower.includes(searchQuery.toLowerCase());
              
              return queryWords.some(word => fileNameLower.includes(word));
            });

            if (matchedFiles.length > 0) {
              const mediaItems = matchedFiles.map(file => {
                const { data: { publicUrl } } = supabase.storage.from("aura-media").getPublicUrl(file.name);
                const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(file.name);
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
                return { 
                  url: publicUrl, 
                  type: isImage ? "image" : isVideo ? "video" : "document" 
                };
              });

              setStatusText("MEDIA FOUND");
              const summary = `I found **${matchedFiles.length}** file(s) matching "${searchQuery}":`;
              setTranscriptText(`Here is what I found for "${searchQuery}".`);

              addUserTurn(originalCommand);
              addAssistantTurn(summary);
              setCommandDetails({
                title: `Media: ${searchQuery}`,
                category: "Media Vault",
                match: "100%",
                type: "media",
                data: {
                  text: summary,
                  mediaItems: mediaItems
                },
              });
              
              await Promise.resolve(auraSpeak(`Here ${matchedFiles.length === 1 ? "it is" : "they are"}.`));
              setStatusText("SYSTEM ONLINE");

              return { text: summary, mediaItems };
            }

            setStatusText("SYSTEM ONLINE");
            return await respond(
              `I searched your Media Vault but couldn't find anything matching "${searchQuery}".`,
              { title: "No Matches", category: "Media Vault", match: "0%", data: `No files contain "${searchQuery}".` }
            );
          }
        } catch (err: any) {
          console.error("Supabase search failed:", err);
          setStatusText("SYSTEM ONLINE");
          return await respond(
            `Something went wrong while searching the Media Vault.`,
            { title: "Vault Error", category: "Media", match: "0%", data: err?.message ?? "Unknown error" }
          );
        }
      }

      setStatusText("SYSTEM ONLINE");
      return await respond(
        "What would you like me to find in your Media Vault?",
        { title: "Awaiting Media Query", category: "Media Vault", data: "No search term detected." }
      );
    }

    // ── Memory management ────────────────────────────────────────
    if (/\b(clear memory|clear my memory|forget everything|forget me|wipe memory|delete memory)\b/i.test(normalized)) {
      clearUserMemory();
      return await respond("Wiped my memory. Starting fresh.", {
        title: "Memory Cleared", category: "System",
        data: "All saved names and facts have been deleted.",
      });
    }

    if (/\b(my name is|i am|ako si|pangalan ko ay)\b/i.test(normalized)) {
      const raw = originalCommand.replace(/.*\b(my name is|i am|ako si|pangalan ko ay)\b/gi, "").trim();
      const newName = raw
        .replace(/\b(save|it|check|the|database|and|please|thanks|thank|you|remember|this|search|open|play|aura)\b/gi, "")
        .replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
      if (newName) {
        saveUserProfile({ name: newName });
        return await respond(`Nice to meet you, ${newName}.`, {
          title: "Memory Updated", category: "System",
          data: `I'll remember your name is ${newName}.`,
        });
      }
    }

    if (/\b(remember|keep in mind|tandaan mo|remember that)\b/i.test(normalized)) {
      let fact = originalCommand.replace(/\b(remember|that|keep in mind|tandaan mo)\b/gi, "").trim();
      fact = fact.replace(/\b(aura|this|my|the|a|an)\b/gi, "").replace(/\s+/g, " ").trim();
      if (fact.length > 0) {
        fact = fact.charAt(0).toUpperCase() + fact.slice(1);
        const profile = getUserProfile();
        const facts = profile.facts || [];
        if (!facts.includes(fact)) saveUserProfile({ facts: [...facts, fact] });
        return await respond("Got it, I'll remember that.", {
          title: "Memory Updated", category: "System", data: `Saved: ${fact}`,
        });
      }
    }

    if (/\b(kilala mo ako|do you know me|who am i|sino ako)\b/i.test(normalized)) {
      const profile = getUserProfile();
      if (profile.name && profile.name !== "Sir") {
        return await respond(`You're ${profile.name}.`, {
          title: "User Identity", category: "Memory", data: `You are ${profile.name}.`,
        });
      }
      return await respond("I don't know your name yet. Try saying 'My name is ...'.", {
        title: "Unknown User", category: "Memory", data: "No name on file.",
      });
    }

    // ── Weather ─────────────────────────────────────────────────
    if (/\b(weather|forecast|temperature|how (hot|cold)|is it (going to|gonna) rain|will it rain|rain today|humidity)\b/i.test(normalized)) {
      setStatusText("CHECKING WEATHER...");
      await Promise.resolve(auraSpeak("Let me check that for you."));
      let city = "";
      const pats = [
        /\b(?:weather|forecast|temperature|humidity)\s+(?:in|at|for)\s+(.+?)(?:\s+(?:today|tomorrow|right now|now|please|currently))?$/i,
        /\b(?:in|at|for)\s+(.+?)\s+(?:weather|forecast|temperature)\b/i,
      ];
      for (const p of pats) {
        const m = normalized.match(p);
        if (m?.[1]) { city = m[1].replace(/\b(today|tomorrow|right now|now|please|the|current|currently)\b/gi, "").replace(/[?.!]+$/g, "").trim(); break; }
      }
      const result = await getWeather(city || undefined);
      setCommandDetails({
        title: result.success ? `Weather — ${result.location}` : "Weather",
        category: "Environment",
        match: result.success ? "100%" : "0%",
        type: "text", data: result.markdown,
        weatherIcon: result.weatherIcon, skipModal: !result.success,
      });
      setTranscriptText(result.message);
      if (result.success) { addUserTurn(originalCommand); addAssistantTurn(result.message); }
      await Promise.resolve(auraSpeak(result.message));
      setStatusText(result.success ? "SYSTEM ONLINE" : "WEATHER ERROR");
      return result.message;
    }

    // ── Database hits ───────────────────────────────────────────
    if (auraDatabase?.commands && Array.isArray(auraDatabase.commands)) {
      const isSystem = /\b(search|google|youtube|play|open|facebook|gmail|netflix|github)\b/i.test(normalized);
      if (!isSystem) {
        const sorted = [...auraDatabase.commands].sort((a, b) => b.command.length - a.command.length);
        for (const db of sorted) {
          if (typeof db?.speak !== "string" || !db?.command) continue;
          const esc = db.command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
          const re = new RegExp(`\\b${esc}\\b`, "i");
          const isGreeting = /^(hi|hey|hello|greetings)[.!?,\s]*$/i.test(normalized);
          if (re.test(normalized) && (!/^(hi|hey|hello|greetings)$/i.test(db.command) || isGreeting)) {
            return await respond(db.speak, {
              title: db.title || db.command, category: db.category || "Conversation", data: db.speak,
            });
          }
        }
      }
    }

    // ── Close window ────────────────────────────────────────────
    if (/\b(close|quit|exit|shut)\b/.test(normalized) && /\b(window|tab|yourself|aura|app|dashboard)\b/.test(normalized)) {
      const msg = await respond("Closing now.", { title: "Close Window", category: "System Control", data: "Closing." });
      setTimeout(() => { try { window.close(); } catch {} }, 1200);
      return msg;
    }

    // ── Time / date ─────────────────────────────────────────────
    if (/\btime\b/.test(normalized) && !/\b(youtube|play|video|song|music)\b/.test(normalized)) {
      const s = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return await respond(`It's ${s}.`, { title: "Current Time", category: "System Info", data: `It's ${s}.` });
    }
    if (/\bdate\b/.test(normalized) || normalized.includes("day is it today")) {
      const s = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      return await respond(`Today is ${s}.`, { title: "Today's Date", category: "System Info", data: `Today is ${s}.` });
    }

    // ── YouTube ─────────────────────────────────────────────────
    const isYouTubeCommand = /\b(play|open|launch|watch|search)\b/i.test(normalized);
    if (isYouTubeCommand && /\b(youtube|music|song|video|it|that|this)\b/.test(normalized)) {
      const isJustOpen = /^(go\s*to\s+youtube|open\s+youtube|youtube|launch\s+youtube|show\s+(me\s+)?youtube)$/i.test(normalized);
      const isFollowUp = /^(it|that|this|the\s+video|the\s+song|that\s+song|that\s+video|play\s+it)$/i.test(normalized.trim());

      let query = normalized
        .replace(/\b(can you|could you|would you|please|i want to|i wanna|let me)\b/g, "")
        .replace(/\b(go\s*to|goto|launch)\b/g, "")
        .replace(/\b(on|in|at|from)\s+youtube\b/g, "")
        .replace(/\byoutube\b/g, "")
        .replace(/\b(type it in|type|it in|search for|look for)\b/g, "")
        .replace(/\b(and|then|now|for me|for)\b/g, "")
        .replace(/\b(play it|play|listen to|watch|open)\b/g, "")
        .replace(/\bit\b/g, "")
        .replace(/\b(music|song|video)\b/g, "")
        .replace(/\s+/g, " ").trim();

      if (isJustOpen) {
        setEmbeddedVideo?.("https://www.youtube.com/embed/0Bmhjf0rKe8?autoplay=1");
        return await respond("YouTube's up inside Aura.", {
          title: "YouTube", category: "Video Streaming", data: "Say a song name to play it.",
        });
      }

      if (!isFollowUp && query.length > 0) {
        setStatusText("SEARCHING YOUTUBE...");
        try {
          const result = await searchYouTube(query);
          if (result) {
            setEmbeddedVideo?.(`https://www.youtube.com/embed/${result.id}?autoplay=1`);
            return await respond(`Playing ${result.title} inside Aura.`, {
              title: `YouTube: ${query}`, category: "Music / Video Search", data: result.title,
            });
          }
          return await respond(`Couldn't find videos for ${query}.`, {
            title: "Not Found", category: "Error", data: "No results.",
          });
        } catch (err: any) {
          return await respond(`YouTube search failed for ${query}.`, {
            title: "Error", category: "System", data: err.message,
          });
        }
      }
    }

    // ── Google search ───────────────────────────────────────────
    if (/\b(search|google|look up|find|browse|surf)\b/.test(normalized)) {
      const q = normalized
        .replace(/\b(can you|please|could you|would you|i want to|let me)\b/g, "")
        .replace(/\b(search for|search on|search|look up|find on|find|google|browse|surf the web|surf)\b/g, "")
        .replace(/\b(the internet|the web|online|for)\b/g, "")
        .replace(/\s+/g, " ").trim();
      if (q.length > 0) {
        const msg = await respond(`Searching for ${q}.`, {
          title: `Google: ${q}`, category: "Web Search", data: `Searching for: ${q}`,
        });
        window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank");
        return msg;
      }
    }

    // ── Quick-open sites ────────────────────────────────────────
    const siteMap: Record<string, string> = {
      "gmail": "https://mail.google.com", "google drive": "https://drive.google.com",
      "google maps": "https://maps.google.com", "facebook": "https://www.facebook.com",
      "instagram": "https://www.instagram.com", "twitter": "https://www.twitter.com",
      "github": "https://www.github.com", "chatgpt": "https://chat.openai.com",
      "stack overflow": "https://stackoverflow.com", "wikipedia": "https://www.wikipedia.org",
      "netflix": "https://www.netflix.com",
    };
    for (const site in siteMap) {
      if (new RegExp(`\\b${site.replace(/ /g, "\\s")}\\b`).test(normalized)) {
        const msg = await respond(`Opening ${site}.`, {
          title: site.toUpperCase(), category: "Quick Open", data: `Opening ${site}...`,
        });
        window.open(siteMap[site], "_blank");
        return msg;
      }
    }

    // ── AI FALLBACK (streaming) ─────────────────────────────────
    setCommandDetails({
      title: text.toUpperCase(), category: "AI Knowledge",
      match: "...", type: "text", data: "",
    });

    let hasDocumentContext = false;

    // 1. Check if there is an active file in memory
    if (activeImageUrl) {
      try {
        const rawFileName = decodeURIComponent(activeImageUrl.split('/').pop() || "document");
        const fileExt = rawFileName.split('.').pop()?.toLowerCase() || "";

        // ── FETCH FROM SUPABASE DB ──
        if (["txt", "csv", "md", "pdf", "docx", "xlsx"].includes(fileExt)) {
           setStatusText(`READING ${fileExt.toUpperCase()} FILE...`);
           
           // FIX: Use .ilike() to ignore capitalization and partial matches
           const baseSearchName = rawFileName.replace(/\.[^/.]+$/, ""); 
           
           const { data: docData, error: docError } = await supabase
             .from("documents")
             .select("extracted_text, file_name")
             .ilike("file_name", `%${baseSearchName}%`)
             .single();

           if (!docError && docData?.extracted_text) {
             const savedText = docData.extracted_text;
             const realFileName = docData.file_name;
             
             text = `Please read the following ${fileExt.toUpperCase()} document named "${realFileName}" and answer my question based on its contents.\n\n[START OF DOCUMENT]\n${savedText.slice(0, 15000)}\n[END OF DOCUMENT]\n\nDo NOT repeat the document back to me. Instead, directly answer this request: "${text}"`;
             hasDocumentContext = true;
           } else {
             console.error("DB Error or Empty Text:", docError);
             // Fallback if the text wasn't found in the DB
             text = `The user is asking about the document "${rawFileName}", but I couldn't find its text in the database. Please ask the user to copy-paste the text. User's request: "${text}"`;
             hasDocumentContext = true;
           }
        }
        // ── IMAGES ──
        else if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt)) {
           setStatusText("ANALYZING IMAGE...");
           const visionReply = await askAIVision(activeImageUrl, text, { signal });
           
           addUserTurn(originalCommand);
           addAssistantTurn(visionReply);

           setStatusText("SPEAKING");
           await Promise.resolve(auraSpeak(toSpokenText(visionReply)));
           setStatusText("SYSTEM ONLINE");
           
           setCommandDetails({
             title: "Image Analysis",
             category: "Vision",
             match: "100%", type: "text", data: visionReply,
           });
           
           return visionReply;
        }
      } catch (err) {
        console.error("File reading error:", err);
        // Fall through to standard text AI if file reading fails
      }
    }

    const profile = getUserProfile();
    const factsList = profile.facts?.length
      ? `Facts you remember about the user:\n- ${profile.facts.join("\n- ")}`
      : "";
    const userCtx =
      `The user's saved name is ${profile.name}.` +
      (factsList ? `\n${factsList}` : "") +
      (/\b(juanito|tamboong)\b/i.test(normalized)
        ? "\nFACT: Juanito Tamboong's girlfriend is Rizalyn Uy."
        : "");

    // FIX: If a document is loaded, NEVER treat the question as a short follow-up.
    const isFollowUp =
      !hasDocumentContext && (
        /\b(it|that|this|those|them|why|how come|what about|and then|what happened)\b/i.test(normalized) ||
        normalized.split(/\s+/).length <= 4
      );

    // FIX: If we have a document, we ALWAYS need long-form generation so the AI has room to answer
    const wantsLongForm =
      hasDocumentContext ||
      /\b(code|function|component|class|script|story|essay|list|steps|quiz|explain in detail|walk me through|answer|read|summarize)\b/i.test(normalized);

    const turns = getConversationTurns();
    const history = turnsToMessages(turns).slice(-16);
    const userMsg: ChatMessage = { role: "user", content: text };
    const messages = buildMessages([...history, userMsg], userCtx);

    addUserTurn(originalCommand);

    let partial = "";
    const reply = await askAIStream(messages, {
      signal,
      // FIX: If hasDocumentContext is true, allow up to 2500 tokens so the AI doesn't get cut off
      maxTokens: hasDocumentContext ? 2500 : (wantsLongForm ? 1200 : 220),
      temperature: wantsLongForm ? 0.7 : 0.6,
      onToken: (d) => {
        partial += d;
        onPartialReply?.(partial);
        setCommandDetails({
          title: text.toUpperCase(), category: isFollowUp ? "Conversation Follow-up" : "AI Knowledge",
          match: "STREAMING", type: "text", data: partial,
        });
      },
    });

    const finalReply = (reply || partial).trim() || "I couldn't find anything on that.";
    addAssistantTurn(finalReply);

    setStatusText("SPEAKING");
    await Promise.resolve(auraSpeak(toSpokenText(finalReply, wantsLongForm ? 8 : 3)));

    setStatusText("SYSTEM ONLINE");
    setCommandDetails({
      title: text.toUpperCase(),
      category: isFollowUp ? "Conversation Follow-up" : "AI Knowledge",
      match: "100%", type: "text", data: finalReply,
    });
    return finalReply;

  } catch (err) {
    if (err instanceof AuraApiError && err.kind === "aborted") return "";
    const msg =
      err instanceof AuraApiError
        ? err.kind === "auth" ? "My API key isn't valid. Please check configuration."
        : err.kind === "rate_limit" ? "I'm being rate limited. Give me a few seconds."
        : err.kind === "network" ? "I can't reach the AI service right now."
        : err.message
        : (err as Error)?.message || "Something went wrong.";
    setStatusText("SYSTEM ONLINE");
    setCommandDetails({ title: "Error", category: "System Error", match: "0%", type: "text", data: msg });
    await Promise.resolve(auraSpeak(msg));
    return msg;
  }
};