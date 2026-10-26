/**
 * src/api/aura-api.ts
 *
 * Aura AI transport:
 * - Text chat with conversation history.
 * - Real token streaming.
 * - Image recognition using Groq's multimodal vision model.
 * - Typed API errors with useful proxy error messages.
 * - AbortSignal support and request timeouts.
 * - Optional direct-browser SDK for development only.
 */

import Groq from "groq-sdk";

// ── Message types ──────────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant";

export type ChatContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatContentPart[];
}

export interface AskAIOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onToken?: (delta: string) => void;
}

// ── Model configuration ────────────────────────────────────────────

const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODELS = ["openai/gpt-oss-20b"];

// Vision model for image + text requests.
const VISION_MODEL = "qwen/qwen3.8-27b";

const DIRECT_KEY = (
  import.meta.env.VITE_GROQ_API_KEY as string | undefined
)?.trim();

const ALLOW_DIRECT =
  (import.meta.env.VITE_ALLOW_INSECURE_DIRECT as string | undefined) ===
  "1";

const RAW_PROXY = (
  import.meta.env.VITE_PROXY_URL as string | undefined
)?.trim();

const PROXY_URL = (
  RAW_PROXY ||
  (import.meta.env.DEV ? "http://localhost:8787" : "")
).replace(/\/$/, "");

if (DIRECT_KEY && ALLOW_DIRECT) {
  console.warn(
    "[Aura] INSECURE DIRECT MODE is enabled. " +
      "Your Groq key may be exposed in the browser bundle. " +
      "Do not deploy this configuration publicly."
  );
}

const groq =
  DIRECT_KEY && ALLOW_DIRECT
    ? new Groq({
        apiKey: DIRECT_KEY,
        dangerouslyAllowBrowser: true,
      })
    : null;

export const isAuraApiConfigured = (): boolean =>
  Boolean(groq || PROXY_URL);

// ── Typed errors ───────────────────────────────────────────────────

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

  if (e?.name === "AbortError") {
    return new AuraApiError("aborted", "The request was cancelled.");
  }

  if (e?.name === "TimeoutError") {
    return new AuraApiError(
      "timeout",
      "The AI service took too long to respond."
    );
  }

  const status = e?.status;

  const retryAfter = e?.response?.headers?.get?.("retry-after");

  const retryAfterMs = retryAfter
    ? Number.parseInt(retryAfter, 10) * 1000
    : undefined;

  const originalMessage =
    typeof e?.message === "string" ? e.message : "Unknown AI error.";

  if (status === 401 || status === 403) {
    return new AuraApiError(
      "auth",
      originalMessage || "The API key was rejected.",
      status
    );
  }

  if (status === 429) {
    return new AuraApiError(
      "rate_limit",
      originalMessage || "The AI service rate limit was reached.",
      status,
      retryAfterMs
    );
  }

  if (status === 400) {
    return new AuraApiError(
      "bad_response",
      originalMessage || "The AI service rejected the request.",
      status
    );
  }

  if (status === 404) {
    return new AuraApiError(
      "bad_response",
      originalMessage || "The requested AI model was not found.",
      status
    );
  }

  if (typeof status === "number" && status >= 500) {
    return new AuraApiError("network", originalMessage, status);
  }

  if (/fetch|network|failed to fetch/i.test(originalMessage)) {
    return new AuraApiError("network", originalMessage);
  }

  return new AuraApiError("unknown", originalMessage, status);
};

// ── Aura personality ───────────────────────────────────────────────

export const AURA_SYSTEM_PROMPT = [
  "You are Aura, a warm, quick-witted voice companion created by Juanito Tamboong.",
  "Speak naturally, like a friendly voice companion.",
  "Use short sentences, contractions, and natural conversational rhythm.",
  "When the user greets you, greet them back briefly.",
  "For casual conversation, usually reply in one or two short sentences.",
  "Do not use lists, headings, or Markdown unless requested.",
  "Use recent conversation history to understand follow-up questions.",
  "If the user says 'why?', 'what about it?', or 'that did not work', resolve it against the recent conversation.",
  "Never say 'Certainly!', 'Great question!', or 'As an AI language model'.",
  "Do not claim to be human or to have feelings.",
].join("\n");

