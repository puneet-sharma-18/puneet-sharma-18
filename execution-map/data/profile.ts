import type { Chapter, Cluster, Edge, ExecNode } from "@/lib/types";

/**
 * Single source of truth for the map AND for Jarvis. Every number here has a source;
 * edit this file to update the site — no other file needs to change.
 *
 * Items marked CONFIRM are best-known values that Puneet should verify before sharing.
 */

export const person = {
  name: "Puneet Sharma",
  title: "Operator → Founder → AI builder",
  location: "Gurugram, India",
  oneLiner:
    "I don't pitch ideas. I ship them — brands, communities, sponsorship deals and AI systems that are live and in use.",
  email: "puneet@thepaanlegacy.com",
  github: "https://github.com/puneet-sharma-18",
  phone: "+91 80804 26039",
};

export const clusters: Cluster[] = [
  // Ordered from the Sun outward, oldest chapter closest. Muted, atlas-style planet tones.
  { id: "operator", label: "Operator Years", kicker: "Where the reps came from", color: "#c8714b", orbit: 190, size: 11, phase: 200, body: "rocky" },
  { id: "brands", label: "Brands", kicker: "Built and run with my own money", color: "#8fae9b", orbit: 285, size: 14, phase: 120, body: "ocean" },
  { id: "community", label: "D2C Insider", kicker: "Community, partnerships, events", color: "#d9a58e", orbit: 385, size: 16, phase: 300, body: "cloud" },
  { id: "education", label: "Teaching", kicker: "Turning execution into curriculum", color: "#c9b68e", orbit: 485, size: 14, phase: 60, body: "ringed" },
  { id: "ai", label: "AI Products", kicker: "Software I designed and shipped", color: "#d9a066", orbit: 590, size: 22, phase: 340, body: "giant" },
];

