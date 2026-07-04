import type { TitleOdds } from "@/lib/types";

export default function TitleOddsChart({ odds, sims }: { odds: TitleOdds[]; sims: number }) {
  const rows = odds.filter((t) => t.champion > 0).slice(0, 12);
  const max = rows[0]?.champion ?? 1;
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Who wins the World Cup?</h2>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
        {sims.toLocaleString()}&nbsp;Monte Carlo simulations of the remaining bracket, replayed match
        by match from the model&apos;s advancement probabilities.
      </p>
      <div className="mt-4 space-y-2">
        {rows.map((t) => (
          <div key={t.team} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate" style={{ color: "var(--ink-2)" }}>
              {t.team}
            </span>
            <div className="h-4 rounded-r-[4px]" style={{ background: "var(--page)" }}>
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${(t.champion / max) * 100}%`, background: "var(--home)", minWidth: 2 }}
              />
            </div>
            <span className="tnum font-medium w-24 text-right">
              {t.champion.toFixed(1)}%{" "}
              <span style={{ color: "var(--muted)" }}>{t.odds ? `(${t.odds.toFixed(1)})` : ""}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
        Percentage = share of simulations won · parenthesis = fair decimal odds.
      </p>
    </section>
  );
}
