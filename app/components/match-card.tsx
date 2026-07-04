"use client";

import { useState } from "react";
import type { Match } from "@/lib/types";

function bold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}

function OddsTile({ label, odds, pct }: { label: string; odds: number; pct?: number }) {
  return (
    <div className="chip px-3 py-2 flex flex-col items-center min-w-[86px]">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <span className="text-lg font-semibold tnum">{odds.toFixed(2)}</span>
      {pct !== undefined && (
        <span className="text-[11px] tnum" style={{ color: "var(--ink-2)" }}>
          {pct.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export default function MatchCard({ match }: { match: Match }) {
  const [open, setOpen] = useState(false);
  const m = match;
  const favHome = m.advance.home >= m.advance.away;

  return (
    <article className="card p-5 sm:p-6">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
        <span className="tnum">{m.date}</span>
        <span aria-hidden>·</span>
        <span>
          {m.city}, {m.country}
        </span>
        {m.home_field && (
          <span
            className="ml-auto rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={{ background: "rgba(57,135,229,0.15)", color: "var(--home)" }}
          >
            {m.home} home advantage
          </span>
        )}
      </div>

      {/* teams + advance % */}
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-block size-3 rounded-full shrink-0" style={{ background: "var(--home)" }} />
          <div>
            <div className={`text-lg sm:text-xl ${favHome ? "font-bold" : "font-medium"}`}>{m.home}</div>
            <div className="text-[12px] tnum" style={{ color: "var(--muted)" }}>
              Elo {m.elo.home} · form {m.form.home}
            </div>
          </div>
        </div>
        <div className="text-center text-[12px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          vs
        </div>
        <div className="flex items-center justify-end gap-2.5 text-right">
          <div>
            <div className={`text-lg sm:text-xl ${!favHome ? "font-bold" : "font-medium"}`}>{m.away}</div>
            <div className="text-[12px] tnum" style={{ color: "var(--muted)" }}>
              Elo {m.elo.away} · form {m.form.away}
            </div>
          </div>
          <span className="inline-block size-3 rounded-full shrink-0" style={{ background: "var(--away)" }} />
        </div>
      </div>

      {/* advance probability — headline numbers */}
      <div className="mt-4 flex items-end justify-between">
        <span className="text-3xl font-bold tnum" style={{ color: "var(--home)" }}>
          {m.advance.home.toFixed(1)}%
        </span>
        <span className="text-[12px] pb-1" style={{ color: "var(--muted)" }}>
          chance to advance
        </span>
        <span className="text-3xl font-bold tnum" style={{ color: "var(--away)" }}>
          {m.advance.away.toFixed(1)}%
        </span>
      </div>

      {/* advance bar (two segments, 2px gap) */}
      <div
        className="mt-2 flex h-3 w-full overflow-hidden rounded-full gap-[2px]"
        role="img"
        aria-label={`${m.home} ${m.advance.home}% to advance, ${m.away} ${m.advance.away}%`}
        style={{ background: "var(--page)" }}
      >
        <div className="rounded-l-full" style={{ width: `${m.advance.home}%`, background: "var(--home)" }} />
        <div className="rounded-r-full" style={{ width: `${m.advance.away}%`, background: "var(--away)" }} />
      </div>

      {/* 90-minute diverging bar: home / draw / away */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-[12px]" style={{ color: "var(--muted)" }}>
          <span>90-minute result probabilities</span>
          <span className="tnum">
            xG {m.lambdas.home.toFixed(2)} : {m.lambdas.away.toFixed(2)}
          </span>
        </div>
        <div
          className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full gap-[2px]"
          role="img"
          aria-label={`Win ${m.prob90.home}%, draw ${m.prob90.draw}%, ${m.away} win ${m.prob90.away}%`}
          style={{ background: "var(--page)" }}
        >
          <div className="rounded-l-full" style={{ width: `${m.prob90.home}%`, background: "var(--home)" }} />
          <div style={{ width: `${m.prob90.draw}%`, background: "var(--draw)" }} />
          <div className="rounded-r-full" style={{ width: `${m.prob90.away}%`, background: "var(--away)" }} />
        </div>
        <div className="mt-1 flex justify-between text-[12px] tnum" style={{ color: "var(--ink-2)" }}>
          <span>{m.prob90.home.toFixed(1)}% win</span>
          <span style={{ color: "var(--muted)" }}>{m.prob90.draw.toFixed(1)}% draw</span>
          <span>{m.prob90.away.toFixed(1)}% win</span>
        </div>
      </div>

      {/* odds tiles */}
      <div className="mt-4 flex flex-wrap gap-2">
        <OddsTile label={`${m.home} 90'`} odds={m.odds.home_win90} pct={m.prob90.home} />
        <OddsTile label="Draw 90'" odds={m.odds.draw90} pct={m.prob90.draw} />
        <OddsTile label={`${m.away} 90'`} odds={m.odds.away_win90} pct={m.prob90.away} />
        <OddsTile label={`${m.home} adv.`} odds={m.odds.home_advance} />
        <OddsTile label={`${m.away} adv.`} odds={m.odds.away_advance} />
      </div>

      {/* likely scores */}
      <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
        <span>Most likely scores:</span>
        {m.likely_scores.map((s) => (
          <span key={s.score} className="chip px-2 py-0.5 tnum" style={{ color: "var(--ink-2)" }}>
            {s.score} <span style={{ color: "var(--muted)" }}>({(s.p * 100).toFixed(1)}%)</span>
          </span>
        ))}
      </div>

      {/* analysis */}
      <button
        onClick={() => setOpen(!open)}
        className="mt-4 w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
        style={{ borderColor: "var(--hairline)", color: "var(--ink-2)" }}
        aria-expanded={open}
      >
        {open ? "Hide detailed analysis ▲" : "Detailed analysis ▼"}
      </button>
      {open && (
        <div className="analysis mt-4 space-y-3 text-[14px]">
          {m.analysis.map((p, i) => (
            <p key={i}>{bold(p)}</p>
          ))}
          {m.h2h.played > 0 && (
            <div className="chip mt-2 p-3">
              <div className="text-[12px] uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
                Last meetings
              </div>
              <ul className="space-y-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
                {m.h2h.recent.map((r) => (
                  <li key={r.date} className="tnum">
                    {r.date} — {r.score}{" "}
                    <span style={{ color: "var(--muted)" }}>({r.tournament})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
