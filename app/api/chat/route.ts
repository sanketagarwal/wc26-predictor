import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createUIMessageStreamResponse,
  toUIMessageStream,
} from "ai";
import predictions from "@/lib/predictions.json";

export const maxDuration = 30;

function buildContext() {
  const matches = predictions.matches.map((m) => ({
    fixture: `${m.home} vs ${m.away}`,
    date: m.date,
    venue: `${m.city}, ${m.country}`,
    home_field: m.home_field,
    elo: m.elo,
    form_last5: m.form,
    wc2026_record: m.wc_record,
    expected_goals: m.lambdas,
    prob_90min_pct: m.prob90,
    prob_advance_pct: m.advance,
    fair_decimal_odds: m.odds,
    likely_scores: m.likely_scores,
    top_scorers: m.top_scorers,
  }));
  return JSON.stringify({ matches, title_odds: predictions.title_odds.slice(0, 12) });
}

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Chat is not configured: set OPENAI_API_KEY in the deployment environment." },
      { status: 503 },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.1"),
    system:
      "You are the WC26 Predictor assistant embedded in a World Cup 2026 knockout-stage prediction dashboard. " +
      "Answer questions about the upcoming matches using ONLY the model output below (Elo + Dixon-Coles Poisson " +
      "+ Monte Carlo, fitted on all internationals since 1872). Be concise, cite the numbers, and remind users " +
      "these are model probabilities, not betting advice, when relevant.\n\nMODEL OUTPUT:\n" +
      buildContext(),
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
