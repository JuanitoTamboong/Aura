import Groq from "groq-sdk";

const groq = new Groq({ 
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true 
});

export const askAI = async (prompt: string): Promise<string> => {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are Aura, a futuristic, helpful, and slightly sassy AI voice assistant created by Juanito Tamboong. Keep your answers helpful, detailed, and conversational, but concise (under 3 sentences)." 
        },
        { role: "user", content: prompt }
      ],
      // FIX 1: Use a valid Groq model (Llama 3 is excellent and fast)
   model: "openai/gpt-oss-20b",
      temperature: 0.7,
      max_tokens: 150,
    });
    return chatCompletion.choices[0]?.message?.content || "I didn't catch that.";
  } catch (error: any) {
    console.error("🔥 Groq API Error Details:", error);
    
    // FIX 2: Return the actual error so you can see it in the UI
    if (error.status === 401) {
      return "My API key is invalid. Please check the .env file.";
    }
    return `System Error: ${error.message || "My AI brain is currently offline."}`;
  }
};