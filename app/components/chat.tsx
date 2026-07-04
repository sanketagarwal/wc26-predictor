"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";

const SUGGESTIONS = [
  "Who is the biggest favourite in the Round of 16?",
  "Is Mexico vs England closer than the odds suggest?",
  "Why is Morocco so strong in this model?",
];

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat();
  const busy = status === "submitted" || status === "streaming";

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  };

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Ask the model</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
        A chat over the prediction data, streamed with the Vercel AI SDK + Claude.
      </p>

      {messages.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="chip px-3 py-1.5 text-[13px] transition-colors hover:bg-white/10"
              style={{ color: "var(--ink-2)" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
              message.role === "user" ? "ml-8" : "mr-8"
            }`}
            style={{
              background: message.role === "user" ? "rgba(57,135,229,0.14)" : "var(--surface-2)",
              color: "var(--ink-2)",
            }}
          >
            {message.parts.map((part, i) =>
              part.type === "text" ? <span key={i}>{part.text}</span> : null,
            )}
          </div>
        ))}
        {error && (
          <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: "var(--surface-2)", color: "var(--away)" }}>
            Chat unavailable — the deployment needs an ANTHROPIC_API_KEY environment variable.
          </div>
        )}
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder="e.g. Should Brazil be worried about Haaland?"
          className="flex-1 rounded-lg border bg-transparent px-4 py-2.5 text-[14px] outline-none focus:border-[var(--home)]"
          style={{ borderColor: "var(--hairline)" }}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-lg px-5 py-2.5 text-[14px] font-medium disabled:opacity-40"
          style={{ background: "var(--home)", color: "#fff" }}
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
