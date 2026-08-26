"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Where is Bus Five now?",
  "Which bus has crossed Kasimedu?",
  "How long until R01 reaches campus?",
  "Show me all live buses",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm **Ritians Fleet Assistant**. I can tell you where any bus is, which stops it has crossed, and the ETA to its next stop or to RIT Campus.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, something went wrong. Try again.";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (_) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I couldn't reach the server. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="rt-chat-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        title="Chat with Ritians Fleet Assistant"
      >
        <i className={open ? "fas fa-xmark" : "fas fa-comment-dots"} />
        {!open && <span className="pulse-dot" />}
      </button>

      {open && (
        <div className="rt-chat-panel">
          <div className="rt-chat-header">
            <div className="avatar"><i className="fas fa-bus" /></div>
            <div className="info">
              <div className="name">Ritians Fleet Assistant</div>
              <div className="status">Online · AI-powered</div>
            </div>
            <button className="rt-chat-close" onClick={() => setOpen(false)} aria-label="Close">
              <i className="fas fa-xmark" />
            </button>
          </div>

          <div className="rt-chat-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`rt-chat-msg ${m.role === "user" ? "user" : "bot"}`}>
                {renderMarkdownLite(m.content)}
              </div>
            ))}
            {loading && (
              <div className="rt-chat-typing">
                <span></span><span></span><span></span>
              </div>
            )}
          </div>

          {messages.length <= 2 && (
            <div className="rt-chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="rt-chat-suggestion"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="rt-chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a bus, stop, ETA…"
              disabled={loading}
              autoFocus
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Send">
              <i className="fas fa-paper-plane" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function renderMarkdownLite(text: string) {
  const parts: React.ReactNode[] = [];
  const lines = text.split("\n");
  lines.forEach((line, li) => {
    const segs = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    segs.forEach((seg, si) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        parts.push(<strong key={`${li}-${si}`}>{seg.slice(2, -2)}</strong>);
      } else if (seg.startsWith("`") && seg.endsWith("`")) {
        parts.push(<code key={`${li}-${si}`}>{seg.slice(1, -1)}</code>);
      } else {
        parts.push(<span key={`${li}-${si}`}>{seg}</span>);
      }
    });
    if (li < lines.length - 1) parts.push(<br key={`br-${li}`} />);
  });
  return <>{parts}</>;
}
