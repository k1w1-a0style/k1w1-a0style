import { errorResponse } from "../cors.ts";
import { getRuntimeEnv, getServiceRoleSecret, getSupabaseUrlSecret } from "./runtime.ts";

function normalizeClientIpCandidate(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutPort = (() => {
    if (trimmed.startsWith("[")) {
      const end = trimmed.indexOf("]");
      if (end > 1) return trimmed.slice(1, end);
    }
    const ipv4WithPort = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})$/);
    if (ipv4WithPort) return ipv4WithPort[1];
    return trimmed;
  })();

  const lower = withoutPort.toLowerCase();
  if (lower === "unknown") return null;

  const ipv4 = /^(\d{1,3})(?:\.(\d{1,3})){3}$/.test(withoutPort)
    ? withoutPort.split(".").every((part) => Number(part) >= 0 && Number(part) <= 255)
    : false;
  if (ipv4) return withoutPort;

  const ipv6 = /^[0-9a-f:]+$/i.test(withoutPort) && withoutPort.includes(":") && !withoutPort.includes(":::");
  if (ipv6) return withoutPort;
  return null;
}

function getTrustedProxyHops(): number | null {
  const trustedProxyHopsRaw = (getRuntimeEnv("K1W1_TRUSTED_PROXY_HOPS") ?? "").trim();
  if (!/^\d+$/.test(trustedProxyHopsRaw)) return null;
  const trustedProxyHops = Number(trustedProxyHopsRaw);
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops <= 0) return null;
  return trustedProxyHops;
}

function getClientIpFromForwardedFor(forwardedFor: string, trustedProxyHops: number): string | null {
  const entries = forwardedFor.split(",").map((entry) => entry.trim()).filter(Boolean);
  const clientIndex = entries.length - (trustedProxyHops + 1);
  if (clientIndex < 0) return null;
  const candidate = entries[clientIndex];
  return normalizeClientIpCandidate(candidate);
}

export function getRequestClientIp(req: Request): string {
  const cf = normalizeClientIpCandidate(req.headers.get("cf-connecting-ip"));
  if (cf) return cf;

  const trustedProxyHops = getTrustedProxyHops();
  if (trustedProxyHops) {
    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const forwardedClientIp = getClientIpFromForwardedFor(forwarded, trustedProxyHops);
    if (forwardedClientIp) return forwardedClientIp;
  }

  return "unknown";
}

export function getRequestRateLimitSubject(req: Request): string {
  return `ip:${getRequestClientIp(req)}`;
}

const rl = new Map<string, { t: number; c: number; windowMs: number }>();
let rlLastPruneAt = 0;

export function __resetLocalRateLimitForTests(): void {
  rl.clear();
  rlLastPruneAt = 0;
}

export function rateLimit(req: Request, key: string, max = 10, windowMs = 10_000): Response | null {
  const ip = getRequestClientIp(req);
  const k = `${key}:${ip}`;
  const now = Date.now();
  if (now - rlLastPruneAt > Math.max(windowMs, 10_000) || rl.size > 5_000) {
    rlLastPruneAt = now;
    for (const [entryKey, entryValue] of rl) {
      if (now - entryValue.t > entryValue.windowMs * 2) rl.delete(entryKey);
    }
    if (rl.size > 10_000) {
      let removed = 0;
      for (const [entryKey] of rl) {
        rl.delete(entryKey);
        removed += 1;
        if (rl.size <= 8_000 || removed > 2_000) break;
      }
    }
  }

  const v = rl.get(k);
  if (!v || now - v.t > windowMs) {
    rl.set(k, { t: now, c: 1, windowMs });
    return null;
  }

  v.windowMs = windowMs;
  v.c += 1;
  if (v.c > max) return errorResponse("rate_limited", req, 429, { windowMs, max, mode: "local_best_effort" });
  return null;
}

export type DurableRateLimitConfig = {
  scope: string;
  subject: string;
  max: number;
  windowMs: number;
  enforceDurable?: boolean;
};

const DEFAULT_EDGE_FETCH_TIMEOUT_MS = 8_000;

