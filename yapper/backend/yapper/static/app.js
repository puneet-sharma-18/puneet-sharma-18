"use strict";

const app = document.getElementById("app");
const TOKEN_KEY = "yapper.token";
let pollTimer = null;

// ---------- helpers ----------

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function setToken(t) {
  try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ }
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, ...(opts.body ? { "Content-Type": "application/json" } : {}), ...(opts.headers || {}) },
  });
  if (res.status === 401) { askLogin(); throw new Error("unauthorized"); }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const type = res.headers.get("content-type") || "";
  return type.includes("json") ? res.json() : res.text();
}

function askLogin() {
  const dlg = document.getElementById("login");
  if (!dlg.open) dlg.showModal();
}
document.getElementById("login-form").addEventListener("submit", () => {
  setToken(document.getElementById("login-token").value.trim());
  route();
});

function statusBadge(r) {
  if (!r.finished) return `<span class="badge live">Recording</span>`;
  const c = r.chunks;
  if (c.transcribed < c.total) return `<span class="badge warn">Transcribing ${c.transcribed}/${c.total}</span>`;
  if (r.mom_status === "done") return `<span class="badge ok">Minutes ready</span>`;
  if (r.mom_status === "error") return `<span class="badge warn">Minutes failed</span>`;
  return `<span class="badge warn">Writing minutes…</span>`;
}

function setNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
}
function poll(fn, ms) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(fn, ms);
}

// ---------- list ----------

let lastQuery = "";
async function renderList() {
  setNav("list");
  if (!app.querySelector("#search")) {
    app.innerHTML = `
      <div class="row">
        <h1>Conversations</h1><span class="spacer"></span>
        <input id="search" class="search" type="search" placeholder="Search titles, minutes and transcripts…">
      </div>
      <div id="status" class="meta"></div>
      <div id="list" class="list"></div>`;
    const input = app.querySelector("#search");
    input.value = lastQuery;
    let t;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { lastQuery = input.value; renderList(); }, 250); });
  }
  const [items, status] = await Promise.all([
    api(`/api/recordings${lastQuery ? `?q=${encodeURIComponent(lastQuery)}` : ""}`),
    api("/api/status").catch(() => null),
  ]);
  const list = app.querySelector("#list");
  if (!list) return;
  list.innerHTML = items.length ? items.map((r) => `
    <a class="card item" href="#/r/${esc(r.id)}">
      <div class="row"><span class="title">${esc(r.title)}</span><span class="spacer"></span>${statusBadge(r)}</div>
      <div class="meta">${esc(fmtDate(r.started_at))} · ${fmtDuration(r.duration_ms)} · ${esc(r.language)}${r.chunks.errors ? ` · <span class="chunk-err">${r.chunks.errors} failed</span>` : ""}</div>
      ${r.summary ? `<p class="summary">${esc(r.summary)}</p>` : ""}
    </a>`).join("")
    : `<div class="empty">${lastQuery ? "Nothing matches that search." : "No conversations yet. Start a recording from the Yapper app on your phone."}</div>`;
  const st = app.querySelector("#status");
  if (st && status) {
    const bits = [];
    if (status.queue.pending) bits.push(`${status.queue.pending} chunks waiting for transcription`);
    if (status.queue.translating) bits.push(`${status.queue.translating} waiting for translation`);
    if (status.stt_blocked_for_s) bits.push(`Groq speech limit reached, resuming in ${Math.ceil(status.stt_blocked_for_s / 60)} min`);
    st.textContent = bits.join(" · ");
  }
  poll(() => location.hash.startsWith("#/r/") || location.hash.startsWith("#/tasks") || location.hash.startsWith("#/settings") ? null : renderList(), 8000);
}

// ---------- detail ----------

let currentTab = "minutes";
const audioState = { recId: null, chunks: [], seq: null };

