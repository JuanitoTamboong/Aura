// src/api/aura-api.ts
//
// Aura AI transport.
// - Real message-role history (system/user/assistant), never string-stuffed.
// - True token streaming (Groq SSE), not a fake loading animation.
// - Typed errors so UI can distinguish auth / rate-limit / network / timeout.
// - Single-flight per request via AbortSignal; callers own the controller.
// - Direct-browser SDK is disabled unless VITE_ALLOW_INSECURE_DIRECT=1
//   (dev-only). Production MUST route through /api/chat.
//
import Groq from "groq-sdk";

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AskAIOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onToken?: (delta: string) => void; // presence => streaming path
}

// ── Config ─────────────────────────────────────────────────────────
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODELS = ["openai/gpt-oss-20b"];

const DIRECT_KEY = (import.meta.env.VITE_GROQ_API_KEY as string | undefined)?.trim();
const ALLOW_DIRECT =
  (import.meta.env.VITE_ALLOW_INSECURE_DIRECT as string | undefined) === "1";

// PROXY_URL is required for production. In dev, default to the local proxy so
// the app works out of the box without extra env vars.
const RAW_PROXY = (import.meta.env.VITE_PROXY_URL as string | undefined)?.trim();
const PROXY_URL = (
  RAW_PROXY ||
  (import.meta.env.DEV ? "http://localhost:8787" : "")
).replace(/\/$/, "");

if (DIRECT_KEY && ALLOW_DIRECT) {
  console.warn(
    "[Aura] INSECURE DIRECT MODE. The Groq API key is in the client bundle. " +
      "Never deploy this build publicly."
  );
}

const groq =
  DIRECT_KEY && ALLOW_DIRECT
    ? new Groq({ apiKey: DIRECT_KEY, dangerouslyAllowBrowser: true })
    : null;

export const isAuraApiConfigured = (): boolean => {
  if (groq) return true;
  return PROXY_URL.length > 0;
};

// ── Typed errors ────────────────────────────────────────────────────
export type AuraApiErrorKind =
  | "no_key"
  | "auth"
  | "rate_limit"
  | "network"
  | "timeout"
  | "bad_response"
  | "aborted"
  | "unknown";

export class AuraApiError extends Error {
  kind: AuraApiErrorKind;
  status?: number;
  retryAfterMs?: number;
  constructor(
    kind: AuraApiErrorKind,
    message: string,
    status?: number,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = "AuraApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const classify = (err: unknown): AuraApiError => {
  if (err instanceof AuraApiError) return err;
  const e = err as any;
  if (e?.name === "AbortError") return new AuraApiError("aborted", "Cancelled.");
  if (e?.name === "TimeoutError") return new AuraApiError("timeout", "AI service timed out.");
  const status = e?.status;
  const retryAfter = e?.response?.headers?.get?.("retry-after");
  const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
  if (status === 401 || status === 403)
    return new AuraApiError("auth", "API key rejected.", status);
  if (status === 429)
    return new AuraApiError("rate_limit", "Rate limited.", status, retryAfterMs);
  if (status === 404)
    return new AuraApiError("bad_response", "Model unavailable.", status);
  if (typeof status === "number" && status >= 500)
    return new AuraApiError("network", "AI backend error.", status);
  if (/fetch|network|Failed to fetch/i.test(e?.message || ""))
    return new AuraApiError("network", "Network error.");
  return new AuraApiError("unknown", e?.message || "Unknown error", status);
};

// ── System prompt (voice-first personality) ────────────────────────
export const AURA_SYSTEM_PROMPT = [
  "You are Aura, a warm, quick-witted voice companion created by Juanito Tamboong.",
  "You speak like a friend on a phone call: short sentences, contractions, natural rhythm.",
  "Hard rules:",
  "- If the user greets you, greet them back briefly. Never answer a greeting with a canned question.",
  "- For casual chat, reply in 1–2 short sentences. No lists. No headings. No bullet points. No markdown.",
  "- Only produce lists, code, steps, or long explanations when the user explicitly asks for them.",
  "- If the user says 'why?', 'what about it?', 'that didn't work', resolve against recent turns.",
  "- Never say: 'Certainly!', 'Great question!', 'As an AI language model', 'Is there anything else'.",
  "- Do not use asterisks for actions, do not role-play, do not claim to be human or to have feelings.",
].join("\n");

export const buildMessages = (
  turns: ChatMessage[],
  extraSystem?: string
): ChatMessage[] => [
  {
    role: "system",
    content: extraSystem
      ? `${AURA_SYSTEM_PROMPT}\n\n${extraSystem}`
      : AURA_SYSTEM_PROMPT,
  },
  ...turns,
];

// ── Timeout helper ─────────────────────────────────────────────────
const withTimeout = <T>(
  factory: (signal: AbortSignal) => Promise<T>,
  ms: number,
  outerSignal?: AbortSignal
): Promise<T> => {
  const controller = new AbortController();
  const linkAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener("abort", linkAbort, { once: true });
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error("TimeoutError");
      e.name = "TimeoutError";
      try { controller.abort(); } catch {}
      reject(e);
    }, ms);
  });

  const work = factory(controller.signal);

  return Promise.race([work, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener("abort", linkAbort);
  });
};

