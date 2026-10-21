
import Groq from "groq-sdk";

const apiKey = import.meta.env.VITE_GROQ_API_KEY as
  | string
  | undefined;

const groq = apiKey?.trim()
  ? new Groq({
      apiKey: apiKey.trim(),
      dangerouslyAllowBrowser: true,
    })
  : null;

const MODEL_FALLBACKS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
];

export const askAI = async (prompt: string): Promise<string> => {
  if (!groq) {
    return "Groq API key is missing. Please configure your environment.";
  }

  let lastError: unknown;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are Aura, a capable futuristic AI voice assistant. " +
              "Be helpful, natural, concise, and slightly witty. " +
              "Generate requested quizzes, stories, lists, and code directly. " +
              "Keep spoken responses clear and conversational.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        model: modelName,
        temperature: 0.7,
        max_tokens: 800,
      });

      const reply = completion.choices[0]?.message?.content;

      if (typeof reply === "string" && reply.trim()) {
        console.info(`[Aura] AI response received using ${modelName}`);
        return reply.trim();
      }

      lastError = new Error(`Model ${modelName} returned an empty response.`);
    } catch (error: unknown) {
      lastError = error;

      const apiError = error as {
        status?: number;
        message?: string;
      };

      console.error(
        `[Aura] Model ${modelName} failed:`,
        apiError.message ?? "Unknown API error"
      );

      if (apiError.status === 401) {
        return "My Groq API key is invalid. Please check your API configuration.";
      }

      if (apiError.status === 403) {
        return "Groq access was denied. Please check your API permissions.";
      }

      // Try the next model for other errors.
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : "Unknown error";

  console.error("[Aura] All fallback models failed:", message);

  return "I'm having trouble connecting to my AI service. Please try again.";
};
