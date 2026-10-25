// server/proxy.mjs
import "dotenv/config";
import http from "node:http";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.GROQ_API_KEY;
if (!KEY) {
  console.error("[proxy] GROQ_API_KEY is not set. Refusing to start.");
  process.exit(1);
}

const MODEL_WHITELIST = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.1-8b-instant",
]);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
  
  // Accept both /api/chat and /chat so it plays nice with Vite's proxy
  if (req.method !== "POST" || (req.url !== "/api/chat" && req.url !== "/chat")) {
    return json(res, 404, { error: "not found" });
  }

  let body;
  try { body = await readBody(req); } catch { return json(res, 400, { error: "bad json" }); }

  const { messages, model = "openai/gpt-oss-120b", max_tokens = 260, temperature = 0.6, stream = false } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(res, 400, { error: "messages[] required" });
  }
  if (!MODEL_WHITELIST.has(model)) {
    return json(res, 400, { error: `model not allowed: ${model}` });
  }

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: Math.min(Number(max_tokens) || 260, 4000),
      temperature: Math.max(0, Math.min(Number(temperature) || 0.6, 2)),
      stream: !!stream,
      reasoning_effort: "low", // Prevents the model from overthinking
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    const retryAfter = upstream.headers.get("retry-after");
    res.writeHead(upstream.status, {
      "content-type": "application/json",
      ...CORS,
      ...(retryAfter ? { "retry-after": retryAfter } : {}),
    });
    res.end(text || JSON.stringify({ error: "upstream error" }));
    return;
  }

  if (!stream) {
    const text = await upstream.text();
    res.writeHead(200, { "content-type": "application/json", ...CORS });
    res.end(text);
    return;
  }

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    ...CORS,
  });
  const nodeStream = Readable.fromWeb(upstream.body);
  nodeStream.on("error", () => res.end());
  nodeStream.pipe(res);
});

server.listen(PORT, () => console.log(`[proxy] listening on http://localhost:${PORT}`));