function renderMom(rec) {
  const m = rec.mom;
  if (!m) {
    if (rec.mom_status === "error") return `<div class="card"><p>Writing the minutes failed: <span class="muted">${esc(rec.mom_error || "")}</span></p><button data-act="minutes">Try again</button></div>`;
    if (!rec.finished) return `<div class="card empty">Minutes are written when the recording stops. The live transcript is in the Transcript tab.</div>`;
    return `<div class="card empty">Writing the minutes… this can take a few minutes for long conversations.</div>`;
  }
  const list = (title, arr) => (arr && arr.length ? `<h2>${title}</h2><ul>${arr.map((x) => `<li>${esc(typeof x === "string" ? x : JSON.stringify(x))}</li>`).join("")}</ul>` : "");
  const tasks = (m.action_items || []).filter((t) => t && typeof t === "object");
  return `<div class="card mom">
    ${m.summary ? `<h2 style="margin-top:0">Summary</h2><p>${esc(m.summary)}</p>` : ""}
    ${tasks.length ? `<h2>Action items</h2>${tasks.map((t, i) => `
      <label class="task ${t.done ? "done" : ""}">
        <input type="checkbox" data-task="${i}" ${t.done ? "checked" : ""}>
        <div><div class="task-text">${esc(t.task)}</div>
        <div class="meta">${[t.owner, t.due, t.priority].filter(Boolean).map(esc).join(" · ")}</div></div>
      </label>`).join("")}` : ""}
    ${list("Decisions", m.decisions)}
    ${list("Key points", m.key_points)}
    ${list("Open questions", m.open_questions)}
    ${list("Follow-ups", m.follow_ups)}
    ${list("Participants", m.participants)}
    ${m.topics && m.topics.length ? `<h2>Timeline</h2><ul>${m.topics.map((t) => `<li><span class="meta">${esc(t.time)}</span> ${esc(t.topic)}</li>`).join("")}</ul>` : ""}
  </div>`;
}

function renderTranscript(rec, english) {
  const rows = [];
  for (const c of rec.chunk_list) {
    if (c.status === "error") { rows.push(`<div class="seg"><span class="ts">${fmtDuration(c.start_ms)}</span><div class="chunk-err">Could not transcribe this minute: ${esc(c.error || "")}</div></div>`); continue; }
    if (c.status === "pending") { rows.push(`<div class="seg"><span class="ts">${fmtDuration(c.start_ms)}</span><div class="muted">Transcribing…</div></div>`); continue; }
    if (english) {
      const text = c.text_en || (c.status === "transcribed" ? "Translating…" : c.text);
      if (text) rows.push(`<div class="seg"><button class="ts" data-seq="${c.seq}" data-at="0">${fmtDuration(c.start_ms)}</button><div>${esc(text)}</div></div>`);
      continue;
    }
    for (const s of c.segments.length ? c.segments : [{ start: c.start_ms / 1000, text: c.text }]) {
      if (!s.text) continue;
      rows.push(`<div class="seg"><button class="ts" data-seq="${c.seq}" data-at="${Math.max(0, s.start - c.start_ms / 1000)}">${fmtDuration(s.start * 1000)}</button><div>${esc(s.text)}</div></div>`);
    }
  }
  return `<div class="card">${rows.join("") || `<div class="empty">No speech yet.</div>`}</div>`;
}

function playChunk(seq, at = 0) {
  const audio = document.getElementById("audio");
  if (!audio) return;
  if (audioState.seq !== seq) {
    audio.src = `/api/recordings/${encodeURIComponent(audioState.recId)}/chunks/${seq}/audio?token=${encodeURIComponent(getToken())}`;
    audioState.seq = seq;
  }
  const start = () => { audio.currentTime = at; audio.play().catch(() => {}); };
  if (audio.readyState >= 1) start(); else audio.addEventListener("loadedmetadata", start, { once: true });
}

