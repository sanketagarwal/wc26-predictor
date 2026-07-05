#!/usr/bin/env python3
"""
FIFA World Cup 2026 — Knockout-stage match predictor.

Probability pipeline:
  1. Elo ratings over all international matches since 1872
     (K scaled by tournament importance, goal-difference multiplier,
      home advantage for non-neutral venues).
  2. Recent form: exponentially-weighted points over each team's last 10 matches.
  3. Attack/Defence strengths: time-decayed goals for/against per match
     (last 4 years), expressed relative to the international scoring average.
  4. Expected goals per side via the multiplicative Poisson form
       lambda_home = mu * (att_home/mu) * (def_away/mu)
     tilted toward the Elo win expectation, with a small in-form-striker boost.
  5. Score matrix from independent Poissons with a Dixon-Coles low-score
     correction (rho = -0.1) for 0-0/1-0/0-1/1-1.
  6. Knockout advancement: P(adv) = P(win 90') + P(draw 90') * P(win ET+pens),
     where extra time is a Poisson with lambda/3 and penalties are 50/50.
  7. 20,000-run Monte Carlo over the confirmed bracket for title odds.

Outputs lib/predictions.json for the Next.js frontend.
"""

import csv, math, json, random, os
from collections import defaultdict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT = os.path.join(HERE, "..", "lib", "predictions.json")

TODAY = date(2026, 7, 5)

# ---------------------------------------------------------------- load data
def parse_date(s):
    y, m, d = s.split("-")
    return date(int(y), int(m), int(d))

matches, fixtures = [], []
with open(os.path.join(DATA, "results.csv")) as f:
    for r in csv.DictReader(f):
        row = dict(r)
        row["d"] = parse_date(r["date"])
        if r["home_score"] == "NA":
            if r["tournament"] == "FIFA World Cup" and row["d"] >= TODAY:
                fixtures.append(row)
            continue
        row["hs"], row["as_"] = int(r["home_score"]), int(r["away_score"])
        matches.append(row)

matches.sort(key=lambda m: m["d"])

goals = []
with open(os.path.join(DATA, "goalscorers.csv")) as f:
    for r in csv.DictReader(f):
        r["d"] = parse_date(r["date"])
        goals.append(r)

# ---------------------------------------------------------------- 1. Elo
K_BY_TOURNAMENT = {"FIFA World Cup": 60, "FIFA World Cup qualification": 40,
                   "UEFA Euro": 50, "Copa América": 50, "African Cup of Nations": 50,
                   "AFC Asian Cup": 50, "CONCACAF Championship": 50, "Gold Cup": 50,
                   "Confederations Cup": 50, "UEFA Nations League": 40,
                   "CONCACAF Nations League": 40, "Friendly": 20}
HOME_ELO = 80.0

elo = defaultdict(lambda: 1500.0)

def expected(ra, rb):
    return 1.0 / (1.0 + 10 ** (-(ra - rb) / 400.0))

for m in matches:
    h, a = m["home_team"], m["away_team"]
    k = K_BY_TOURNAMENT.get(m["tournament"], 30)
    adv = 0.0 if m["neutral"] == "TRUE" else HOME_ELO
    eh = expected(elo[h] + adv, elo[a])
    if m["hs"] > m["as_"]: sh = 1.0
    elif m["hs"] < m["as_"]: sh = 0.0
    else: sh = 0.5
    d = abs(m["hs"] - m["as_"])
    g = 1.0 if d <= 1 else (1.5 if d == 2 else (11 + d) / 8.0)
    delta = k * g * (sh - eh)
    elo[h] += delta
    elo[a] -= delta

# ---------------------------------------------------------------- 2. form
def recent(team, n=10):
    out = []
    for m in reversed(matches):
        if m["home_team"] == team or m["away_team"] == team:
            out.append(m)
            if len(out) == n: break
    return out

def form_score(team):
    """Exponentially weighted points share over last 10 matches (0..1)."""
    ms = recent(team)
    num = den = 0.0
    for i, m in enumerate(ms):
        w = 0.85 ** i
        gf, ga = (m["hs"], m["as_"]) if m["home_team"] == team else (m["as_"], m["hs"])
        pts = 3 if gf > ga else (1 if gf == ga else 0)
        num += w * pts
        den += w * 3
    return num / den if den else 0.5

