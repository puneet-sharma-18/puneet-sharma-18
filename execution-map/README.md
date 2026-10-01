# Puneet Sharma: Execution Map

This is a portfolio page for a recruiter or interviewer who wants proof that the work happened. Every node on the map is something that exists outside a slide deck. Click a node to open its case file: **Brief · What I executed · How it works · Numbers · Receipts**. The glowing lines (the "Execution DNA") show how one build led to the next. **Jarvis** is the AI on the page. Ask it anything about Puneet and it answers with buttons that move the map to the project it is talking about.

## Run locally

```bash
cd execution-map
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY to turn on Jarvis's live AI mode
npm run dev                  # http://localhost:3000
```

Jarvis has two modes:
- **Without a key:** an offline index answers from `data/profile.ts`, so the demo still works.
- **With `ANTHROPIC_API_KEY`:** Claude streams the answers, grounded in the same data.

## Edit the content

Everything is in **`data/profile.ts`**: nodes, clusters, connections, journey chapters and headline stats. The map, the case files and Jarvis's knowledge all read from this one file, so editing it updates all three.

Lines marked `// CONFIRM` are best guesses Puneet must check before the page is shared.

## Deploy (when the domain is ready)

- **Vercel (recommended):** import the repo, set the root directory to `execution-map`, add `ANTHROPIC_API_KEY`, and attach the domain.
- **Any Node server:** run `npm run build && npm start` behind nginx on port 3000.

## Features

| Feature | What the interviewer sees |
|---|---|
| Boot sequence | A short terminal intro ("indexing 28 repositories · 338k lines of code") |
| Execution map | A radial map with Puneet at the centre and 5 clusters around him: Operator Years, Brands, D2C Insider, AI Products, Teaching |
| Case files | A tab per question: what it is, what he did, how it works (as a pipeline), numbers with sources, receipts |
| Execution DNA | Lines between nodes, each with the reason one thing led to the next |
| Play the journey | A timeline from 2016 to 2026; nodes appear as each chapter plays |
| Jarvis | Chat grounded in the profile data; node mentions become buttons that move the map |
| List view | A card layout for mobile and for skimming |
| Ops console | Live pings to every production system (theZio, d2cinsider.ai, CRM…) with latency, plus a GitHub-style heatmap of 1,811 real commits |
| ⌘K palette | Search every project, technology or action, the way Linear or Raycast do it |
| Terminal (`` ` ``) | `neofetch`, `ls`, `cat thezio`, `git log`, `jarvis <q>`, `sudo hire puneet` |
| Jarvis voice | Ask out loud with the mic and hear the answer read back; a waveform shows while it talks |
| Visual layer | Starfield with mouse parallax, aurora, film grain, data packets moving along the lines between nodes, decrypting titles, gradient-glass panels, Geist + Instrument Serif type |

`data/shiplog.json` holds the commit counts by day, taken from `git log` across all repos (jarvis-dashboard's automatic data commits are left out). Regenerate it before each submission.

## Next steps

1. Supabase: log the questions people ask Jarvis (shows what interviewers care about) and track views per node.
2. "Request a walkthrough" button that sends a WhatsApp or Calendly link.
3. Screenshots or short Looms inside each case file (theZio flow, Frontier check-in, CRM).
4. Live numbers pulled from the products' own databases (theZio DMs sent, Frontier passes issued).