const AURA_VISION_PROMPT = [
  "You are Aura, an image-aware voice assistant.",
  "Carefully inspect the actual image supplied by the user.",
  "Describe visible objects, characters, colors, text, and important details accurately.",
  "Answer the user's question about the image directly.",
  "Do not claim an object or detail is visible unless the image supports that conclusion.",
  "If the image is unclear, explain which details are uncertain.",
  "If asked to identify a fictional character, give the likely character name when recognizable.",
  "Use a natural, concise response suitable for being spoken aloud.",
].join("\n");

// ── Conversation messages ──────────────────────────────────────────

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
    if (outerSignal.aborted) {
      controller.abort();
    } else {
      outerSignal.addEventListener("abort", linkAbort, {
        once: true,
      });
    }
  }

  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("The AI request timed out.");
      error.name = "TimeoutError";

      controller.abort();
      reject(error);
    }, ms);
  });

  // Prevent a synchronous factory error from bypassing cleanup.
  const work = Promise.resolve().then(() => factory(controller.signal));

  return Promise.race([work, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);

    if (outerSignal) {
      outerSignal.removeEventListener("abort", linkAbort);
    }
  });
};

// ── Proxy URL ──────────────────────────────────────────────────────

const getProxyEndpoint = (): string => {
  if (!PROXY_URL) {
    throw new AuraApiError(
      "no_key",
      "No AI transport is configured. Start the local proxy or set VITE_PROXY_URL."
    );
  }

  const base = PROXY_URL.replace(/\/+$/, "");

  if (base.endsWith("/api/chat") || base.endsWith("/chat")) {
    return base;
  }

  if (base.endsWith("/api")) {
    return `${base}/chat`;
  }

  return `${base}/api/chat`;
};

// ── Proxy request ──────────────────────────────────────────────────

const proxyCall = async (
  messages: ChatMessage[],
  options: AskAIOptions & {
    stream: boolean;
    model: string;
  },
  signal?: AbortSignal
): Promise<Response> => {
  const endpoint = getProxyEndpoint();

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages,
        model: options.model,
        max_tokens: options.maxTokens ?? 260,
        temperature: options.temperature ?? 0.6,
        stream: options.stream,
        reasoning_effort: "low",
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw new AuraApiError("aborted", "The request was cancelled.");
    }

    throw classify(error);
  }

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");

    // Preserve the actual proxy/Groq error instead of hiding it
    // behind a generic "proxy 400" message.
    const responseText = await response.text().catch(() => "");

    let detail = responseText;

    try {
      const parsed = JSON.parse(responseText);
      detail =
        parsed?.error?.message ||
        parsed?.message ||
        parsed?.error ||
        responseText;
    } catch {
      // The server may return plain text rather than JSON.
    }

    if (typeof detail !== "string") {
      detail = JSON.stringify(detail);
    }

    const message =
      detail.trim().slice(0, 1200) ||
      `AI proxy returned HTTP ${response.status}.`;

    const error = new AuraApiError(
      response.status === 401 || response.status === 403
        ? "auth"
        : response.status === 429
          ? "rate_limit"
          : response.status === 400 || response.status === 404
            ? "bad_response"
            : response.status >= 500
              ? "network"
              : "unknown",
      message,
      response.status,
      retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : undefined
    );

    throw error;
  }

  return response;
};

// ── Extract response text ──────────────────────────────────────────

const extractMessageText = (content: unknown): string => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .join("")
      .trim();
  }

  return "";
};

const readCompletion = async (response: Response): Promise<string> => {
  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new AuraApiError(
      "bad_response",
      "The AI service returned an invalid response."
    );
  }

  const answer = extractMessageText(
    data?.choices?.[0]?.message?.content
  );

  if (!answer) {
    throw new AuraApiError(
      "bad_response",
      "The AI service returned an empty response."
    );
  }

  return answer;
};

// ── Standard text chat ─────────────────────────────────────────────