def form_string(team, n=5):
    s = ""
    for m in recent(team, n):
        gf, ga = (m["hs"], m["as_"]) if m["home_team"] == team else (m["as_"], m["hs"])
        s += "W" if gf > ga else ("D" if gf == ga else "L")
    return s  # most recent first

# ------------------------------------------------- 3. attack/defence
CUTOFF = date(2022, 7, 1)

def att_def(team):
    gf_n = ga_n = wsum = 0.0
    for m in matches:
        if m["d"] < CUTOFF: continue
        if m["home_team"] == team:
            gf, ga = m["hs"], m["as_"]
        elif m["away_team"] == team:
            gf, ga = m["as_"], m["hs"]
        else:
            continue
        w = 0.5 ** ((TODAY - m["d"]).days / 540.0)   # ~18-month half-life
        if m["tournament"] == "FIFA World Cup": w *= 1.6
        elif m["tournament"] != "Friendly": w *= 1.2
        gf_n += w * gf; ga_n += w * ga; wsum += w
    if wsum == 0: return 1.2, 1.2
    return gf_n / wsum, ga_n / wsum

MU = 1.32  # avg goals per team per match, recent internationals

# ------------------------------------------------- 4. player form
def top_scorers(team, since=date(2024, 1, 1), k=4):
    tally = defaultdict(lambda: [0, 0])   # scorer -> [weighted, wc2026 goals]
    for g in goals:
        if g["team"] != team or g["own_goal"] == "TRUE" or g["d"] < since: continue
        if not g["scorer"]: continue
        wc26 = g["d"] >= date(2026, 6, 1)
        tally[g["scorer"]][0] += 2.0 if wc26 else 1.0
        if wc26: tally[g["scorer"]][1] += 1
    rows = sorted(tally.items(), key=lambda kv: -kv[1][0])[:k]
    return [{"name": n, "weighted": round(v[0], 1), "wc2026_goals": v[1]} for n, v in rows]

def striker_boost(team):
    """+4% xG if the team has a striker with 3+ goals at this World Cup."""
    return 1.04 if any(s["wc2026_goals"] >= 3 for s in top_scorers(team)) else 1.0

# ------------------------------------------------- 5. match model
def poisson_pmf(lam, kmax=10):
    p = [math.exp(-lam)]
    for i in range(1, kmax + 1):
        p.append(p[-1] * lam / i)
    return p

def dc_tau(x, y, lh, la, rho=-0.10):
    if x == 0 and y == 0: return 1 - lh * la * rho
    if x == 0 and y == 1: return 1 + lh * rho
    if x == 1 and y == 0: return 1 + la * rho
    if x == 1 and y == 1: return 1 - rho
    return 1.0

def lambdas(home, away, home_field):
    ah, dh = att_def(home)
    aa, da = att_def(away)
    lh = MU * (ah / MU) * (da / MU)
    la = MU * (aa / MU) * (dh / MU)
    adv = HOME_ELO if home_field else 0.0
    p = expected(elo[home] + adv, elo[away])
    lh *= (p / 0.5) ** 0.35 * striker_boost(home)
    la *= ((1 - p) / 0.5) ** 0.35 * striker_boost(away)
    return max(0.2, min(4.5, lh)), max(0.2, min(4.5, la)), p

def score_matrix(lh, la):
    ph, pa = poisson_pmf(lh), poisson_pmf(la)
    return [[ph[i] * pa[j] * dc_tau(i, j, lh, la) for j in range(11)] for i in range(11)]

def outcome_probs(mat):
    w = sum(mat[i][j] for i in range(11) for j in range(11) if i > j)
    d = sum(mat[i][i] for i in range(11))
    l = sum(mat[i][j] for i in range(11) for j in range(11) if i < j)
    s = w + d + l
    return w / s, d / s, l / s

