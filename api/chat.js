// api/chat.js
// Serverless/Edge proxy for Groq Chat Completions.
// Keep GROQ_API_KEY on the server; never expose it as VITE_GROQ_API_KEY.

export const config = { runtime: "edge" };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODEL_WHITELIST = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "llama-3.2-11b-vision-preview", // Added for Vision
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Vary": "Origin",
};

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Server configuration error: GROQ_API_KEY is not set." }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request body." }, 400);
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "messages[] is required." }, 400);
  }

  const model = typeof body.model === "string" ? body.model : "openai/gpt-oss-120b";
  if (!MODEL_WHITELIST.has(model)) {
    return jsonResponse({ error: `Model not allowed: ${model}` }, 400);
  }

  // Validate message shapes but preserve multimodal content arrays (text + image_url).
  for (const message of body.messages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      !(typeof message.content === "string" || Array.isArray(message.content))
    ) {
      return jsonResponse({ error: "Each message must have a valid role and string or multimodal content." }, 400);
    }
  }

  const requestedTokens = Number(body.max_tokens);
  const maxTokens = Math.max(1, Math.min(Number.isFinite(requestedTokens) && requestedTokens > 0 ? requestedTokens : 500, 4000));
  const requestedTemperature = Number(body.temperature);
  const temperature = Math.max(0, Math.min(Number.isFinite(requestedTemperature) ? requestedTemperature : 0.6, 2));
  const stream = body.stream === true;

  const payload = {
    model,
    messages: body.messages,
    max_tokens: maxTokens,
    temperature,
    stream,
    // Qwen 3.8 and GPT-OSS both accept low reasoning effort.
    reasoning_effort: body.reasoning_effort || "low",
  };

  try {
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const responseHeaders = {
      ...CORS_HEADERS,
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    };
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) responseHeaders["Retry-After"] = retryAfter;

    // Return the upstream error body too, so the frontend can show the real reason.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return jsonResponse(
      { error: "Could not reach Groq.", details: error instanceof Error ? error.message : String(error) },
      502,
    );
  }
}