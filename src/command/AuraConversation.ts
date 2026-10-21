// src/command/AuraConversation.ts

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

const MAX_TURNS = 10;
const CONTEXT_TTL_MS = 1000 * 60 * 5; // 5 minutes

let turns: ConversationTurn[] = [];

// --- User Profile Memory ---
export interface UserProfile {
  name: string;
  facts: string[];
}

const defaultProfile: UserProfile = {
  name: "Operator",
  facts: []
};

const loadProfile = (): UserProfile => {
  try {
    const saved = localStorage.getItem("aura_user_profile");
    if (!saved) return defaultProfile;
    
    const parsed = JSON.parse(saved) as UserProfile;
    let needsSaving = false;
    
    // AUTO-REPAIR: Fix corrupted names
    if (parsed.name) {
      const lowerName = parsed.name.toLowerCase();
      const badWords = ["save it", "check the database", "check", "database", "please", "thanks", "this"];
      if (badWords.some(word => lowerName.includes(word))) {
        console.warn("[Aura Memory] Detected corrupted name. Resetting...");
        parsed.name = "Operator";
        needsSaving = true;
      }
    }
    
    // AUTO-REPAIR: Clean up messy facts
    if (parsed.facts && parsed.facts.length > 0) {
      const cleanedFacts = parsed.facts.map(fact => {
        let cleaned = fact
          .replace(/\b(aura|this|my|the|a|an)\b/gi, "")
          .replace(/\s+/g, ' ')
          .trim();
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }).filter(fact => fact.length > 0); // Remove empty ones

      // If the array changed, update it
      if (JSON.stringify(cleanedFacts) !== JSON.stringify(parsed.facts)) {
        parsed.facts = cleanedFacts;
        needsSaving = true;
      }
    }
    
    if (needsSaving) {
      localStorage.setItem("aura_user_profile", JSON.stringify(parsed));
    }
    
    return parsed;
  } catch {
    return defaultProfile;
  }
};

let userProfile: UserProfile = loadProfile();

export const getUserProfile = (): UserProfile => userProfile;

export const saveUserProfile = (profile: Partial<UserProfile>) => {
  userProfile = { ...userProfile, ...profile };
  localStorage.setItem("aura_user_profile", JSON.stringify(userProfile));
};

// Function to clear all user memory manually via command
export const clearUserMemory = () => {
  userProfile = { name: "Operator", facts: [] };
  localStorage.removeItem("aura_user_profile");
};
// ---------------------------

const pushTurn = (turn: ConversationTurn) => {
  turns.push(turn);
  if (turns.length > MAX_TURNS) {
    turns = turns.slice(turns.length - MAX_TURNS);
  }
};

export const addUserTurn = (text: string) => {
  pushTurn({ role: "user", text, timestamp: Date.now() });
};

export const addAssistantTurn = (text: string) => {
  pushTurn({ role: "assistant", text, timestamp: Date.now() });
};

export const getConversationTurns = (): ConversationTurn[] => {
  if (turns.length > 0) {
    const last = turns[turns.length - 1].timestamp;
    if (Date.now() - last > CONTEXT_TTL_MS) {
      turns = [];
    }
  }
  return [...turns];
};

export const hasRecentConversation = (): boolean => {
  return getConversationTurns().length > 0;
};

export const clearConversation = () => {
  turns = [];
};

export const getConversationForPrompt = (): string => {
  const recent = getConversationTurns();
  if (recent.length === 0) return "";

  return recent
    .map((t) => `${t.role === "user" ? "User" : "Aura"}: ${t.text}`)
    .join("\n");
};