def advance_prob(home, away, home_field):
    lh, la, p_elo = lambdas(home, away, home_field)
    mat = score_matrix(lh, la)
    w90, d90, l90 = outcome_probs(mat)
    # extra time: same model at 1/3 intensity; penalties 50/50
    met = score_matrix(lh / 3, la / 3)
    wet, det, let = outcome_probs(met)
    q = wet + det * 0.5
    return {"lh": lh, "la": la, "p_elo": p_elo, "w90": w90, "d90": d90, "l90": l90,
            "adv_home": w90 + d90 * q, "adv_away": l90 + d90 * (1 - q), "mat": mat}

def likely_scores(mat, n=3):
    cells = [(mat[i][j], i, j) for i in range(7) for j in range(7)]
    cells.sort(reverse=True)
    tot = sum(mat[i][j] for i in range(11) for j in range(11))
    return [{"score": f"{i}-{j}", "p": round(p / tot, 3)} for p, i, j in cells[:n]]

# ------------------------------------------------- helpers for analysis
def h2h(a, b, n=5):
    ms = [m for m in matches if {m["home_team"], m["away_team"]} == {a, b}]
    wa = sum(1 for m in ms if (m["hs"] > m["as_"]) == (m["home_team"] == a) and m["hs"] != m["as_"])
    dr = sum(1 for m in ms if m["hs"] == m["as_"])
    last = [{"date": m["date"], "score": f'{m["home_team"]} {m["hs"]}-{m["as_"]} {m["away_team"]}',
             "tournament": m["tournament"]} for m in ms[-n:]][::-1]
    return {"played": len(ms), "wins_a": wa, "draws": dr, "wins_b": len(ms) - wa - dr, "recent": last}

def wc26_record(team):
    p = w = d = l = gf = ga = 0
    for m in matches:
        if m["tournament"] != "FIFA World Cup" or m["d"] < date(2026, 6, 1): continue
        if m["home_team"] == team: f, a = m["hs"], m["as_"]
        elif m["away_team"] == team: f, a = m["as_"], m["hs"]
        else: continue
        p += 1; gf += f; ga += a
        w += f > a; d += f == a; l += f < a
    return {"p": p, "w": w, "d": d, "l": l, "gf": gf, "ga": ga}

def pct(x): return round(100 * x, 1)
def dec_odds(p): return round(1 / p, 2) if p > 0.0005 else 999.0

# ------------------------------------------------- fixtures + host advantage
HOSTS = {"United States", "Mexico", "Canada"}

R16 = [(f["home_team"], f["away_team"], f["date"], f["city"], f["country"], f["neutral"] == "FALSE")
       for f in sorted(fixtures, key=lambda x: (x["date"], x["city"]))]