export const nodes: ExecNode[] = [
  // ───────────────────────── OPERATOR YEARS ─────────────────────────
  {
    id: "call-centre",
    title: "Call Centre → eCom Team",
    cluster: "operator",
    year: 2016, // CONFIRM
    status: "archived",
    weight: 1,
    tagline: "Started on the phones. At 23, built and scaled an eCommerce team.",
    brief:
      "Puneet started his career in a call-centre role. At 23 he moved into eCommerce, built and scaled an eCommerce team, and worked with UAE-based brands — the first time he owned revenue end to end.",
    executed: [
      "Moved from a call-centre role into eCommerce operations at 23.",
      "Built and scaled an eCommerce team from scratch.",
      "Ran marketplace and growth work for UAE-based brands.",
    ],
    insight:
      "The call centre taught him what customers actually say when nobody is polishing it. That habit — listen first, then build — shows up in every product on this map.",
    proof: [{ label: "The Paan Legacy pitch deck, founder bio (Oct 2024)" }],
  },
  {
    id: "ekrayah",
    title: "Ekrayah",
    cluster: "operator",
    year: 2019, // CONFIRM
    status: "archived",
    weight: 3,
    tagline: "Founder #1: a ₹1 Cr/month global dropshipping operation across 10+ marketplaces.",
    brief:
      "Ekrayah was Puneet's first company: a cross-border dropshipping and multi-marketplace operation that he scaled to ₹1 Cr a month in sales across 10+ global platforms.",
    executed: [
      "Founded and scaled Ekrayah to ₹1 Cr/month in global dropshipping sales.",
      "Ran multi-marketplace operations across 10+ global platforms.",
      "Went deep on performance marketing and eCommerce automation: Amazon SP-API integrations and repricer systems.",
    ],
    how: [
      "Source products and list them across 10+ global marketplaces",
      "Automated repricers via Amazon SP-API to stay competitive",
      "Performance marketing to drive demand",
      "Orders routed to suppliers and shipped direct to the customer",
    ],
    stack: ["Amazon SP-API", "Repricer systems", "Multi-marketplace ops", "Performance marketing"],
    metrics: [
      { value: "₹1 Cr", label: "monthly sales at peak", source: "D2C Insider AI Bootcamp instructor bio" },
      { value: "10+", label: "global marketplaces", source: "D2C Insider AI Bootcamp instructor bio" },
    ],
    insight:
      "Automation was the margin. Repricing by hand doesn't scale across 10 marketplaces, so he learned to make systems do the work — the seed of everything he later built with AI.",
    proof: [{ label: "Instructor bio on d2cinsider.ai/bootcamp" }],
  },

  // ───────────────────────── BRANDS ─────────────────────────
  {
    id: "paan-legacy",
    title: "The Paan Legacy",
    cluster: "brands",
    year: 2023,
    status: "live",
    weight: 3,
    tagline: "Gourmet, tobacco-free paan. Top 5 on Zomato & Swiggy in 7 months.",
    brief:
      "A modern gourmet take on a traditional Indian experience: hand-folded, tobacco-free paan and mukhwas. Started as a proprietorship in December 2023, incorporated as Punyakriya Industries Pvt Ltd in July 2024. Now in 4 Mumbai locations and 1 in the Maldives, with B2B supply to caterers and hotels.",
    executed: [
      "Founded the brand and put ₹11 lakh of his own money in (FY 23-24).",
      "Took it to Top 5 brands on Zomato & Swiggy within 7 months.",
      "Built a B2B line: 5 caterers and 3 four-star hotels as partners (as of Oct 2024).",
      "Grew to 4 Mumbai locations plus 1 in the Maldives.",
      "Got Meta Business Verification for the company — later reused to launch theZio.",
      "Then wrote the software to run it: a custom commerce platform and a finance CRM.",
    ],
    metrics: [
      { value: "Top 5", label: "on Zomato & Swiggy in 7 months", source: "Pitch deck, Oct 2024" },
      { value: "4,500+", label: "customers in 8 months", source: "Pitch deck, Oct 2024" },
      { value: "40,000+", label: "paans sold in 8 months", source: "Pitch deck, Oct 2024" },
      { value: "30%", label: "MoM growth", source: "Pitch deck, Oct 2024" },
      { value: "50%+", label: "repeat order ratio", source: "Pitch deck, Oct 2024" },
      { value: "4.7★", label: "average rating", source: "Pitch deck, Oct 2024" },
      { value: "75%", label: "gross margin", source: "Angel network application, 2024" },
      { value: "14%", label: "avg EBITDA (4 months, positive)", source: "Pitch deck, Oct 2024" },
      { value: "4 + 1", label: "Mumbai locations + Maldives", source: "Bootcamp instructor bio, 2026" },
    ],
    insight:
      "Paan is a ₹-crore habit with zero brands. He didn't need to invent demand — just make it hygienic, tobacco-free and deliverable, then let aggregator ratings do the marketing.",
    proof: [
      { label: "thepaanlegacy.com", url: "https://thepaanlegacy.com" },
      { label: "Pitch deck & angel application (Oct 2024)" },
    ],
  },
  {
    id: "paan-commerce",
    title: "Paan Legacy Commerce OS",
    cluster: "brands",
    year: 2026,
    status: "building",
    weight: 2,
    tagline: "A custom storefront + kitchen board + loyalty engine that replaces Shopify.",
    brief:
      "Instead of renting Shopify, Puneet built The Paan Legacy its own commerce platform: storefront, kitchen order board and admin on one deployment, with loyalty built in. Designed to become a multi-tenant ordering and first-party-data layer for restaurants, with The Paan Legacy as tenant #1.",
    executed: [
      "Designed a three-in-one app split by host: storefront, orders.* kitchen board and admin.* dashboard.",
      "Built two fulfilment lanes: sealed packs shipped pan-India, and fresh paan from a counter.",
      "Wrote a 5-stage discount-stacking engine with GST-correct allocation.",
      "Enforced a 26-state order machine with a database trigger, plus a transactional outbox for notifications.",
      "Shipped loyalty: points ledger, tiers, stamps, missions and streaks.",
    ],
    how: [
      "Storefront layout resolved from the database — a new homepage rail is a row, not a deploy",
      "Same cart engine runs on client and server; order re-quoted server-side in a transaction",
      "Razorpay webhook confirms payment (gateway swappable behind an interface)",
      "Order state machine + outbox fire SMS/WhatsApp/email updates",
    ],
    stack: ["Next.js 15", "TypeScript", "Drizzle ORM", "Neon Postgres + RLS", "Razorpay", "MSG91 OTP", "Resend", "Vercel"],
    metrics: [
      { value: "66", label: "products imported across 10 categories", source: "repo README" },
      { value: "26", label: "order states, DB-enforced", source: "repo roadmap" },
      { value: "~34k", label: "lines of code", source: "repo line count" },
    ],
    insight:
      "Shopify assumes you ship boxes. A paan brand also sells fresh product from a counter in 20 minutes — so the data model had to treat both lanes as first-class.",
    proof: [{ label: "github: eatpaanlegacy (private)" }, { label: "eatpaanlegacy.com" }],
  },
  {
    id: "paan-crm",
    title: "Paan Legacy Finance CRM",
    cluster: "brands",
    year: 2026,
    status: "live",
    weight: 2,
    tagline: "Invoicing, payables, aggregator P&L and WhatsApp marketing — live in production.",
    brief:
      "The internal operating system for The Paan Legacy's money: GST invoices, vendor payables, Zomato/Swiggy settlement P&L, bank reconciliation and WhatsApp broadcasts, wired to Zoho Books. Live at crm.thepaanlegacy.com.",
    executed: [
      "Built a GST-compliant invoice generator that auto-splits CGST/SGST vs IGST and writes to Zoho Books.",
      "Built vendor → PO → bill → payment flows with AR/AP ageing.",
      "Automated Gmail ingestion of bank statements and Zomato/Swiggy settlement files.",
      "Built a settlement-waterfall P&L and monthly MIS/EBITDA view.",
      "Shipped a WhatsApp broadcast engine with campaigns, inbox and opt-outs.",
      "Wrote 439 automated tests and runs it in production with role-based access.",
    ],
    how: [
      "Gmail API pulls bank & aggregator settlement files daily",
      "Parsers normalise IDFC, Zomato, Swiggy and hotel files into Postgres",
      "P&L / MIS computed from the settlement waterfall",
      "Invoices and bills pushed to Zoho Books; WhatsApp Cloud API for outreach",
    ],
    stack: ["Next.js 15", "Supabase", "Zoho Books API", "Gmail API", "WhatsApp Cloud API", "Vercel Cron", "Vitest"],
    metrics: [
      { value: "439", label: "automated tests", source: "repo CLAUDE.md" },
      { value: "81", label: "commits in ~5 weeks", source: "GitHub history" },
      { value: "~35k", label: "lines of code", source: "repo line count" },
    ],
    insight:
      "Aggregator payouts hide commissions, ads and penalties in one net number. He reverse-engineered the settlement files so the P&L shows where every rupee went.",
    proof: [{ label: "crm.thepaanlegacy.com (login required)" }],
  },
  {
    id: "ilikaa",
    title: "ilikaa",
    cluster: "brands",
    year: 2026,
    status: "experiment",
    weight: 1,
    tagline: "A luxury hospitality brand concept — 'Hidden Gems Within India'.",
    brief:
      "ilikaa (Sanskrit for 'earth') is a luxury hospitality brand concept inspired by Aman: curated properties, private chefs, butlers and wellness. Puneet built the brand site end to end as a pre-launch test.",
    executed: [
      "Wrote the positioning: 'disconnect from the world, reconnect with nature'.",
      "Designed and shipped the brand website with an Aman-style enquiry flow.",
    ],
    stack: ["HTML/CSS/JS", "Vercel"],
    proof: [{ label: "github: ilikaa (private)" }],
  },

  // ───────────────────────── D2C INSIDER ─────────────────────────
  {
    id: "d2c-insider",
    title: "D2C Insider",
    cluster: "community",
    year: 2024, // CONFIRM start year
    status: "live",
    weight: 3,
    tagline: "Leads community + partnerships at one of India's largest D2C founder communities.",
    brief:
      "D2C Insider (founded by Abhishek Shah) is one of India's largest D2C founder communities. Puneet leads community and partnerships, and is the sole developer behind its AI-era products: the D2C Insider AI hub, the Frontier D2C×AI Summit platform and the AI Bootcamp.",
    executed: [
      "Leads community and partnerships.",
      "Closed sponsorships: Airpay as Title Partner and GoKwik as Supporting Partner for the CXO Meets.",
      "Built the full Frontier Summit tech stack and the AI Bootcamp product solo.",
      "Built the community's service-provider network and redesigned the main site.",
      "Teaches at the AI Bootcamp.",
    ],
    metrics: [
      { value: "30,000+", label: "operators in the community", source: "d2cinsider.ai bootcamp page" },
      { value: "10K+", label: "founders trained across 40+ cities", source: "D2C Insider workshop page" },
    ],
    insight:
      "Communities run on trust, and sponsors buy access to that trust. His job is to make both sides win: founders get rooms worth being in, partners get the right founders.",
    proof: [
      { label: "d2cinsider.ai", url: "https://d2cinsider.ai" },
      { label: "d2cinsider.com", url: "https://d2cinsider.com" },
    ],
  },
  {
    id: "sponsorships",
    title: "Sponsorships Closed",
    cluster: "community",
    year: 2025, // CONFIRM
    status: "shipped",
    weight: 3,
    tagline: "Airpay signed as Title Partner. GoKwik locked in as Supporting Partner.",
    brief:
      "Puneet closed the partner deals behind D2C Insider's CXO Meets: Airpay as Title Partner and GoKwik as Supporting Partner, and brought multiple senior brands into the rooms.",
    executed: [
      "Signed Airpay as Title Partner.",
      "Locked in GoKwik as Supporting Partner.",
      "Brought multiple senior brands into D2C Insider CXO Meets.",
      "Packaged sponsor inventory: keynotes, founder panels, AI experience zone and warm founder introductions.",
    ],
    how: [
      "Map which founders a partner actually needs to meet",
      "Package inventory around that access: keynote, panel, experience zone, intros",
      "Close the deal; deliver the room",
      "Report back with the introductions made",
    ],
    metrics: [
      { value: "Title", label: "Airpay", source: "puneet's consulting site" },
      { value: "Supporting", label: "GoKwik", source: "puneet's consulting site" },
    ],
    insight:
      "Sponsors don't buy logos on a banner; they buy the right ten conversations. Selling the intros, not the stage, is what closed these.",
    proof: [{ label: "Partner list on D2C Insider CXO Meet materials" }],
  },
  {
    id: "frontier",
    title: "Frontier — D2C × AI Summit",
    cluster: "community",
    year: 2026,
    status: "live",
    weight: 3,
    tagline: "India's first D2C AI summit. Sold-out 1st edition. Puneet built the entire platform solo.",
    brief:
      "Frontier is D2C Insider's AI summit series: Gurugram (21 Aug 2026, sold out), Mumbai (10 Oct 2026) and Bangalore (28 Nov 2026). Puneet is the sole developer of everything behind it: landing pages, registration, checkout, GST invoicing, entry passes, door check-in, WhatsApp automation and an AI networking concierge.",
    executed: [
      "Built registration → checkout → GST invoice → QR entry pass → door check-in, end to end.",
      "Built date-driven price slabs and group discounts, identical on client and server.",
      "Automated the attendee lifecycle on WhatsApp and email: passes, reminders, abandoned-cart recovery.",
      "Shipped Frontier Concierge, an AI matchmaker that ranks who an attendee should meet and makes double opt-in intros.",
      "Built internal ops consoles: CRM, check-in, coupons, badges.",
    ],
    how: [
      "Lead captured on a static page → Razorpay order created",
      "Webhook claims payment, issues an atomic-numbered GST invoice and mints one QR pass per seat",
      "Cron sweeps send passes and reminders over email + WhatsApp (Spur)",
      "At the venue: offline QR check-in; attendees sign into Concierge with their badge",
      "Concierge scores attendees, Claude Haiku writes the 'why you should meet', intros are double opt-in",
    ],
    stack: ["HTML/CSS/JS", "Netlify Functions", "Supabase", "Razorpay", "Spur WhatsApp", "Resend", "Meta CAPI", "Claude Haiku"],
    metrics: [
      { value: "Sold out", label: "1st edition, Gurugram", source: "d2cinsider.ai/frontier" },
      { value: "14", label: "brand partners, 1st edition", source: "Frontier partner deck" },
      { value: "45+", label: "founders & speakers", source: "Frontier partner deck" },
      { value: "350+", label: "brands have been in the room", source: "d2cinsider.ai/frontier" },
      { value: "87", label: "serverless functions shipped", source: "repo count" },
      { value: "~70k", label: "lines of code", source: "repo line count" },
    ],
    insight:
      "Events leak money between 'interested' and 'checked in'. He treated the summit like a D2C funnel — slabs, abandoned carts, WhatsApp nudges — then added AI where events are weakest: who should I meet?",
    proof: [
      { label: "d2cinsider.ai/frontier", url: "https://d2cinsider.ai/frontier" },
      { label: "Partners: Shiprocket fastrr, IDFC FIRST Bank, Fynd, GetVantage, Emiza, base.com, hustle.ai" },
    ],
  },
  {
    id: "cxo-meets",
    title: "Regional CXO Meets",
    cluster: "community",
    year: 2024,
    status: "shipped",
    weight: 2,
    tagline: "Closed-door founder rooms across India — Delhi 463, Mumbai 368, Bangalore 335 attendees.",
    brief:
      "D2C Insider's closed-door CXO Meets bring brand founders, enablers and investors into one room per city. The 2024 regional series ran in Delhi, Mumbai and Bangalore, with earlier meets in Hyderabad and Pune, and a 2026 series across Jaipur, Chandigarh, Pune, Ahmedabad, Chennai and Hyderabad.",
    executed: [
      "Worked the regional CXO Meet series — the rooms the Airpay and GoKwik partnerships were sold into.", // CONFIRM exact role
      "Curated founder invite lists from the community database.",
      "Expanded into a 2026 multi-city series.",
    ],
    metrics: [
      { value: "463", label: "Delhi CXO Meet, Oct 2024", source: "D2C Insider attendance records" },
      { value: "368", label: "Mumbai CXO Meet, Nov 2024", source: "D2C Insider attendance records" },
      { value: "335", label: "Bangalore CXO Meet, Dec 2024", source: "D2C Insider attendance records" },
      { value: "2,888", label: "contacts with event attendance on record", source: "D2C Insider master database" },
    ],
    insight: "A great room is a guest list problem. Get the list right and sponsors, speakers and founders all show up for each other.",
    proof: [{ label: "Attendance records in the D2C Insider master database" }],
  },
  {
    id: "master-db",
    title: "D2C Insider Master Database",
    cluster: "community",
    year: 2026,
    status: "building",
    weight: 2,
    tagline: "15,553 community records from 6 sources, deduplicated into one CRM.",
    brief:
      "D2C Insider's contacts lived in spreadsheets from summits, CXO registrations and invite lists. Puneet is turning them into one multi-user CRM with a staging area, a dedup engine and human approval before anything reaches the master.",
    executed: [
      "Merged 15,553 records from 6 sources into one dataset.",
      "Built a dedup engine: email auto-merges, phone never auto-merges, fuzzy matches go to human review.",
      "Designed the schema: contacts, events, attendance, interactions, staging, audit log, with role-based access.",
      "Quarantined 271 records with no contact key instead of guessing.",
    ],
    how: ["Import batch → normalise", "Classify: NEW / DUPLICATE / POSSIBLE / CONFLICT", "Human review for anything fuzzy", "Approved records merged into the master, with an audit trail"],
    stack: ["Next.js 16", "Supabase + RLS", "Postgres audit triggers", "Levenshtein matching", "Vitest"],
    metrics: [
      { value: "15,553", label: "records unified", source: "repo spec" },
      { value: "~9,960", label: "companies", source: "dataset aggregate" },
      { value: "3,714 / 2,504 / 795", label: "brands / enablers / investors", source: "dataset aggregate" },
    ],
    proof: [{ label: "github: d2cinsider-master-database (private)" }],
  },
  {
    id: "service-network",
    title: "Insider Service Provider Network",
    cluster: "community",
    year: 2026,
    status: "building",
    weight: 1,
    tagline: "A login-gated guest list of vetted vendors for D2C founders.",
    brief:
      "Founders find agencies and vendors through scattered WhatsApp recommendations. This turns that trust into a curated, approval-gated directory across 16 service categories — 'not an open marketplace; a guest list'.",
    executed: [
      "Wrote the blueprint and phased roadmap.",
      "Built two-sided, approval-gated signup with Postgres row-level security.",
      "Shipped 16 categories with filters, provider profiles and team-routed enquiries.",
      "Wrote an admin runbook so the team can run it without a developer.",
    ],
    stack: ["Next.js 15", "Supabase Auth + RLS", "Tailwind", "Vercel"],
    proof: [{ label: "github: insider-service-provider-network (private)" }],
  },
  {
    id: "workshop-os",
    title: "Workshop OS",
    cluster: "community",
    year: 2026,
    status: "shipped",
    weight: 1,
    tagline: "One platform for every D2C Insider workshop — a new event is a config row, not code.",
    brief:
      "A reusable event engine for D2C Insider workshops, bootcamps and masterclasses. Each event is set up from an admin config row: funnel pages, Razorpay checkout, and post-payment email, WhatsApp, Slack and CRM automation.",
    executed: [
      "Built config-driven funnel pages with SEO structured data.",
      "Built idempotent Razorpay registration plus fault-isolated post-payment automation.",
      "Shipped an analytics dashboard with UTM attribution — Lighthouse SEO, a11y and best practices all at 100.",
    ],
    stack: ["Next.js 16", "Supabase", "Razorpay", "Mux", "AiSensy WhatsApp", "Resend"],
    metrics: [{ value: "100", label: "Lighthouse SEO / a11y / best-practices", source: "repo README" }],
    proof: [{ label: "d2cinsider.ai/workshop" }],
  },

  // ───────────────────────── AI PRODUCTS ─────────────────────────
  {
    id: "thezio",
    title: "theZio",
    cluster: "ai",
    year: 2026,
    status: "live",
    weight: 3,
    tagline: "Instagram comment-to-DM automation for Indian creators. Founder, live at thezio.co.",
    brief:
      "theZio turns Instagram engagement into revenue: a fan comments a keyword and instantly gets a DM with the link, product or offer. Built for Indian creators at ₹499/month against dollar-priced tools, with an AI DM agent and an AI brand-deal inbox on top.",
    executed: [
      "Founded and built the whole product: engine, dashboard, billing and growth.",
      "Got the Meta app approved and live, using The Paan Legacy's verified business.",
      "Built keyword, 'any comment', story-reply and mention automations with follow-gate and email capture.",
      "Built digital product delivery with signed private download links.",
      "Shipped an AI brand-deal inbox that spots sponsorship enquiries (including Hinglish) and drafts replies.",
      "Shipped an AI DM agent grounded only in the creator's FAQs, with code checks that block made-up links and prices.",
      "Launched a 30% affiliate program, link-in-bio pages and an SEO blog with 13 posts.",
    ],
    how: [
      "Instagram webhook → always-on engine verifies the HMAC signature",
      "Matcher finds the trigger (keyword, any comment, story reply, mention)",
      "DM job queued in BullMQ, rate-limited to 700/hr under Instagram's 750/hr cap",
      "Worker sends the DM, runs the follow-gate / email state machine",
      "Claude Haiku scores unmatched messages for brand deals and answers FAQs safely",
    ],
    stack: [
      "TypeScript",
      "Node/Express on Railway",
      "BullMQ + Redis",
      "Next.js 16",
      "Supabase",
      "Instagram Graph API",
      "Razorpay subscriptions",
      "Cloudflare R2",
      "Claude Haiku 4.5",
    ],
    metrics: [
      { value: "₹499", label: "Pro / month (Free: 1,000 DMs)", source: "thezio.co pricing" },
      { value: "700/hr", label: "DM throughput per account", source: "engine config" },
      { value: "54", label: "database migrations", source: "repo" },
      { value: "~85k", label: "lines of code", source: "repo line count" },
    ],
    insight:
      "Indian creators were paying dollar prices for ManyChat-style tools built for US funnels. The wedge: rupee pricing, Hinglish-aware AI, and turning the DMs creators already get into brand deals.",
    proof: [
      { label: "thezio.co", url: "https://thezio.co" },
      { label: "Meta app review: approved, Live mode" },
    ],
  },
  {
    id: "troofrnd",
    title: "Troofrnd",
    cluster: "ai",
    year: 2026,
    status: "building",
    weight: 3,
    tagline: "AI LinkedIn ghostwriter that can't make things up: every claim cites a source.",
    brief:
      "Troofrnd learns a founder's 'Content Brain', turns real news into posts where every claim is tied to a verbatim quote from a source, generates the image, and publishes to LinkedIn after approval. It productises the system Puneet uses for his own daily LinkedIn content.",
    executed: [
      "Designed a fact-integrity pipeline: evidence IDs, coverage checks, an independent model judge and database constraints.",
      "Built a shared news corpus crawled every 6 hours per industry — the difference between ~$400 and ~$8,000/month at 100 users.",
      "Routed models by job: Haiku to triage, Sonnet to verify, Opus to write.",
      "Built durable workflows for scheduling, because LinkedIn has no scheduling API.",
      "Shipped a Chrome extension for the user's own LinkedIn analytics, and a paid hallucination regression suite.",
    ],
    how: [
      "Cron research: discover → validate → dedupe → cheap filter → extract verbatim evidence",
      "User request: score & select stories → plan → generate claim-by-claim with evidence IDs",
      "Validate: deterministic ID check + independent judge; unsupported 'facts' are rejected by the DB",
      "Image via fal.ai → human approval → publish via LinkedIn API",
    ],
    stack: ["Next.js 16", "Vercel Workflow", "Vercel AI SDK", "Claude Haiku / Sonnet / Opus", "Supabase + pgvector", "Exa / Tavily", "fal.ai", "LinkedIn API"],
    metrics: [
      { value: "20x", label: "cheaper via shared corpus (~$400 vs ~$8k/mo)", source: "repo README" },
      { value: "~42k", label: "lines of code", source: "repo line count" },
    ],
    insight:
      "AI content fails on trust, not fluency. So he made hallucination structurally impossible to save, not just discouraged in a prompt.",
    proof: [{ label: "troofrnd.com" }],
  },
  {
    id: "saarthi",
    title: "Saarthi (Personal AI OS)",
    cluster: "ai",
    year: 2026,
    status: "shipped",
    weight: 2,
    tagline: "An always-on agent that runs his calendar, inboxes, health and business pulse.",
    brief:
      "Saarthi ('the charioteer') is Puneet's personal AI chief of staff. It watches his calendars, inboxes, Shopify, Zoho Books and Meta Ads, acts on a schedule, and asks for approval on Telegram or WhatsApp before doing anything risky.",
    executed: [
      "Built ~36 agent tools across calendar, mail, memory, people, health, tasks and business metrics.",
      "Built a 3-tier approval gate with every action logged.",
      "Shipped nine scheduled loops: 5-minute pulse, morning brief, nightly plan, Sunday review and more.",
      "Added voice in and out, plus two-way Telegram and WhatsApp approvals.",
    ],
    how: ["SENSE: connectors + logs", "THINK: Claude with layered memory and standing rules", "ACT: tools behind an approval gate", "LEARN: nightly memory consolidation"],
    stack: ["Next.js 15", "Claude Opus", "Supabase + pgvector", "Drizzle", "Telegram", "WhatsApp", "ElevenLabs"],
    metrics: [
      { value: "~36", label: "agent tools", source: "repo" },
      { value: "9", label: "autonomous scheduled loops", source: "repo" },
      { value: "$45–90", label: "per month to run", source: "repo README" },
    ],
    proof: [{ label: "github: puneet_ai (private)" }],
  },
  {
    id: "captain-deck",
    title: "Captain Deck",
    cluster: "ai",
    year: 2026,
    status: "shipped",
    weight: 1,
    tagline: "One screen for every project and both businesses — collected by headless Claude.",
    brief:
      "A personal command centre: a radar across all his repos plus revenue, receivables and order alerts. A Mac collector runs headless Claude Code with MCP connectors every 30 minutes and pushes a snapshot, so no third-party secrets live on the server.",
    executed: [
      "Built a project radar that reads a status file from every repo.",
      "Built Shopify revenue and quiet-store alerts plus Zoho receivables ageing.",
      "Used headless Claude + MCP as the data collector, with guards against invented numbers.",
    ],
    stack: ["Next.js 16", "MUI", "ApexCharts", "Claude Code (headless) + MCP", "Vercel Blob"],
    proof: [{ label: "github: captain-deck (private)" }],
  },
  {
    id: "claudeskill",
    title: "ClaudeSkill Toolkit",
    cluster: "ai",
    year: 2026,
    status: "shipped",
    weight: 2,
    tagline: "Open-source Claude Code skills: token-cost screener and ship-safe security checks.",
    brief:
      "A Claude Code plugin marketplace with 8 free skills. Token Screener shows where AI coding spend goes and how much was avoidable. The Ship-Safe suite runs pre-flight checks for apps built fast: destructive DB commands, leaked secrets, Supabase RLS, Stripe and deploy config.",
    executed: [
      "Built Token Screener: 7 waste detectors, cache-aware cost attribution, HTML report, 31 tests.",
      "Profiled his own usage: 6.15B tokens, $1,451 of $4,537 flagged as avoidable (32%).",
      "Built the Ship-Safe suite: db-guard, deploy-check, rls-audit, secret-sweep, stripe-check, ship-check.",
      "Shipped the catalogue site with generated install pages.",
    ],
    stack: ["Python stdlib", "Claude Code plugins", "Next.js 16", "Supabase"],
    metrics: [
      { value: "8", label: "free skills published", source: "skills registry" },
      { value: "305 / 420MB", label: "transcripts analysed in ~2.4s", source: "repo README" },
      { value: "32%", label: "of his own AI spend found avoidable", source: "demo report" },
    ],
    proof: [
      { label: "github: claude-token-screener", url: "https://github.com/puneet-sharma-18/claude-token-screener" },
      { label: "claudeskill.co" },
    ],
  },
  {
    id: "consumerx",
    title: "ConsumerX Deal Intelligence",
    cluster: "ai",
    year: 2026,
    status: "shipped",
    weight: 2,
    tagline: "AI that reads pitch decks and scores startups for an operator-led consumer fund.",
    brief:
      "ConsumerX Ventures is an operator-led early-stage fund for Indian consumer brands, connected to D2C Insider's Super Angels network. Puneet built its website, investor KYC and founder application flows, plus an internal AI evaluation engine that turns a pitch deck into a 7-dimension investment memo.",
    executed: [
      "Built consumerx.vc with founder applications and investor KYC (private document storage, insert-only security).",
      "Built the deal back-office: pipeline, analyst reviews, role-based access.",
      "Built the AI evaluator: Claude reads deck + business plan + website and scores 7 dimensions with evidence quotes.",
      "Kept the maths in code, not the model: terms sanity, dilution, runway, forecast and the final verdict.",
      "Made the scoring thesis editable per analyst, with a versioned rubric as the learning loop.",
    ],
    how: [
      "Founder applies → deck & business plan stored privately",
      "Engine pulls PDFs + does a quick web check",
      "Claude returns qualitative scores, evidence quotes, inconsistencies, questions (structured output)",
      "Code computes composite score + verdict (investable ≥70) → analyst reviews",
    ],
    stack: ["Next.js 16", "Claude Sonnet (structured outputs)", "Zod", "Supabase", "Netlify"],
    metrics: [
      { value: "7", label: "scoring dimensions", source: "repo" },
      { value: "₹/eval", label: "cost logged per evaluation", source: "repo" },
    ],
    insight: "LLMs are good judges of narrative and bad at arithmetic. So the model reads, and the code counts.",
    proof: [{ label: "consumerx.vc", url: "https://consumerx.vc" }],
  },
  {
    id: "jarvis-hud",
    title: "J.A.R.V.I.S HUD",
    cluster: "ai",
    year: 2026,
    status: "shipped",
    weight: 1,
    tagline: "The original Iron-Man style command screen — the ancestor of this page's Jarvis.",
    brief:
      "A heads-up display for his day: quick-attention alerts tagged SPONSOR / APPROVE / MONEY, calendar with join links, tasks and inbox, auto-refreshing every 5 minutes. The first step toward Captain Deck and Saarthi.",
    executed: ["Designed and shipped the HUD.", "Built a data-file pipeline so any job can update it with a git push."],
    stack: ["HTML/CSS/JS", "Vercel"],
    proof: [{ label: "github: jarvis-dashboard (private)" }],
  },
  {
    id: "graveyard",
    title: "Graveyard of Ideas",
    cluster: "ai",
    year: 2026,
    status: "experiment",
    weight: 1,
    tagline: "Log an idea, let AI research it overnight, exhume the good ones.",
    brief:
      "A two-person idea lab: ideas move from Uncharted → Researching → Case Filed → Exhumed → Laid to Rest. Free signals come from Wikipedia, Hacker News and GitHub; a daily Claude routine writes a verdict, 0–100 score, competitors and risks.",
    executed: ["Built realtime collaboration on Supabase.", "Wired a daily Claude research routine.", "Added a scoring rubric including founder-fit."],
    stack: ["Vanilla JS", "Supabase realtime", "Claude Code routine"],
    proof: [{ label: "github: graveyard-of-ideas (private)" }],
  },
  {
    id: "ride-sync",
    title: "Ride Sync",
    cluster: "ai",
    year: 2026,
    status: "shipped",
    weight: 1,
    tagline: "Same song, same instant, on two different-brand motorcycle intercoms.",
    brief:
      "A rider problem solved with engineering: two helmets with different-brand Bluetooth intercoms can't share music. Ride Sync syncs playback across an Android and an iPhone to within milliseconds, without touching the intercom's talk channel.",
    executed: [
      "Built native Android (Kotlin) and iOS (Swift) apps plus a WebSocket relay.",
      "Built clock sync with 'PLAY at T' timestamps and drift correction every 5 seconds.",
      "Measured headset latency (100–250ms) and added a per-headset trim.",
    ],
    stack: ["Kotlin + Media3", "Swift + AVAudioEngine", "Node WebSocket relay"],
    metrics: [{ value: "<100ms", label: "drift tolerance", source: "repo" }],
    insight: "If he can't buy a fix, he builds one — in any stack the problem needs.",
    proof: [{ label: "github: ride-sync (private)" }],
  },

  // ───────────────────────── TEACHING ─────────────────────────
  {
    id: "ai-bootcamp",
    title: "D2C AI Bootcamp",
    cluster: "education",
    year: 2026,
    status: "live",
    weight: 3,
    tagline: "Founders build a 10-agent AI team on their own brand's live data in 2 days.",
    brief:
      "A two-day bootcamp (theCRUX × D2C Insider) where D2C founders leave with a working AI system on their own brand's data: market intel, customer voice, content factory, ad engine, growth dashboard, ops autopilot — plus a Telegram 'AI team on your phone'. Puneet is an instructor and built the product and its sales platform.",
    executed: [
      "Designed the curriculum kit: CLAUDE.md as a 'Brand Brain' plus 9 Claude skills and an orchestrator.",
      "Built the Shopify and Meta Ads data-sync scripts founders run on day one.",
      "Built the bootcamp's checkout, invoicing and onboarding on d2cinsider.ai.",
      "Teaches the cohort as an instructor.",
    ],
    how: [
      "Day 1: Brand Brain (CLAUDE.md) + live Shopify/Meta data sync",
      "Skills: market-intel → customer-voice → content-factory → ad-engine",
      "Day 2: growth dashboard, ops autopilot, 'command-center' orchestrator",
      "Telegram bot puts the AI team on the founder's phone",
    ],
    stack: ["Claude Code", "Claude Skills", "Telegram bot", "Shopify API", "Meta Ads API"],
    metrics: [
      { value: "100+", label: "founders trained", source: "d2cinsider.ai/bootcamp" },
      { value: "Cohort V", label: "live and selling", source: "d2cinsider.ai/bootcamp" },
      { value: "25", label: "seats per cohort, 1:8 TA ratio", source: "d2cinsider.ai/bootcamp" },
      { value: "₹29,999", label: "per seat", source: "d2cinsider.ai/bootcamp" },
    ],
    proof: [
      { label: "d2cinsider.ai/bootcamp", url: "https://d2cinsider.ai/bootcamp" },
      { label: "github: d2c-ai-bootcamp", url: "https://github.com/puneet-sharma-18/d2c-ai-bootcamp" },
      { label: "github: d2c-day-1", url: "https://github.com/puneet-sharma-18/d2c-day-1" },
    ],
  },
  {
    id: "anutilam",
    title: "Anutilam AI Command Center",
    cluster: "education",
    year: 2026,
    status: "shipped",
    weight: 1,
    tagline: "The prototype: a 5-skill AI operating system for a heritage-food brand.",
    brief:
      "The first version of the bootcamp system, built for Anutilam, a farm-sourced Maharashtra food brand. Five chained Claude skills produce market intel, customer voice, content, ads and ops playbooks — with brand-safety guardrails (no 'certified organic', no medical claims).",
    executed: [
      "Wrote the Brand Brain: voice, personas, SKUs, competitors and FSSAI/AYUSH guardrails.",
      "Built 5 chained skills where intelligence files feed content and ads, and stale inputs are flagged.",
      "Generated Hinglish WhatsApp retention flows and vendor SOPs.",
    ],
    stack: ["Claude Code", "Claude Skills", "Markdown outputs"],
    proof: [{ label: "github: d2c-command-center (private)" }],
  },
  {
    id: "claudeskill-courses",
    title: "Claudeskill Live Courses",
    cluster: "education",
    year: 2026,
    status: "building",
    weight: 1,
    tagline: "Live Zoom courses on building real systems with Claude.",
    brief:
      "A platform that sells seats in live courses: a 12-week flagship cohort, an 8-week 'Claude for D2C' track and 14 signature builds — including the LinkedIn system behind his own content.",
    executed: [
      "Built server-side pricing, coupons and tiers in integer paise.",
      "Made course access webhook-only (signature-checked, replay-safe) with an oversell-proof seat claim.",
      "Built funnel analytics by UTM source and Zoom attendance import; 93 tests.",
    ],
    stack: ["Next.js 16", "Drizzle", "Supabase", "Razorpay", "Resend", "Meta CAPI"],
    proof: [{ label: "claudeskill.co" }],
  },
  {
    id: "linkedin-engine",
    title: "Daily LinkedIn Engine",
    cluster: "education",
    year: 2026,
    status: "live",
    weight: 2,
    tagline: "5 posts a day breaking down India's D2C and quick-commerce news.",
    brief:
      "Puneet writes daily breakdowns of India's D2C, creator and quick-commerce landscape on LinkedIn. He runs it as a system: a fresh 7-day news scan, story selection, posts in his own voice and matching image prompts — the same system Troofrnd turns into a product.",
    executed: [
      "Built the end-to-end content system as Claude skills: scan, select, write, image.",
      "Encoded his voice rules: open with a hook, short after long, warm but direct, never corporate.",
      "Built 'AI Signal': a scheduled cloud agent that researches AI news at 7am and publishes 3 sourced drafts daily.",
      "Ships daily.",
    ],
    how: ["Scan India D2C/startup news from the last 7 days", "Pick viral-worthy founder stories", "Write 5 posts in his voice", "Generate founder-led image prompts"],
    stack: ["Claude Skills", "Web research"],
    proof: [{ label: "LinkedIn: Puneet Sharma" }],
  },
];

