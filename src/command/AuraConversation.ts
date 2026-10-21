// src/command/AuraConversation.ts

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

const MAX_TURNS = 10;
const CONTEXT_TTL_MS = 1000 * 60 * 5; // 5 minutes

let turns: ConversationTurn[] = [];

// --- NEW: User Profile Memory ---
export interface UserProfile {
  name: string;
  facts: string[]; // Things Aura learns about you
}

const defaultProfile: UserProfile = {
  name: "Operator", // Default if Aura doesn't know your name
  facts: []
};

// Load profile from browser memory on startup
const loadProfile = (): UserProfile => {
  try {
    const saved = localStorage.getItem("aura_user_profile");
    return saved ? JSON.parse(saved) : defaultProfile;
  } catch {
    return defaultProfile;
  }
};

let userProfile: UserProfile = loadProfile();

export const getUserProfile = (): UserProfile => {
  return userProfile;
};

export const saveUserProfile = (profile: Partial<UserProfile>) => {
  userProfile = { ...userProfile, ...profile };
  localStorage.setItem("aura_user_profile", JSON.stringify(userProfile));
};
// ---------------------------------

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
  // Note: We don't clear the user profile here, so Aura still remembers your name after clearing chat.
};

export const getConversationForPrompt = (): string => {
  const recent = getConversationTurns();
  if (recent.length === 0) return "";

  return recent
    .map((t) => `${t.role === "user" ? "User" : "Aura"}: ${t.text}`)
    .join("\n");
};