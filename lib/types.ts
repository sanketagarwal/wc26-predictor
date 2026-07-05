export type Scorer = { name: string; weighted: number; wc2026_goals: number };

export type TeamRecord = { p: number; w: number; d: number; l: number; gf: number; ga: number };

export type Match = {
  home: string;
  away: string;
  date: string;
  city: string;
  country: string;
  home_field: boolean;
  elo: { home: number; away: number };
  form: { home: string; away: string; home_score: number; away_score: number };
  wc_record: { home: TeamRecord; away: TeamRecord };
  lambdas: { home: number; away: number };
  prob90: { home: number; draw: number; away: number };
  advance: { home: number; away: number };
  odds: {
    home_win90: number;
    draw90: number;
    away_win90: number;
    home_advance: number;
    away_advance: number;
  };
  likely_scores: { score: string; p: number }[];
  top_scorers: { home: Scorer[]; away: Scorer[] };
  h2h: {
    played: number;
    wins_a: number;
    draws: number;
    wins_b: number;
    recent: { date: string; score: string; tournament: string }[];
  };
  analysis: string[];
};

export type TitleOdds = {
  team: string;
  champion: number;
  final: number;
  semifinal: number;
  odds: number | null;
};

export type ScorecardEntry = {
  match: string;
  result: string;
  picked: string;
  prob: number;
  correct: boolean;
  note: string;
};

export type Predictions = {
  generated: string;
  tournament: string;
  sims: number;
  matches: Match[];
  scorecard: ScorecardEntry[];
  title_odds: TitleOdds[];
  elo_top: { team: string; elo: number }[];
};
