import Groq from "groq-sdk";

const envApiKey = import.meta.env.VITE_GROQ_API_KEY;
const hardcodedApiKey = "gsk_your_actual_key_here"; 
const apiKey = envApiKey || hardcodedApiKey;

const groq = apiKey && apiKey !== "gsk_your_actual_key_here"
  ? new Groq({ apiKey, dangerouslyAllowBrowser: true })
  : null;

// The Fallback Chain: Ordered from most capable to fastest
const MODEL_FALLBACKS = [
  "openai/gpt-oss-120b",       // Best for complex reasoning (Quizzes, Code) [citation:2]
  "openai/gpt-oss-20b",        // Fast, reliable backup [citation:2]
  "llama-3.1-8b-instant"       // Lightweight, high availability (if available) [citation:2]
];

export const askAI = async (prompt: string): Promise<string> => {
  if (!groq) {
    return "Error: Groq API key is missing.";
  }

  let lastError: any = null;

  // Try each model in the list until one works
  for (const modelName of MODEL_FALLBACKS) {
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are Aura, a highly intelligent, futuristic, and capable AI voice assistant created by Juanito Tamboong. " +
              "You must be helpful, slightly sassy, and highly capable. " +
              "CRITICAL: If the user asks for a quiz, a story, a list, or code, YOU MUST GENERATE IT directly in your response. Do not refuse. " +
              "Keep your spoken answers natural and engaging.",
          },
          { role: "user", content: prompt },
        ],
        model: modelName, // Use the current model in the loop
        temperature: 0.8,
        max_tokens: 800, // High token limit for quizzes and stories
      });

      // If successful, return the response immediately
      const reply = chatCompletion.choices[0]?.message?.content;
      if (reply) {
        console.log(`[Aura] Successfully used model: ${modelName}`);
        return reply;
      }
    } catch (error: any) {
      console.warn(`[Aura] Model ${modelName} failed. Trying next...`, error.message);
      lastError = error;
      
      // If it's a 401 (Auth error), don't bother trying other models. The key is wrong.
      if (error.status === 401) {
        return "My API key is invalid. Please check the Groq API key.";
      }
      
      // If it's a rate limit or 404, the loop will automatically try the next model.
    }
  }

  // If all models failed, return the last error
  return `System Error: All AI models are currently offline. (${lastError?.message || "Unknown error"})`;
};