export async function askAI(
  input: string | ChatMessage[],
  options: AskAIOptions = {}
): Promise<string> {
  const messages: ChatMessage[] =
    typeof input === "string"
      ? buildMessages([{ role: "user", content: input }])
      : input;

  let lastError: AuraApiError | null = null;

  for (const model of [PRIMARY_MODEL, ...FALLBACK_MODELS]) {
    try {
      if (groq) {
        const completion: any = await withTimeout(
          (signal) =>
            groq.chat.completions.create(
              {
                messages: messages as any,
                model,
                temperature: options.temperature ?? 0.6,
                max_tokens: options.maxTokens ?? 260,
                stream: false,
              },
              { signal }
            ) as unknown as Promise<any>,
          25_000,
          options.signal
        );

        const answer = extractMessageText(
          completion?.choices?.[0]?.message?.content
        );

        if (answer) return answer;

        lastError = new AuraApiError(
          "bad_response",
          "The AI service returned an empty response."
        );
      } else {
        const response = await withTimeout(
          (signal) =>
            proxyCall(
              messages,
              {
                ...options,
                stream: false,
                model,
              },
              signal
            ),
          25_000,
          options.signal
        );

        return await readCompletion(response);
      }
    } catch (error) {
      const classified = classify(error);

      if (
        classified.kind === "auth" ||
        classified.kind === "rate_limit" ||
        classified.kind === "aborted" ||
        classified.kind === "timeout"
      ) {
        throw classified;
      }

      lastError = classified;
    }
  }

  throw lastError ?? new AuraApiError("unknown", "The AI request failed.");
}

// ── Convert browser image URLs into API-compatible image data ──────

const imageUrlToDataUrl = async (
  imageUrl: string,
  signal?: AbortSignal
): Promise<string> => {
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new AuraApiError(
      "bad_response",
      "No image was provided to Aura."
    );
  }

  // Already encoded: use it directly.
  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  // Browser blob URLs are local to the browser and cannot be read
  // by Groq's servers. Convert them into a data URL first.
  if (imageUrl.startsWith("blob:")) {
    try {
      const response = await fetch(imageUrl, { signal });

      if (!response.ok) {
        throw new Error(`Could not read the selected image (${response.status}).`);
      }

      const blob = await response.blob();

      if (!blob.type.startsWith("image/")) {
        throw new Error("The selected file is not a supported image.");
      }

      // Keep the encoded image reasonably small.
      if (blob.size > 15 * 1024 * 1024) {
        throw new Error(
          "The image is too large. Please choose an image smaller than 15 MB."
        );
      }

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Could not encode the selected image."));
          }
        };

        reader.onerror = () => {
          reject(new Error("Failed to read the selected image."));
        };

        reader.onabort = () => {
          reject(new DOMException("Image reading was cancelled.", "AbortError"));
        };

        if (signal?.aborted) {
          reader.abort();
          return;
        }

        reader.readAsDataURL(blob);
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new AuraApiError("aborted", "The request was cancelled.");
      }

      throw new AuraApiError(
        "bad_response",
        error instanceof Error
          ? error.message
          : "Aura could not read the selected image."
      );
    }
  }

  // Public HTTP(S) image URLs can be passed directly to the vision API.
  if (/^https?:\/\//i.test(imageUrl)) {
    return imageUrl;
  }

  throw new AuraApiError(
    "bad_response",
    "Unsupported image URL. Use an image file, data URL, or accessible HTTP(S) image."
  );
};

// ── Vision / image recognition ─────────────────────────────────────