export const edges: Edge[] = [
  { from: "call-centre", to: "ekrayah", label: "Learned eCom ops on someone else's P&L, then started his own." },
  { from: "ekrayah", to: "paan-legacy", label: "Marketplace + performance-marketing playbook applied to his own brand." },
  { from: "ekrayah", to: "thezio", label: "Years of automating marketplaces became automating Instagram." },
  { from: "paan-legacy", to: "paan-commerce", label: "Outgrew Shopify — so he built the platform." },
  { from: "paan-legacy", to: "paan-crm", label: "Aggregator payouts were a black box, so he built the finance OS." },
  { from: "paan-legacy", to: "thezio", label: "The Paan Legacy's verified Meta business got theZio approved." },
  { from: "paan-legacy", to: "d2c-insider", label: "Founder credibility opened the D2C Insider door." },
  { from: "d2c-insider", to: "sponsorships", label: "Community trust, packaged for partners." },
  { from: "d2c-insider", to: "frontier", label: "Summits needed a real ticketing + ops stack." },
  { from: "d2c-insider", to: "service-network", label: "Turning WhatsApp vendor recommendations into a product." },
  { from: "sponsorships", to: "frontier", label: "Partner playbook carried into the AI summit." },
  { from: "d2c-insider", to: "cxo-meets", label: "City-by-city closed-door rooms for founders." },
  { from: "cxo-meets", to: "sponsorships", label: "Full rooms are what partners pay for." },
  { from: "cxo-meets", to: "master-db", label: "Every event's attendee list fed one database." },
  { from: "d2c-insider", to: "consumerx", label: "Super Angels network → an operator-led fund that needed deal tooling." },
  { from: "jarvis-hud", to: "captain-deck", label: "Static HUD grew into a live command centre." },
  { from: "frontier", to: "workshop-os", label: "Same funnel engine, generalised for every event." },
  { from: "d2c-insider", to: "ai-bootcamp", label: "The community asked how to use AI — so he taught it." },
  { from: "anutilam", to: "ai-bootcamp", label: "Prototype system became the bootcamp curriculum." },
  { from: "linkedin-engine", to: "troofrnd", label: "His own daily content system, productised." },
  { from: "saarthi", to: "captain-deck", label: "Agent connectors reused for the command centre." },
  { from: "claudeskill", to: "claudeskill-courses", label: "Tools first, then teach how they were built." },
  { from: "ai-bootcamp", to: "claudeskill-courses", label: "Bootcamp demand → a full course platform." },
];

