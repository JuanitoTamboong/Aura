// server/proxy.mjs
// Local Node proxy for Aura. Run with: node server/proxy.mjs
// Keep GROQ_API_KEY in the server .env file, never in VITE_ variables.

import "dotenv/config";
import http from "node:http";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_BODY_BYTES = 25 * 1024 * 1024; // Allows compressed base64 images under Groq's image limit.

if (!KEY) {
  console.error("[proxy] GROQ_API_KEY is not set. Refusing to start.");
  process.exit(1);
}

const MODEL_WHITELIST = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
  "llama-3.2-11b-vision-preview", // Added for Vision
]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-max-age": "86400",
  "vary": "Origin",
};

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    ...CORS,
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += Buffer.byteLength(chunk, "utf8");
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large. Use an image under 20 MB or a compressed image."));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON request body."));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // Accept both routes because Aura's frontend may use either URL.
  if (req.method !== "POST" || !["/api/chat", "/chat"].includes(new URL(req.url, "http://localhost").pathname)) {
    json(res, 404, { error: "Not found" });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    if (!res.headersSent && !res.writableEnded) {
      json(res, 400, { error: error instanceof Error ? error.message : "Invalid request body." });
    }
    return;
  }

  const messages = body?.messages;
  const model = typeof body?.model === "string" ? body.model : "openai/gpt-oss-120b";
  if (!Array.isArray(messages) || messages.length === 0) {
    json(res, 400, { error: "messages[] is required." });
    return;
  }

  if (!MODEL_WHITELIST.has(model)) {
    json(res, 400, { error: `Model not allowed: ${model}` });
    return;
  }

  for (const message of messages) {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      !(typeof message.content === "string" || Array.isArray(message.content))
    ) {
      json(res, 400, { error: "Each message must have a valid role and string or multimodal content." });
      return;
    }
  }

  const rawTokens = Number(body.max_tokens);
  const max_tokens = Math.max(1, Math.min(Number.isFinite(rawTokens) && rawTokens > 0 ? rawTokens : 500, 4000));
  const rawTemperature = Number(body.temperature);
  const temperature = Math.max(0, Math.min(Number.isFinite(rawTemperature) ? rawTemperature : 0.6, 2));
  const stream = body.stream === true;

  const payload = {
    model,
    messages,
    max_tokens,
    temperature,
    stream,
    reasoning_effort: body.reasoning_effort || "low",
  };

  let upstream;
  try {
    upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    json(res, 502, {
      error: "Could not reach Groq.",
      details: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const retryAfter = upstream.headers.get("retry-after");
  const headers = {
    "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    ...CORS,
    ...(retryAfter ? { "retry-after": retryAfter } : {}),
  };

  // Pass useful upstream errors through unchanged.
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    res.writeHead(upstream.status, headers);
    res.end(text || JSON.stringify({ error: "Groq upstream request failed." }));
    return;
  }

  if (!stream) {
    const text = await upstream.text();
    res.writeHead(upstream.status, headers);
    res.end(text);
    return;
  }

  res.writeHead(upstream.status, {
    ...headers,
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  });

  if (!upstream.body) {
    res.end();
    return;
  }

  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.on("error", (error) => {
    console.error("[proxy] upstream stream error:", error);
    if (!res.writableEnded) res.end();
  });
  res.on("close", () => nodeStream.destroy());
  nodeStream.pipe(res);
});

server.listen(PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PORT}`);
});