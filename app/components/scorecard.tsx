import type { ScorecardEntry } from "@/lib/types";

export default function Scorecard({ entries }: { entries: ScorecardEntry[] }) {
  if (!entries?.length) return null;
  const hits = entries.filter((e) => e.correct).length;
  const sorted = [...entries.filter((e) => e.correct), ...entries.filter((e) => !e.correct)];
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Model scorecard</h2>
        <span className="tnum text-sm font-semibold" style={{ color: "var(--good)" }}>
          {hits}/{entries.length} correct
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {sorted.map((e) => (
          <div key={e.match} className="chip p-3">
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className="font-semibold">{e.result}</span>
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: e.correct ? "rgba(12,163,12,0.15)" : "rgba(230,103,103,0.15)",
                  color: e.correct ? "var(--good)" : "var(--away)",
                }}
              >
                {e.correct ? "✓" : "✗"} model picked {e.picked} at {e.prob}%
              </span>
            </div>
            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
              {e.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
