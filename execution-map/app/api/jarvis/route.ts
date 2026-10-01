import Anthropic from "@anthropic-ai/sdk";
import { buildKnowledge, offlineAnswer } from "@/lib/knowledge";

export const runtime = "nodejs";

interface InMsg {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are JARVIS, the AI guide embedded in Puneet Sharma's "Execution Map" — an interactive portfolio built for interviewers and hiring managers who want proof of execution, not claims.

Rules:
- Answer ONLY from the KNOWLEDGE BASE below. If something is not in it, say you don't have that on record and suggest asking Puneet directly. Never invent numbers, employers, clients or dates.
- When a number comes from a pitch deck, website draft or internal doc, say so briefly (e.g. "per the Oct 2024 pitch deck").
- Whenever you mention a project/node, add its token right after the name, like: theZio [[thezio]]. Tokens must use the exact ids listed in the knowledge base. The UI turns them into buttons that fly the map to that node.
- Speak about Puneet in the third person. Be crisp and confident, like a sharp chief of staff briefing an interviewer: short paragraphs or tight bullets, max ~180 words unless asked for depth. Use **bold** sparingly for key numbers.
- Lead with what was executed (shipped, live, closed), then how.`;

function clean(raw: unknown): InMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is InMsg =>
        !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.length > 0,
    )
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
}

export async function POST(req: Request) {
  let messages: InMsg[] = [];
  try {
    messages = clean((await req.json()).messages);
  } catch {
    /* fall through to validation below */
  }
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return new Response("Bad request", { status: 400 });
  }

  const question = messages[messages.length - 1].content;
  const enc = new TextEncoder();

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return new Response(offlineAnswer(question), {
      headers: { "content-type": "text/plain; charset=utf-8", "x-jarvis-mode": "offline" },
    });
  }

  const client = new Anthropic();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = client.beta.messages.stream({
          model: "claude-opus-5-5",
          max_tokens: 2000,
          output_config: { effort: "low" },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [
            { type: "text", text: SYSTEM },
            // Knowledge base is stable across requests, so cache it.
            { type: "text", text: buildKnowledge(), cache_control: { type: "ephemeral" } },
          ],
          messages,
        });
        s.on("text", (t) => controller.enqueue(enc.encode(t)));
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(enc.encode("\n\nI can't help with that one — ask me about Puneet's work instead."));
        }
      } catch (err) {
        console.error("jarvis error", err);
        // Degrade gracefully to the offline index rather than showing an error in an interview.
        controller.enqueue(enc.encode(offlineAnswer(question)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "x-jarvis-mode": "live", "cache-control": "no-store" },
  });
}