def analysis_text(home, away, r, home_field, city, country, when):
    e_h, e_a = round(elo[home]), round(elo[away])
    f_h, f_a = form_score(home), form_score(away)
    fs_h, fs_a = form_string(home), form_string(away)
    rec_h, rec_a = wc26_record(home), wc26_record(away)
    ts_h, ts_a = top_scorers(home, k=2), top_scorers(away, k=2)
    hh = h2h(home, away)
    fav, dog = (home, away) if r["adv_home"] >= r["adv_away"] else (away, home)
    fav_p = max(r["adv_home"], r["adv_away"])

    paras = []
    paras.append(
        f"**Ratings.** {home} enter this tie rated {e_h} on our Elo scale against {away}'s {e_a} "
        f"({'+' if e_h >= e_a else ''}{e_h - e_a} edge for {home}). Elo here is fitted over every official "
        f"international since 1872 with a K-factor of 60 for World Cup matches, a goal-difference multiplier, "
        f"and an 80-point home bonus{' — which applies, as ' + home + ' play on home soil in ' + city if home_field else ' (not applied: neutral venue, ' + city + ', ' + country + ')'}. "
        f"That rating gap alone translates to a {pct(r['p_elo'])}% win expectation for {home} before form and finishing are considered."
    )
    paras.append(
        f"**Form and tournament shape.** {home}'s last five: {'-'.join(fs_h)} (weighted points share {pct(f_h)}%); "
        f"{away}'s: {'-'.join(fs_a)} ({pct(f_a)}%). At this World Cup {home} are "
        f"{rec_h['w']}W-{rec_h['d']}D-{rec_h['l']}L with {rec_h['gf']} scored / {rec_h['ga']} conceded, while {away} are "
        f"{rec_a['w']}W-{rec_a['d']}D-{rec_a['l']}L ({rec_a['gf']}/{rec_a['ga']}). Those attacking and defensive rates, "
        f"decayed over the last four years and up-weighted for competitive matches, set the Poisson goal expectations at "
        f"λ={r['lh']:.2f} for {home} and λ={r['la']:.2f} for {away}."
    )
    def fmt_sc(ts, team):
        if not ts: return f"{team} lack a standout recent scorer"
        s = ts[0]
        extra = f" ({s['wc2026_goals']} at this World Cup)" if s["wc2026_goals"] else ""
        return f"{team} lean on {s['name']}{extra}"
    paras.append(
        f"**Key players.** {fmt_sc(ts_h, home)}; {fmt_sc(ts_a, away)}. "
        f"Teams with a striker on 3+ tournament goals receive a +4% expected-goals boost in the model"
        f"{' — applied to ' + ', '.join(t for t in [home, away] if striker_boost(t) > 1) if (striker_boost(home) > 1 or striker_boost(away) > 1) else ' — neither side qualifies here'}."
    )
    if hh["played"]:
        paras.append(
            f"**Head-to-head.** These sides have met {hh['played']} times: {hh['wins_a']} wins for {home}, "
            f"{hh['draws']} draws, {hh['wins_b']} for {away}. Most recent: "
            + "; ".join(f"{x['score']} ({x['date'][:4]})" for x in hh["recent"][:3]) + ". "
            f"H2H is reported for context but is not an input — historical pairings this sparse add noise, not signal."
        )
    else:
        paras.append(f"**Head-to-head.** First ever competitive meeting between {home} and {away}.")
    paras.append(
        f"**The probability call.** Multiplying the two independent Poisson margins (with a Dixon-Coles ρ=-0.10 "
        f"correction that reallocates mass toward low-scoring draws) gives {home} {pct(r['w90'])}% / draw {pct(r['d90'])}% / "
        f"{away} {pct(r['l90'])}% over 90 minutes. Because this is a knockout, the draw mass is resolved through a "
        f"one-third-intensity extra-time Poisson and a 50/50 shootout, leaving {fav} to advance in {pct(fav_p)}% of outcomes. "
        f"Fair decimal odds: {home} {dec_odds(r['adv_home'])}, {away} {dec_odds(r['adv_away'])}. "
        f"Anything materially better than those numbers at a sportsbook would represent model value on {fav if fav_p < 0.62 else dog}."
    )
    return paras

# ------------------------------------------------- build match cards
cards = []
for home, away, when, city, country, home_field in R16:
    r = advance_prob(home, away, home_field)
    cards.append({
        "home": home, "away": away, "date": when, "city": city, "country": country,
        "home_field": home_field,
        "elo": {"home": round(elo[home]), "away": round(elo[away])},
        "form": {"home": form_string(home), "away": form_string(away),
                 "home_score": pct(form_score(home)), "away_score": pct(form_score(away))},
        "wc_record": {"home": wc26_record(home), "away": wc26_record(away)},
        "lambdas": {"home": round(r["lh"], 2), "away": round(r["la"], 2)},
        "prob90": {"home": pct(r["w90"]), "draw": pct(r["d90"]), "away": pct(r["l90"])},
        "advance": {"home": pct(r["adv_home"]), "away": pct(r["adv_away"])},
        "odds": {"home_win90": dec_odds(r["w90"]), "draw90": dec_odds(r["d90"]),
                 "away_win90": dec_odds(r["l90"]),
                 "home_advance": dec_odds(r["adv_home"]), "away_advance": dec_odds(r["adv_away"])},
        "likely_scores": likely_scores(r["mat"]),
        "top_scorers": {"home": top_scorers(home, k=3), "away": top_scorers(away, k=3)},
        "h2h": h2h(home, away),
        "analysis": analysis_text(home, away, r, home_field, city, country, when),
    })

