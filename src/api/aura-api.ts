import Groq from "groq-sdk";

const groq = new Groq({ 
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

export const askAI = async (prompt: string): Promise<string> => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are Aura, a futuristic, helpful, and slightly sassy AI voice assistant created by Juanito Tamboong. Keep your answers helpful, detailed, and conversational, but concise (under 3 sentences)." },
        { role: "user", content: prompt }
      ],
    model: "openai/gpt-oss-20b",
      temperature: 0.7,
      max_tokens: 150,
    });
    return chatCompletion.choices[0]?.message?.content || "I didn't catch that.";
  } catch (error: any) {
    console.error("🔥 Groq API Error:", error);
    throw new Error("My AI brain is currently offline. Please check your internet connection or API key.");
  }
};