async function renderDetail(id) {
  setNav("list");
  const rec = await api(`/api/recordings/${encodeURIComponent(id)}`);
  if (!location.hash.startsWith(`#/r/${id}`)) return;
  const fresh = audioState.recId !== id || !document.getElementById("audio");
  audioState.recId = id;
  audioState.chunks = rec.chunk_list.map((c) => c.seq);
  const c = rec.chunks;
  const pct = c.total ? Math.round((100 * c.transcribed) / c.total) : 0;
  const body = currentTab === "minutes" ? renderMom(rec) : renderTranscript(rec, currentTab === "english");
  const header = `
    <p><a href="#/" class="muted">← All conversations</a></p>
    <div class="row"><h1 id="title" title="Click to rename" style="cursor:text">${esc(rec.title)}</h1><span class="spacer"></span>${statusBadge(rec)}</div>
    <div class="meta">${esc(fmtDate(rec.started_at))} · ${fmtDuration(rec.duration_ms)} · language: ${esc(rec.language)} · ${c.total} chunks${rec.device ? ` · ${esc(rec.device)}` : ""}</div>
    ${c.total && pct < 100 ? `<div class="progress"><div style="width:${pct}%"></div></div>` : ""}
    <div class="row actions">
      <button data-act="export">Export .md</button>
      <button data-act="minutes">${rec.mom ? "Regenerate minutes" : rec.finished ? "Write minutes now" : "Stop & write minutes"}</button>
      ${c.errors ? `<button data-act="retry">Retry failed (${c.errors})</button>` : ""}
      <button data-act="delete" class="danger">Delete</button>
    </div>
    <div class="tabs">
      <button data-tab="minutes" class="${currentTab === "minutes" ? "active" : ""}">Minutes</button>
      <button data-tab="original" class="${currentTab === "original" ? "active" : ""}">Transcript</button>
      <button data-tab="english" class="${currentTab === "english" ? "active" : ""}">English</button>
    </div>`;
  if (fresh) {
    app.innerHTML = `<div id="detail-head"></div><div id="detail-body"></div>
      <div class="player card"><audio id="audio" controls preload="none"></audio></div>`;
    const audio = document.getElementById("audio");
    audio.addEventListener("ended", () => {
      const i = audioState.chunks.indexOf(audioState.seq);
      if (i >= 0 && i + 1 < audioState.chunks.length) playChunk(audioState.chunks[i + 1], 0);
    });
    app.addEventListener("click", onDetailClick);
    app.addEventListener("change", onDetailChange);
  }
  document.getElementById("detail-head").innerHTML = header;
  document.querySelector(".player").hidden = currentTab === "minutes" && audioState.seq === null;
  const bodyEl = document.getElementById("detail-body");
  const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
  bodyEl.innerHTML = body;
  if (!rec.finished && currentTab !== "minutes" && nearBottom) window.scrollTo(0, document.body.scrollHeight);
  const busy = !rec.finished || c.transcribed < c.total || c.translated < c.transcribed || ["pending", "running"].includes(rec.mom_status);
  poll(() => location.hash === `#/r/${id}` && renderDetail(id), busy ? 5000 : 60000);
}

async function onDetailClick(e) {
  const id = audioState.recId;
  const tab = e.target.closest("[data-tab]");
  if (tab) { currentTab = tab.dataset.tab; return renderDetail(id); }
  const ts = e.target.closest("[data-seq]");
  if (ts) return playChunk(Number(ts.dataset.seq), Number(ts.dataset.at));
  if (e.target.id === "title") {
    const name = prompt("Rename conversation", e.target.textContent);
    if (name !== null) { await api(`/api/recordings/${id}`, { method: "PATCH", body: JSON.stringify({ title: name }) }); renderDetail(id); }
    return;
  }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "minutes") { await api(`/api/recordings/${id}/minutes`, { method: "POST" }); currentTab = "minutes"; renderDetail(id); }
  if (act === "retry") { await api(`/api/recordings/${id}/retranscribe?only_failed=true`, { method: "POST" }); renderDetail(id); }
  if (act === "export") {
    const md = await api(`/api/recordings/${id}/export.md`);
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([md], { type: "text/markdown" })), download: `yapper-${id.slice(0, 8)}.md` });
    a.click();
  }
  if (act === "delete" && confirm("Delete this conversation and its audio permanently?")) {
    await api(`/api/recordings/${id}`, { method: "DELETE" });
    location.hash = "#/";
  }
}

async function onDetailChange(e) {
  const box = e.target.closest("[data-task]");
  if (!box) return;
  await api(`/api/recordings/${audioState.recId}/action-items/${box.dataset.task}`, { method: "PUT", body: JSON.stringify({ done: box.checked }) });
  box.closest(".task").classList.toggle("done", box.checked);
}

// ---------- action items ----------

