// src/api/aura-api.ts

export const askAI = async (prompt: string): Promise<string> => {
  try {
    const systemPrompt = "You are Aura, a futuristic, helpful, and slightly sassy AI voice assistant created by Juanito Tamboong. Keep your answers helpful, detailed, and conversational, but concise (under 3 sentences) because your answers are spoken aloud via text-to-speech.";
    
    const fullPrompt = encodeURIComponent(`${systemPrompt}\n\nUser: ${prompt}\nAura:`);

    const response = await fetch(`https://text.pollinations.ai/${fullPrompt}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const aiReply = await response.text();
    return aiReply.trim();
    
  } catch (error) {
    console.error("AI Fetch Error:", error);
    throw new Error("My AI brain is currently offline. Please check your internet connection or API key.");
  }
};