export const chapters: Chapter[] = [
  { year: 2016, title: "Chapter 1 — The phones", text: "Starts in a call centre. At 23, moves into eCommerce and builds a team for UAE brands." }, // CONFIRM
  { year: 2019, title: "Chapter 2 — Founder #1", text: "Ekrayah: dropshipping across 10+ global marketplaces, scaled to ₹1 Cr/month with automation." }, // CONFIRM
  { year: 2023, title: "Chapter 3 — A brand of his own", text: "The Paan Legacy launches. Top 5 on Zomato & Swiggy in 7 months." },
  { year: 2024, title: "Chapter 4 — Into the community", text: "Leads community and partnerships at D2C Insider. Closes Airpay and GoKwik." }, // CONFIRM
  { year: 2026, title: "Chapter 5 — Builder mode", text: "Ships theZio, Frontier, the AI Bootcamp, Troofrnd and more — 28 repos, 338k lines of code in one year." },
];

export const headline = [
  { value: "2×", label: "founder" },
  { value: "₹1 Cr", label: "/ month at Ekrayah" },
  { value: "28", label: "repos shipped in 2026" },
  { value: "338k", label: "lines of code (TS/JS/Py/SQL/Kotlin/Swift)" }, // counted across all repos, Oct 2026
  { value: "100+", label: "founders trained" },
];

/** Production systems pinged live by /api/status — the "proof it's running" panel. */
export const systems = [
  { name: "theZio", url: "https://thezio.co", node: "thezio" },
  { name: "D2C Insider AI / Frontier", url: "https://d2cinsider.ai", node: "frontier" },
  { name: "The Paan Legacy", url: "https://thepaanlegacy.com", node: "paan-legacy" },
  { name: "Paan Legacy CRM", url: "https://crm.thepaanlegacy.com", node: "paan-crm" },
  { name: "ConsumerX", url: "https://consumerx.vc", node: "consumerx" },
  { name: "Troofrnd", url: "https://troofrnd.com", node: "troofrnd" },
  { name: "ClaudeSkill", url: "https://claudeskill.co", node: "claudeskill" },
];
