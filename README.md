# WC26 Predictor ⚽

Win probabilities, fair odds, and detailed analysis for every upcoming **FIFA World Cup 2026** knockout match — plus Monte Carlo title odds and an AI chat over the model output.

**Stack:** Next.js (App Router) · Tailwind · [Vercel AI SDK](https://ai-sdk.dev) + Claude · Python model

## How the predictions work

| Step | Method |
|---|---|
| Team strength | Elo fitted over **49,000+ internationals since 1872** (K=60 for World Cup matches, goal-difference multiplier, 80-pt home bonus) |
| Recent form | Exponentially weighted points share over the last 10 matches (decay 0.85) |
| Attack/defence | Time-decayed goals for/against per match, last 4 years (18-month half-life; competitive ×1.2, World Cup ×1.6) |
| Player form | Goalscorer records since 2024, World Cup 2026 goals weighted 2×; +4% xG boost for an in-form striker (3+ tournament goals) |
| Match model | Independent **Poisson** goals per side with a **Dixon-Coles** ρ=−0.10 low-score correction; λs tilted toward the Elo win expectation |
| Knockouts | Draw mass resolved by a ⅓-intensity extra-time Poisson, then a 50/50 shootout |
| Title odds | **20,000 Monte Carlo simulations** of the confirmed bracket |

All odds shown are *fair* odds (1/probability) with no bookmaker margin.

## Repo layout

```
data/    results.csv + goalscorers.csv (martj42/international_results)
model/   predict.py — the full probability pipeline, writes lib/predictions.json
lib/     predictions.json (model output) + TS types
app/     Next.js frontend + /api/chat (Vercel AI SDK streaming route)
```

## Run locally

```bash
python3 model/predict.py   # regenerate predictions (refresh data/ CSVs first for new results)
npm install
npm run dev
```

## AI chat

The "Ask the model" panel streams GPT-5.1 responses grounded in the prediction JSON via the Vercel AI SDK. It needs `OPENAI_API_KEY` set in the environment (Vercel → Project → Settings → Environment Variables). Without a key the rest of the site works normally.

## Disclaimer

Model probabilities for entertainment/analysis — not betting advice.

Data: [martj42/international_results](https://github.com/martj42/international_results) · Built with [Claude Code](https://claude.com/claude-code)