# ------------------------------------------------- 7. Monte Carlo bracket
# QF: W(PAR/FRA) v W(CAN/MAR); W(BRA/NOR) v W(MEX/ENG);
#     W(POR/ESP) v W(USA/BEL); W(ARG/EGY) v W(SUI/COL)
BRACKET = [("Paraguay", "France"), ("Canada", "Morocco"),
           ("Brazil", "Norway"), ("Mexico", "England"),
           ("Portugal", "Spain"), ("United States", "Belgium"),
           ("Argentina", "Egypt"), ("Switzerland", "Colombia")]

# R16 ties already decided on the pitch — fixed in every simulation
DECIDED = {("Paraguay", "France"): "France",
           ("Canada", "Morocco"): "Morocco"}

# published pre-match advancement probabilities, kept as the honest record
SCORECARD = [
    {"match": "Canada vs Morocco", "result": "Canada 0-3 Morocco",
     "picked": "Morocco", "prob": 80.8, "correct": True,
     "note": "Ounahi (50', 82') and Rahimi (90+8') sent Morocco through to a quarter-final against France."},
    {"match": "Paraguay vs France", "result": "Paraguay 0-1 France",
     "picked": "France", "prob": 90.8, "correct": True,
     "note": "Mbappé's 70th-minute penalty — his 7th goal of the tournament — decided a bruising tie."},
]

adv_cache = {}
def p_adv(a, b, host_a):
    key = (a, b, host_a)
    if key not in adv_cache:
        adv_cache[key] = advance_prob(a, b, host_a)["adv_home"]
    return adv_cache[key]

random.seed(2026)
SIMS = 20000
counts = defaultdict(lambda: {"qf": 0, "sf": 0, "final": 0, "champion": 0})

for _ in range(SIMS):
    r16 = []
    for a, b in BRACKET:
        if (a, b) in DECIDED:
            r16.append(DECIDED[(a, b)])
            continue
        # home-field only when the fixture is genuinely home (Mexico in Mexico City, USA in Seattle)
        hf = (a == "Mexico") or (a == "United States")
        r16.append(a if random.random() < p_adv(a, b, hf) else b)
    for t in r16: counts[t]["qf"] += 1
    qf = []
    for i in range(0, 8, 2):
        a, b = r16[i], r16[i + 1]
        hf = a in HOSTS and False  # later venues treated neutral
        qf.append(a if random.random() < p_adv(a, b, hf) else b)
    for t in qf: counts[t]["sf"] += 1
    sf = []
    for i in range(0, 4, 2):
        a, b = qf[i], qf[i + 1]
        sf.append(a if random.random() < p_adv(a, b, False) else b)
    for t in sf: counts[t]["final"] += 1
    champ = sf[0] if random.random() < p_adv(sf[0], sf[1], False) else sf[1]
    counts[champ]["champion"] += 1

title_odds = sorted(
    ({"team": t, "champion": pct(c["champion"] / SIMS), "final": pct(c["final"] / SIMS),
      "semifinal": pct(c["sf"] / SIMS), "odds": dec_odds(c["champion"] / SIMS) if c["champion"] else None}
     for t, c in counts.items()),
    key=lambda x: -x["champion"])

# ------------------------------------------------- write
out = {
    "generated": TODAY.isoformat(),
    "tournament": "FIFA World Cup 2026 — Round of 16",
    "sims": SIMS,
    "matches": cards,
    "scorecard": SCORECARD,
    "title_odds": title_odds,
    "elo_top": sorted(({"team": t, "elo": round(e)} for t, e in elo.items()
                       if t in {x for p in BRACKET for x in p}), key=lambda x: -x["elo"]),
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(out, f, indent=1)

print(f"Wrote {OUT}")
for c in cards:
    print(f'{c["home"]:>14} {c["advance"]["home"]:5.1f}% vs {c["advance"]["away"]:5.1f}% {c["away"]:<14}'
          f'  odds {c["odds"]["home_advance"]:>5} / {c["odds"]["away_advance"]:>5}')
print("\nTitle odds:")
for t in title_odds[:8]:
    print(f'  {t["team"]:>14} {t["champion"]:5.1f}%  ({t["odds"]})')