async function renderTasks() {
  setNav("tasks");
  const showDone = app.querySelector("#show-done")?.checked || false;
  const items = await api(`/api/action-items?include_done=${showDone}`);
  app.innerHTML = `
    <div class="row"><h1>Action items</h1><span class="spacer"></span>
      <label class="meta"><input type="checkbox" id="show-done" ${showDone ? "checked" : ""}> Show done</label></div>
    <p class="muted">Every action item from every set of minutes, newest first.</p>
    <div class="card">${items.length ? items.map((t) => `
      <label class="task ${t.done ? "done" : ""}">
        <input type="checkbox" data-rec="${esc(t.recording_id)}" data-idx="${t.idx}" ${t.done ? "checked" : ""}>
        <div><div class="task-text">${esc(t.task)}</div>
        <div class="meta">${[t.owner, t.due, t.priority].filter(Boolean).map(esc).join(" · ")} · <a href="#/r/${esc(t.recording_id)}">${esc(t.recording_title || "conversation")}</a></div></div>
      </label>`).join("") : `<div class="empty">No open action items.</div>`}</div>`;
  app.querySelector("#show-done").addEventListener("change", renderTasks);
  app.querySelectorAll("[data-rec]").forEach((box) => box.addEventListener("change", async () => {
    await api(`/api/recordings/${box.dataset.rec}/action-items/${box.dataset.idx}`, { method: "PUT", body: JSON.stringify({ done: box.checked }) });
    box.closest(".task").classList.toggle("done", box.checked);
  }));
}

// ---------- settings ----------

async function renderSettings() {
  setNav("settings");
  const [dict, status] = await Promise.all([api("/api/dictionary"), api("/api/status")]);
  app.innerHTML = `
    <h1>Settings</h1>
    <h2>Personal dictionary</h2>
    <p class="muted">Names, companies and jargon, one per line. They are passed to the speech model so it spells them correctly.</p>
    <textarea id="terms" placeholder="e.g.&#10;Puneet&#10;Shopify&#10;D2C">${esc(dict.terms.join("\n"))}</textarea>
    <div class="row" style="margin-top:8px"><button class="primary" id="save-terms">Save</button><span id="saved" class="meta"></span></div>
    <h2>Engine</h2>
    <div class="card meta">
      Speech model: <b>${esc(status.stt_model)}</b><br>
      Minutes models: ${status.mom_models.map(esc).join(" → ")}<br>
      Queue: ${status.queue.pending} to transcribe, ${status.queue.translating} to translate, ${status.queue.errors} failed
      ${Object.keys(status.models_blocked).length ? `<br>Rate-limited now: ${Object.entries(status.models_blocked).map(([m, s]) => `${esc(m)} (${Math.ceil(s / 60)} min)`).join(", ")}` : ""}
    </div>
    <h2>This browser</h2>
    <button id="logout">Forget token</button>`;
  app.querySelector("#save-terms").addEventListener("click", async () => {
    const terms = app.querySelector("#terms").value.split("\n");
    await api("/api/dictionary", { method: "PUT", body: JSON.stringify({ terms }) });
    app.querySelector("#saved").textContent = "Saved";
  });
  app.querySelector("#logout").addEventListener("click", () => { setToken(""); askLogin(); });
}

// ---------- router ----------

async function route() {
  clearTimeout(pollTimer);
  if (!getToken()) return askLogin();
  const hash = location.hash || "#/";
  try {
    if (hash.startsWith("#/r/")) {
      const id = decodeURIComponent(hash.slice(4));
      if (audioState.recId !== id) { currentTab = "minutes"; audioState.seq = null; }
      await renderDetail(id);
    } else {
      audioState.recId = null;
      app.removeEventListener("click", onDetailClick);
      app.removeEventListener("change", onDetailChange);
      if (hash.startsWith("#/tasks")) await renderTasks();
      else if (hash.startsWith("#/settings")) await renderSettings();
      else { app.innerHTML = ""; await renderList(); }
    }
  } catch (err) {
    if (err.message !== "unauthorized") app.innerHTML = `<div class="card">Could not reach the server: <span class="muted">${esc(err.message)}</span></div>`;
  }
}

window.addEventListener("hashchange", route);
route();
