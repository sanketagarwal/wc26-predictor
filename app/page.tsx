import predictions from "@/lib/predictions.json";
import type { Predictions } from "@/lib/types";
import MatchCard from "./components/match-card";
import TitleOddsChart from "./components/title-odds";
import Scorecard from "./components/scorecard";
import Chat from "./components/chat";

const data = predictions as unknown as Predictions;

export default function Home() {
  const byDate = new Map<string, typeof data.matches>();
  for (const m of data.matches) {
    byDate.set(m.date, [...(byDate.get(m.date) ?? []), m]);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header>
        <p className="text-[13px] font-medium uppercase tracking-widest" style={{ color: "var(--home)" }}>
          FIFA World Cup 2026 · Knockout Stage
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">WC26 Predictor</h1>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Win probabilities and fair odds for every upcoming knockout match, from an Elo rating fitted
          on 49,000+ internationals since 1872, a Dixon-Coles-corrected Poisson goal model, recent
          form, player scoring form, and a {data.sims.toLocaleString()}-run Monte Carlo of the bracket.
          Updated {data.generated}. Model output, not betting advice.
        </p>
      </header>

      <div className="mt-8">
        <Scorecard entries={data.scorecard} />
      </div>

      <div className="mt-8">
        <TitleOddsChart odds={data.title_odds} sims={data.sims} />
      </div>

      {[...byDate.entries()].map(([date, matches]) => (
        <section key={date} className="mt-10">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            {new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </h2>
          <div className="mt-3 space-y-5">
            {matches.map((m) => (
              <MatchCard key={`${m.home}-${m.away}`} match={m} />
            ))}
          </div>
        </section>
      ))}

      <div className="mt-10">
        <Chat />
      </div>

      <section className="card mt-10 p-5 sm:p-6 text-[14px]">
        <h2 className="text-lg font-semibold">Methodology</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5" style={{ color: "var(--ink-2)" }}>
          <li>
            <strong>Elo ratings</strong> over every official international since 1872 — K=60 for World
            Cup matches, goal-difference multiplier, 80-point home bonus for non-neutral venues.
          </li>
          <li>
            <strong>Recent form</strong>: exponentially weighted points share over each team&apos;s
            last 10 matches (decay 0.85).
          </li>
          <li>
            <strong>Attack/defence strength</strong>: time-decayed goals for/against per match over the
            last 4 years (18-month half-life, competitive matches up-weighted ×1.2, World Cup ×1.6).
          </li>
          <li>
            <strong>Player form</strong>: top scorers weighted 2× for goals at this World Cup; a
            +4% expected-goals boost for teams with a striker on 3+ tournament goals.
          </li>
          <li>
            <strong>Match model</strong>: independent Poisson goals with a Dixon-Coles ρ=−0.10
            low-score correction; expected goals tilt toward the Elo win expectation.
          </li>
          <li>
            <strong>Knockout resolution</strong>: draws resolve via a one-third-intensity extra-time
            Poisson, then a 50/50 shootout.
          </li>
          <li>
            <strong>Title odds</strong>: {data.sims.toLocaleString()} Monte Carlo simulations of the
            confirmed bracket. All odds are fair (no bookmaker margin): decimal odds = 1 / probability.
          </li>
        </ol>
      </section>

      <footer className="mt-10 pb-6 text-center text-[12px]" style={{ color: "var(--muted)" }}>
        Data: martj42/international_results · Model + site generated with Claude Code ·{" "}
        <a className="underline hover:text-white" href="https://github.com/sanketagarwal/wc26-predictor">
          GitHub
        </a>
      </footer>
    </main>
  );
}
