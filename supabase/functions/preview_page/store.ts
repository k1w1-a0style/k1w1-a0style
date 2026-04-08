import {
  TABLE,
  classifyPreviewRecordLookupFailure,
  classifyPreviewRecordShape,
  deleteByPreviewSecretCandidates,
  findFirstByPreviewSecretCandidates,
  getSupabaseBaseUrl,
  sanitizeErrorText,
  supabaseHeaders,
} from "./helpers.ts";
import type { PreviewRecord, PreviewRecordLookupResult } from "./helpers.ts";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";

export async function fetchPreviewRecord(secret: string): Promise<PreviewRecordLookupResult> {
  const base = getSupabaseBaseUrl();
  if (!base) {
    return { ok: false, code: classifyPreviewRecordLookupFailure({ missingBaseUrl: true }) };
  }

  const select = "name,secret,created_at,expires_at,project_id,files,dependencies,meta";

  let headers: Record<string, string>;
  try {
    headers = supabaseHeaders();
  } catch {
    return { ok: false, code: classifyPreviewRecordLookupFailure({ missingServiceRoleKey: true }) };
  }

  try {
    const fetchBySecret = async (lookupSecret: string) => {
      const restUrl =
        `${base}/rest/v1/${TABLE}?secret=eq.${encodeURIComponent(lookupSecret)}` +
        `&select=${encodeURIComponent(select)}&limit=1`;
      return fetchWithTimeout(restUrl, {
        timeoutMs: 8000,
        timeoutMessage: "preview_page lookup timed out after 8000ms",
        method: "GET",
        headers,
      });
    };

    const parseRecords = async (res: Response): Promise<PreviewRecord[] | null> => {
      if (!res.ok) {
        throw new Error(`http:${res.status}`);
      }
      const ctype = res.headers.get("content-type") ?? "";
      if (!ctype.toLowerCase().includes("application/json")) {
        throw new Error(`content-type:${ctype}`);
      }
      const parsed = await res.json();
      if (!Array.isArray(parsed)) return null;
      return parsed as PreviewRecord[];
    };

    const arr = await findFirstByPreviewSecretCandidates<PreviewRecord[]>(secret, async (candidate) => {
      const records = await parseRecords(await fetchBySecret(candidate));
      if (!Array.isArray(records) || records.length === 0) return null;
      return records;
    });

    if (!Array.isArray(arr) || arr.length === 0) return { ok: true, record: null };
    const record = arr[0] as PreviewRecord;
    const shapeError = classifyPreviewRecordShape(record);
    if (shapeError) {
      return { ok: false, code: shapeError };
    }
    return { ok: true, record };
  } catch (e) {
    const msg = sanitizeErrorText(e instanceof Error ? e.message : String(e));
    if (msg.startsWith("http:")) {
      return { ok: false, code: classifyPreviewRecordLookupFailure({ status: Number(msg.slice(5)) }) };
    }
    if (msg.startsWith("content-type:")) {
      return {
        ok: false,
        code: classifyPreviewRecordLookupFailure({ contentType: msg.slice("content-type:".length) }),
      };
    }
    console.error("fetchPreviewRecord error:", msg);
    return { ok: false, code: classifyPreviewRecordLookupFailure({ parseFailed: true, error: e }) };
  }
}

export async function deletePreviewRecord(secret: string): Promise<void> {
  const base = getSupabaseBaseUrl();
  if (!base) return;
  await deleteByPreviewSecretCandidates(secret, async (candidate) => {
    const restUrl = `${base}/rest/v1/${TABLE}?secret=eq.${encodeURIComponent(candidate)}`;
    try {
      await fetchWithTimeout(restUrl, {
        timeoutMs: 6000,
        timeoutMessage: "preview_page delete timed out after 6000ms",
        method: "DELETE",
        headers: supabaseHeaders(),
      });
    } catch (e) {
      console.error("deletePreviewRecord error:", sanitizeErrorText(e instanceof Error ? e.message : String(e)));
    }
  });
}

export function isExpired(expiresAtIso: string | null | undefined): boolean {
  if (!expiresAtIso) return false;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}
