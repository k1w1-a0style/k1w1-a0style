// supabase/functions/android-keystore-status/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const repo = String(body?.repo || "").trim();

    if (!repo || !repo.includes("/")) {
      return json({ error: "Invalid repo format. Expected 'owner/name'." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from("signing_android")
      .select("repo, alias, storage_bucket, storage_path, created_at, updated_at, mode")
      .eq("repo", repo)
      .maybeSingle();

    if (error) return json({ error: error.message }, { status: 500 });

    if (!data) {
      return json({ exists: false, repo });
    }

    return json({
      exists: true,
      repo,
      alias: data.alias,
      bucket: data.storage_bucket,
      path: data.storage_path,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      mode: data.mode,
    });
  } catch (e) {
    return json({ error: e?.message || String(e) }, { status: 500 });
  }
});
