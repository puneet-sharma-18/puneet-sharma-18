import { systems } from "@/data/profile";

export const runtime = "nodejs";
export const revalidate = 60;

type State = "up" | "degraded" | "unreachable";

async function ping(url: string): Promise<{ state: State; ms: number; code: number }> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(6000), cache: "no-store" });
    const ms = Date.now() - t0;
    // Login walls (401/403) still prove the system is up.
    const state: State = res.status < 500 ? "up" : "degraded";
    return { state, ms, code: res.status };
  } catch {
    return { state: "unreachable", ms: Date.now() - t0, code: 0 };
  }
}

export async function GET() {
  const results = await Promise.all(systems.map(async (s) => ({ ...s, ...(await ping(s.url)) })));
  return Response.json({ checkedAt: new Date().toISOString(), results });
}
