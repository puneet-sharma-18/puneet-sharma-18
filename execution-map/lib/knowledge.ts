import { chapters, clusters, edges, headline, nodes, person } from "@/data/profile";
import type { ExecNode } from "./types";

let cached: string | null = null;

/** Flatten the profile into a plain-text knowledge base for Jarvis's system prompt. */
export function buildKnowledge(): string {
  if (cached) return cached;
  const clusterLabel = Object.fromEntries(clusters.map((c) => [c.id, c.label]));
  const lines: string[] = [
    "=== KNOWLEDGE BASE ===",
    `PERSON: ${person.name} — ${person.title}. Based in ${person.location}.`,
    `Contact: ${person.email} · ${person.phone} · ${person.github}`,
    `Headline: ${headline.map((h) => `${h.value} ${h.label}`).join("; ")}`,
    "",
    "JOURNEY:",
    ...chapters.map((c) => `- ${c.year}: ${c.title}. ${c.text}`),
    "",
    "NODES (id in brackets — use [[id]] tokens):",
  ];
  for (const n of nodes) {
    lines.push(
      "",
      `[[${n.id}]] ${n.title} — ${clusterLabel[n.cluster]} · since ${n.year} · status: ${n.status}`,
      `Tagline: ${n.tagline}`,
      `What it is: ${n.brief}`,
      `Executed: ${n.executed.join(" | ")}`,
    );
    if (n.how) lines.push(`How it works: ${n.how.join(" → ")}`);
    if (n.stack) lines.push(`Stack: ${n.stack.join(", ")}`);
    if (n.metrics) lines.push(`Numbers: ${n.metrics.map((m) => `${m.value} ${m.label}${m.source ? ` (source: ${m.source})` : ""}`).join("; ")}`);
    if (n.insight) lines.push(`How he figured it out: ${n.insight}`);
    if (n.proof) lines.push(`Proof: ${n.proof.map((p) => p.label + (p.url ? ` <${p.url}>` : "")).join("; ")}`);
  }
  lines.push("", "CONNECTIONS (how one build led to the next):");
  for (const e of edges) lines.push(`- ${e.from} → ${e.to}: ${e.label}`);
  lines.push(
    "",
    "NOTES:",
    "- D2C Insider was founded by Abhishek Shah; Puneet leads community + partnerships and is the sole developer of its AI-era products. Do not call him the founder of D2C Insider.",
    "- Much of the 2026 software was built AI-natively with Claude Code; Puneet designs the systems, makes the product and architecture decisions, and ships them.",
  );
  cached = lines.join("\n");
  return cached;
}

const STOP = new Set(
  "a an the and or of to in on for with is are was were what which who how does did do he his him puneet sharma about me tell this that it its has have from by at as be any all".split(
    " ",
  ),
);

function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9₹ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function haystack(n: ExecNode) {
  return [n.title, n.tagline, n.brief, n.executed.join(" "), n.how?.join(" "), n.stack?.join(" "), n.insight, n.cluster]
    .join(" ")
    .toLowerCase();
}

/** Keyword retrieval so Jarvis still answers (from real data) when no API key is configured. */
export function offlineAnswer(question: string): string {
  const q = question.toLowerCase();
  const words = tokens(question);

  if (/journey|story|background|career|start/.test(q)) {
    return [
      "Here's the arc, 0 → 100:",
      ...chapters.map((c) => `**${c.year}** — ${c.text}`),
      "",
      "Key stops: Ekrayah [[ekrayah]], The Paan Legacy [[paan-legacy]], D2C Insider [[d2c-insider]], theZio [[thezio]].",
    ].join("\n");
  }
  if (/sponsor|partner|airpay|gokwik|deal/.test(q)) {
    const n = nodes.find((x) => x.id === "sponsorships")!;
    return `${n.brief}\n\n${n.executed.map((x) => "• " + x).join("\n")}\n\nSee Sponsorships [[sponsorships]] and the rooms they were sold into: CXO Meets [[cxo-meets]], Frontier [[frontier]].`;
  }
  if (/live|shipped|production|executed|built/.test(q) && !words.some((w) => nodes.some((n) => n.id.includes(w)))) {
    const live = nodes.filter((n) => n.status === "live" || n.status === "shipped");
    return [
      `**${live.length} things on this map are live or shipped.** The flagships:`,
      ...live
        .filter((n) => n.weight >= 2)
        .map((n) => `• ${n.title} [[${n.id}]] — ${n.tagline}`),
    ].join("\n");
  }

  const scored = nodes
    .map((n) => {
      const h = haystack(n);
      let s = words.reduce((acc, w) => acc + (h.includes(w) ? 1 : 0), 0);
      if (q.includes(n.title.toLowerCase()) || q.includes(n.id.replace(/-/g, " "))) s += 5;
      return { n, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.n.weight - a.n.weight);

  if (scored.length === 0) {
    return `I don't have that on record. Try asking about a project — e.g. theZio [[thezio]], The Paan Legacy [[paan-legacy]] or Frontier [[frontier]] — or ask Puneet directly at ${person.email}.`;
  }

  const top = scored[0].n;
  const out = [`**${top.title}** [[${top.id}]] — ${top.tagline}`, "", top.brief];
  if (top.how) out.push("", "How it works: " + top.how.join(" → "));
  if (top.metrics?.length) out.push("", "Numbers: " + top.metrics.slice(0, 4).map((m) => `**${m.value}** ${m.label}`).join(" · "));
  const more = scored.slice(1, 4).map((x) => `[[${x.n.id}]]`);
  if (more.length) out.push("", "Related: " + more.join(" "));
  return out.join("\n");
}