// ── Proxy call ─────────────────────────────────────────────────────
const proxyCall = async (
  messages: ChatMessage[],
  o: AskAIOptions & { stream: boolean; model: string },
  signal?: AbortSignal
): Promise<Response> => {
  if (!PROXY_URL) {
    throw new AuraApiError(
      "no_key",
      "No AI transport configured. Set VITE_PROXY_URL (or run `npm run dev:server` in dev)."
    );
  }

  // Smart URL builder to prevent double /api/api/chat errors
  const base = PROXY_URL.endsWith("/") ? PROXY_URL.slice(0, -1) : PROXY_URL;
  const endpoint = base.endsWith("/chat") 
    ? base 
    : (base.endsWith("/api") ? `${base}/chat` : `${base}/api/chat`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      model: o.model,
      max_tokens: o.maxTokens ?? 260,
      temperature: o.temperature ?? 0.6,
      stream: o.stream,
      reasoning_effort: "low",
    }),
    signal,
  });
  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after");
    const err: any = new Error(`proxy ${res.status}`);
    err.status = res.status;
    if (retryAfter) {
      err.response = { headers: new Headers({ "retry-after": retryAfter }) };
    }
    throw classify(err);
  }
  return res;
};

// ── Non-streaming ──────────────────────────────────────────────────
export async function askAI(
  input: string | ChatMessage[],
  opts: AskAIOptions = {}
): Promise<string> {
  const messages: ChatMessage[] =
    typeof input === "string"
      ? buildMessages([{ role: "user", content: input }])
      : input;

  let lastErr: AuraApiError | null = null;

  for (const model of [PRIMARY_MODEL, ...FALLBACK_MODELS]) {
    try {
      if (groq) {
        const completion: any = await withTimeout(
          (signal) =>
            groq.chat.completions.create(
              {
                messages: messages as any,
                model,
                temperature: opts.temperature ?? 0.6,
                max_tokens: opts.maxTokens ?? 260,
                stream: false,
              },
              { signal }
            ) as unknown as Promise<any>,
          25_000,
          opts.signal
        );
        const text = completion?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) return text.trim();
        lastErr = new AuraApiError("bad_response", "Empty response.");
      } else {
        const res = await withTimeout(
          (signal) =>
            proxyCall(messages, { ...opts, stream: false, model }, signal),
          25_000,
          opts.signal
        );
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text === "string" && text.trim()) return text.trim();
        lastErr = new AuraApiError("bad_response", "Empty response.");
      }
    } catch (err) {
      const e = classify(err);
      if (
        e.kind === "auth" ||
        e.kind === "rate_limit" ||
        e.kind === "aborted" ||
        e.kind === "timeout"
      ) {
        throw e;
      }
      lastErr = e;
    }
  }

  throw lastErr ?? new AuraApiError("unknown", "AI service failed.");
}

// ── Streaming ──────────────────────────────────────────────────────
const isReadableStream = (x: any): x is ReadableStream<Uint8Array> =>
  !!x && typeof x.getReader === "function";

async function consumeStream(
  stream: AsyncIterable<any> | ReadableStream<Uint8Array> | null,
  onToken: (d: string) => void,
  signal?: AbortSignal
): Promise<string> {
  let full = "";
  if (!stream) return full;

  if (isReadableStream(stream)) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const flushLine = (rawLine: string) => {
      let line = rawLine.trim();
      if (!line || line.startsWith(":")) return false;
      if (line.startsWith("data:")) line = line.slice(5).trim();
      if (line === "[DONE]") return true;
      try {
        const obj = JSON.parse(line);
        const delta = obj?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta && !signal?.aborted) {
          full += delta;
          onToken(delta);
        }
      } catch {
        /* ignore malformed line */
      }
      return false;
    };

    try {
      while (true) {
        if (signal?.aborted) throw new AuraApiError("aborted", "Cancelled.");
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          const wasDone = flushLine(line);
          if (wasDone) return full;
        }
      }
      if (buf.trim()) flushLine(buf);
    } finally {
      try { reader.releaseLock(); } catch {}
    }

    return full;
  }

  for await (const chunk of stream as AsyncIterable<any>) {
    if (signal?.aborted) throw new AuraApiError("aborted", "Cancelled.");
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta) {
      full += delta;
      onToken(delta);
    }
  }
  return full;
}

export async function askAIStream(
  messages: ChatMessage[],
  opts: AskAIOptions
): Promise<string> {
  if (!opts.onToken) return askAI(messages, opts);
  const onToken = opts.onToken;
  const model = PRIMARY_MODEL;

  if (groq) {
    const stream: any = await groq.chat.completions.create(
      {
        messages: messages as any,
        model,
        temperature: opts.temperature ?? 0.6,
        max_tokens: opts.maxTokens ?? 260,
        stream: true,
      },
      { signal: opts.signal }
    );
    return consumeStream(stream, onToken, opts.signal);
  }

  const res = await proxyCall(messages, { ...opts, stream: true, model }, opts.signal);
  return consumeStream(res.body, onToken, opts.signal);
}

// ── Speech cleanup ─────────────────────────────────────────────────
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

export const toSpokenText = (text: string, maxSentences = 3): string => {
  let s = text
    .replace(/```[\s\S]*?```/g, " (code block) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")           
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")         
    .replace(/^\s*\d+\.\s+/gm, "")         
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = s.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > maxSentences) {
    s = sentences.slice(0, maxSentences).join(" ").trim();
  }
  return s;
};