type DurableRateLimitRpcRow = {
  allowed: boolean;
  current_count: number;
  decision: "allowed" | "rejected";
};

function parseDurableRateLimitRpcRow(rpcJson: unknown): DurableRateLimitRpcRow | null {
  const candidate = Array.isArray(rpcJson) ? (rpcJson.length === 1 ? rpcJson[0] : null) : rpcJson;
  if (!candidate || typeof candidate !== "object") return null;

  const allowed = (candidate as { allowed?: unknown }).allowed;
  const currentCount = (candidate as { current_count?: unknown }).current_count;
  const decisionRaw = (candidate as { decision?: unknown }).decision;
  if (typeof allowed !== "boolean") return null;
  if (typeof currentCount !== "number" || !Number.isFinite(currentCount) || currentCount < 0) return null;
  const decision =
    decisionRaw === "allowed" || decisionRaw === "rejected"
      ? decisionRaw
      : allowed
        ? "allowed"
        : "rejected";

  return { allowed, current_count: currentCount, decision };
}

async function fetchWithEdgeTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = DEFAULT_EDGE_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requireDurableRateLimit(req: Request, cfg: DurableRateLimitConfig): Promise<Response | null> {
  const localFallbackRisk = { fallback_mode: "local_in_memory_best_effort", cluster_safe: false } as const;
  const supabaseUrl = getSupabaseUrlSecret();
  const serviceKey = getServiceRoleSecret();
  const enforceDurable = cfg.enforceDurable === true || (getRuntimeEnv("K1W1_STRICT_DURABLE_RATE_LIMIT_SCOPES") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(cfg.scope);

  const strictFailure = (reason: string, details?: Record<string, unknown>): Response | null => {
    if (!enforceDurable) return null;
    return errorResponse("rate_limit_unavailable", req, 503, { scope: cfg.scope, durable_required: true, reason, ...(details ?? {}) });
  };

  if (!supabaseUrl || !serviceKey) {
    console.warn("[durable-rate-limit] falling back to local limiter because durable store secrets are missing", {
      scope: cfg.scope,
      missing: ["K1W1_SUPABASE_URL|SUPABASE_URL", "K1W1_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY"],
      ...localFallbackRisk,
    });
    return strictFailure("missing_durable_store_secrets", {
      missing: ["K1W1_SUPABASE_URL|SUPABASE_URL", "K1W1_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY"],
    });
  }

  const rpcUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/enforce_edge_rate_limit`;

  try {
    const rpcRes = await fetchWithEdgeTimeout(rpcUrl, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_scope: cfg.scope,
        p_subject: cfg.subject,
        p_max: cfg.max,
        p_window_ms: cfg.windowMs,
      }),
    });

    if (!rpcRes.ok) {
      console.warn("[durable-rate-limit] falling back to local limiter because durable store rpc failed", {
        scope: cfg.scope,
        status: rpcRes.status,
        ...localFallbackRisk,
      });
      return strictFailure("durable_store_rpc_failed", { status: rpcRes.status });
    }

    const rpcJson = await rpcRes.json().catch((): unknown => null);
    const parsed = parseDurableRateLimitRpcRow(rpcJson);
    if (!parsed) {
      console.warn("[durable-rate-limit] falling back to local limiter because durable store rpc response was invalid", {
        scope: cfg.scope,
        ...localFallbackRisk,
      });
      return strictFailure("durable_store_rpc_invalid_response");
    }

    if (!parsed.allowed) {
      return errorResponse("rate_limited", req, 429, {
        scope: cfg.scope,
        max: cfg.max,
        windowMs: cfg.windowMs,
        currentCount: parsed.current_count,
        decision: parsed.decision,
        mode: "durable",
      });
    }

    return null;
  } catch (error) {
    console.warn("[durable-rate-limit] falling back to local limiter because durable store is unavailable", {
      scope: cfg.scope,
      error: error instanceof Error ? error.message : String(error),
      ...localFallbackRisk,
    });
    return strictFailure("durable_store_unavailable", { error: error instanceof Error ? error.message : String(error) });
  }
}
