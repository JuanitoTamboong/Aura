import Groq from "groq-sdk";

// 1. Try to read from the .env file (works locally)
const envApiKey = import.meta.env.VITE_GROQ_API_KEY;

// 2. Fallback: Paste your actual Groq API key here.
// This guarantees it works inside the .exe even if the .env file fails to load.
const hardcodedApiKey = "gsk_your_actual_key_here"; 

const apiKey = envApiKey || hardcodedApiKey;

const groq = apiKey && apiKey !== "gsk_your_actual_key_here"
  ? new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
    })
  : null;

export const askAI = async (prompt: string): Promise<string> => {
  try {
    if (!groq) {
      throw new Error(
        "Groq API key is missing. Please add it to the hardcodedApiKey variable in aura-api.ts."
      );
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are Aura, a futuristic, helpful, and slightly sassy AI voice assistant created by Juanito Tamboong. Keep your answers helpful, detailed, and conversational, but concise (under 3 sentences).",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "openai/gpt-oss-20b",
      temperature: 0.7,
      max_tokens: 150,
    });

    return (
      chatCompletion.choices[0]?.message?.content ||
      "I didn't catch that."
    );
  } catch (error: unknown) {
    console.error("Aura Groq API error:", error);

    if (error instanceof Error) {
      console.error("Error message:", error.message);
    }

    const apiError = error as {
      status?: number;
      message?: string;
      error?: { message?: string };
    };

    if (apiError.status === 401) {
      return "My API key is invalid. Please check the Groq API key.";
    }

    if (apiError.status === 403) {
      return "Access denied by Groq. Check your API key and permissions.";
    }

    if (apiError.status === 429) {
      return "Groq rate limit reached. Please try again shortly.";
    }

    return `System Error: ${
      apiError.error?.message ||
      apiError.message ||
      (error instanceof Error
        ? error.message
        : "My AI brain is currently offline.")
    }`;
  }
};