export async function askAIVision(
  imageUrl: string,
  prompt = "Describe this image.",
  options: AskAIOptions = {}
): Promise<string> {
  const signal = options.signal;

  const imageData = await withTimeout(
    (innerSignal) => imageUrlToDataUrl(imageUrl, innerSignal),
    15_000,
    signal
  );

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${AURA_SYSTEM_PROMPT}\n\n${AURA_VISION_PROMPT}`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt.trim() || "Describe this image.",
        },
        {
          type: "image_url",
          image_url: {
            url: imageData,
          },
        },
      ],
    },
  ];

  try {
    if (groq) {
      const completion: any = await withTimeout(
        (innerSignal) =>
          groq.chat.completions.create(
            {
              model: VISION_MODEL,
              messages: messages as any,
              max_tokens: options.maxTokens ?? 350,
              temperature: options.temperature ?? 0.4,
              stream: false,
            },
            { signal: innerSignal }
          ) as unknown as Promise<any>,
        45_000,
        signal
      );

      const answer = extractMessageText(
        completion?.choices?.[0]?.message?.content
      );

      if (answer) return answer;

      throw new AuraApiError(
        "bad_response",
        "The vision model returned an empty response."
      );
    }

    const response = await withTimeout(
      (innerSignal) =>
        proxyCall(
          messages,
          {
            ...options,
            model: VISION_MODEL,
            stream: false,
            maxTokens: options.maxTokens ?? 350,
            temperature: options.temperature ?? 0.4,
          },
          innerSignal
        ),
      45_000,
      signal
    );

    return await readCompletion(response);
  } catch (error) {
    throw classify(error);
  }
}

// ── Streaming response parser ──────────────────────────────────────

const isReadableStream = (
  value: any
): value is ReadableStream<Uint8Array> =>
  Boolean(value && typeof value.getReader === "function");

async function consumeStream(
  stream: AsyncIterable<any> | ReadableStream<Uint8Array> | null,
  onToken: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  let fullText = "";

  if (!stream) return fullText;

  if (isReadableStream(stream)) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    const processLine = (rawLine: string): boolean => {
      let line = rawLine.trim();

      if (!line || line.startsWith(":")) return false;

      if (line.startsWith("data:")) {
        line = line.slice(5).trim();
      }

      if (line === "[DONE]") return true;

      try {
        const data = JSON.parse(line);
        const delta = data?.choices?.[0]?.delta?.content;

        if (typeof delta === "string" && delta && !signal?.aborted) {
          fullText += delta;
          onToken(delta);
        }
      } catch {
        // Ignore incomplete or malformed SSE lines.
      }

      return false;
    };

    try {
      while (true) {
        if (signal?.aborted) {
          throw new AuraApiError("aborted", "The request was cancelled.");
        }

        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let index: number;

        while ((index = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);

          if (processLine(line)) return fullText;
        }
      }

      if (buffer.trim()) processLine(buffer);
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // The stream may already be released.
      }
    }

    return fullText;
  }

  for await (const chunk of stream as AsyncIterable<any>) {
    if (signal?.aborted) {
      throw new AuraApiError("aborted", "The request was cancelled.");
    }

    const delta = chunk?.choices?.[0]?.delta?.content;

    if (typeof delta === "string" && delta) {
      fullText += delta;
      onToken(delta);
    }
  }

  return fullText;
}

// ── Streaming text chat ────────────────────────────────────────────

export async function askAIStream(
  messages: ChatMessage[],
  options: AskAIOptions
): Promise<string> {
  if (!options.onToken) {
    return askAI(messages, options);
  }

  const onToken = options.onToken;
  const model = PRIMARY_MODEL;

  if (groq) {
    try {
      const stream: any = await groq.chat.completions.create(
        {
          messages: messages as any,
          model,
          temperature: options.temperature ?? 0.6,
          max_tokens: options.maxTokens ?? 260,
          stream: true,
        },
        { signal: options.signal }
      );

      return await consumeStream(stream, onToken, options.signal);
    } catch (error) {
      throw classify(error);
    }
  }

  const response = await proxyCall(
    messages,
    {
      ...options,
      stream: true,
      model,
    },
    options.signal
  );

  if (!response.body) {
    throw new AuraApiError(
      "bad_response",
      "The AI service did not return a readable stream."
    );
  }

  return consumeStream(response.body, onToken, options.signal);
}

// ── Speech cleanup ─────────────────────────────────────────────────

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

export const toSpokenText = (
  text: string,
  maxSentences = 3
): string => {
  let result = text
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

  const sentences = result.match(/[^.!?]+[.!?]+/g);

  if (sentences && sentences.length > maxSentences) {
    result = sentences.slice(0, maxSentences).join(" ").trim();
  }

  return result;
};

// ── Document Reading ───────────────────────────────────────────────

export async function readDocumentText(fileUrl: string, signal?: AbortSignal): Promise<string> {
  try {
    // 1. Fetch the file from Supabase URL
    const response = await fetch(fileUrl, { signal });
    if (!response.ok) throw new Error("Could not download the file.");

    // 2. Check the file type
    const contentType = response.headers.get("content-type") || "";

    // 3. If it's a plain text or CSV, read it as text
    if (contentType.includes("text") || contentType.includes("csv") || fileUrl.endsWith(".txt") || fileUrl.endsWith(".csv")) {
      return await response.text();
    }

    // 4. If it's a PDF or Word doc, we can't easily parse it in the browser without a library.
    // For now, we will return a placeholder message. 
    // (To actually read PDFs, you would need to install `pdfjs-dist` via npm)
    if (contentType.includes("pdf") || fileUrl.endsWith(".pdf")) {
      return "This is a PDF document. Please summarize the contents based on the user's prompt if you have access to the URL.";
    }

    return "File format not natively supported for direct text extraction in the browser.";
  } catch (error) {
    console.error("Error reading document:", error);
    return "";
  }
}