import React, { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaStop, FaTrash, FaXmark, FaPlus } from "react-icons/fa6";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import auraLogo from "../assets/images/Aura-Logo-fix.webp";
import "../css/AuraWorkspace.css";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  streaming?: boolean;
  category?: string;
  // 1. Added mediaItems so the chat can hold images/videos
  mediaItems?: Array<{ url: string; type: "image" | "video" }>; 
}

interface AuraWorkspaceProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
  onClose: () => void;
  isProcessing: boolean;
  isListening: boolean;
  lightMode: boolean;
  transcriptText: string;
}

const SUGGESTIONS = [
  "What's the weather like today?",
  "Play some lo-fi music",
  "Set a timer for 10 minutes",
  "What time is it?",
  "Tell me a joke",
  "Search for React tutorials",
];

const AuraWorkspace: React.FC<AuraWorkspaceProps> = ({
  messages,
  onSend,
  onStop,
  onClear,
  onClose,
  isProcessing,
  isListening,
  lightMode,
  transcriptText,
}) => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll to bottom when new messages arrive / streaming updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Hide suggestions once the user sends something
  useEffect(() => {
    if (messages.length > 0) setShowSuggestions(false);
  }, [messages.length]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;
    onSend(trimmed);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`aura-workspace ${lightMode ? "aura-workspace-light" : ""}`}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="aura-ws-header">
        <div className="aura-ws-header-left">
          <div className="aura-ws-icon">
            <span className="aura-ws-icon-dot" />
          </div>
          <div>
            <h2>Workspace</h2>
            <p>
              {isProcessing
                ? "Aura is thinking…"
                : isListening
                ? "Listening…"
                : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>
        <div className="aura-ws-header-actions">
          <button
            type="button"
            className="aura-ws-icon-btn"
            title="New conversation"
            onClick={onClear}
            disabled={messages.length === 0}
          >
            <FaPlus />
          </button>
          <button
            type="button"
            className="aura-ws-icon-btn"
            title="Clear conversation"
            onClick={onClear}
            disabled={messages.length === 0}
          >
            <FaTrash />
          </button>
          <button type="button" className="aura-ws-icon-btn" title="Close workspace" onClick={onClose}>
            <FaXmark />
          </button>
        </div>
      </div>

      {/* ── Message Stream ───────────────────────────────────── */}
      <div className="aura-ws-stream" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="aura-ws-empty">
            <div className="aura-ws-empty-orb">
              <div className="aura-ws-empty-ring" />
              <div className="aura-ws-empty-ring aura-ws-empty-ring-two" />
              <img src={auraLogo} alt="Aura" className="aura-ws-empty-logo" />
            </div>
            <h3>Start a conversation</h3>
            <p>Type a message to talk to Aura.</p>

            {showSuggestions && (
              <div className="aura-ws-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="aura-ws-suggestion"
                    onClick={() => {
                      onSend(s);
                      setShowSuggestions(false);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`aura-ws-msg aura-ws-msg-${msg.role} ${
                msg.streaming ? "is-streaming" : ""
              }`}
            >
              {msg.role === "assistant" && (
                <div className="aura-ws-avatar">
                  <img src={auraLogo} alt="Aura" className="aura-ws-avatar-img" />
                </div>
              )}
              <div className="aura-ws-bubble-wrap">
                <div className="aura-ws-bubble">
                  {msg.role === "assistant" ? (
                    <div className="aura-ws-markdown">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" />
                          )
                        }}
                      >
                        {msg.content || "…"}
                      </ReactMarkdown>

                      {/* 2. Render Media Items (Images/Videos) inside the bubble */}
                      {msg.mediaItems && msg.mediaItems.length > 0 && (
                        <div className="aura-ws-media-grid">
                          {msg.mediaItems.map((media, idx) => (
                            <div key={idx} className="aura-ws-media-item">
                              {media.type === "image" ? (
                                <img src={media.url} alt="Aura Media" loading="lazy" />
                              ) : (
                                <video src={media.url} controls />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.streaming && <span className="aura-ws-cursor" />}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                <div className="aura-ws-meta">
                  <span>{formatTime(msg.timestamp)}</span>
                  {msg.category && (
                    <>
                      <span className="aura-ws-meta-dot">·</span>
                      <span className="aura-ws-meta-cat">{msg.category}</span>
                    </>
                  )}
                </div>
              </div>
              {msg.role === "user" && (
                <div className="aura-ws-avatar aura-ws-avatar-user">
                  <span>U</span>
                </div>
              )}
            </div>
          ))
        )}

        {isProcessing && messages[messages.length - 1]?.role === "user" && (
          <div className="aura-ws-msg aura-ws-msg-assistant">
            <div className="aura-ws-avatar">
              <img src={auraLogo} alt="Aura" className="aura-ws-avatar-img" />
            </div>
            <div className="aura-ws-bubble-wrap">
              <div className="aura-ws-bubble aura-ws-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Live transcript chip ─────────────────────────────── */}
      {isListening && transcriptText && (
        <div className="aura-ws-transcript">
          <span className="aura-ws-transcript-dot" />
          <span>{transcriptText}</span>
        </div>
      )}

      {/* ── Composer ─────────────────────────────────────────── */}
      <div className="aura-ws-composer">
        <div className="aura-ws-composer-inner">
          <textarea
            ref={inputRef}
            className="aura-ws-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message Aura…  (Shift+Enter for new line)"
            rows={1}
            disabled={isProcessing}
          />
          <div className="aura-ws-composer-actions">
            {isProcessing ? (
              <button type="button" className="aura-ws-send is-stop" title="Stop" onClick={onStop}>
                <FaStop />
              </button>
            ) : (
              <button
                type="button"
                className="aura-ws-send"
                title="Send"
                onClick={handleSubmit}
                disabled={!input.trim()}
              >
                <FaPaperPlane />
              </button>
            )}
          </div>
        </div>
        <div className="aura-ws-footer-hint">
          <span>Aura can make mistakes. Verify important info.</span>
          <span className="aura-ws-footer-key">
            <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuraWorkspace;