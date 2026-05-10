import type { VercelRequest } from "@vercel/node";

/** Vercel 上 req.body 可能为 undefined / 空字符串，直接取字段会抛错导致 500 */
export function parseJsonBody(req: VercelRequest): Record<string, unknown> {
  try {
    const raw = req.body as unknown;
    if (raw == null || raw === "") return {};
    if (typeof raw === "string") {
      const t = raw.trim();
      if (!t) return {};
      return JSON.parse(t) as Record<string, unknown>;
    }
    if (typeof raw === "object") return raw as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}
