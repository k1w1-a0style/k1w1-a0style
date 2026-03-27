#!/usr/bin/env node
import fs from "fs";

const HELPERS_PATH = "supabase/functions/k1w1-handler/helpers.ts";

function extractDefaults(source) {
  const providers = ["groq", "gemini", "openai", "anthropic", "huggingface"];
  const defaults = {};

  for (const provider of providers) {
    const block = source.match(new RegExp(`${provider}:\\s*\\{([\\s\\S]*?)\\}`, "m"));
    if (!block) continue;
    const speed = block[1].match(/speed:\s*"([^"]+)"/);
    const quality = block[1].match(/quality:\s*"([^"]+)"/);
    defaults[provider] = {
      speed: speed?.[1] || null,
      quality: quality?.[1] || null,
    };
  }

  return defaults;
}

function normalizeErrorText(text) {
  if (!text) return "";
  return String(text).replace(/\s+/g, " ").trim().slice(0, 300);
}

async function checkProvider(provider, model) {
  const promptMessages = [{ role: "user", content: "ping" }];
  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (!key) return { status: "missing_secret", secret: "GROQ_API_KEY", model };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: promptMessages, max_tokens: 8, temperature: 0 }),
    });
    const text = await res.text();
    return res.ok
      ? { status: "ok", model, httpStatus: res.status, note: "response received" }
      : { status: "provider_error", model, httpStatus: res.status, error: normalizeErrorText(text) };
  }

  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return { status: "missing_secret", secret: "GEMINI_API_KEY", model };
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }] }),
    });
    const text = await res.text();
    return res.ok
      ? { status: "ok", model, httpStatus: res.status, note: "response received" }
      : { status: "provider_error", model, httpStatus: res.status, error: normalizeErrorText(text) };
  }

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return { status: "missing_secret", secret: "OPENAI_API_KEY", model };
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: promptMessages, max_tokens: 8, temperature: 0 }),
    });
    const text = await res.text();
    return res.ok
      ? { status: "ok", model, httpStatus: res.status, note: "response received" }
      : { status: "provider_error", model, httpStatus: res.status, error: normalizeErrorText(text) };
  }

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { status: "missing_secret", secret: "ANTHROPIC_API_KEY", model };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 8, temperature: 0 }),
    });
    const text = await res.text();
    return res.ok
      ? { status: "ok", model, httpStatus: res.status, note: "response received" }
      : { status: "provider_error", model, httpStatus: res.status, error: normalizeErrorText(text) };
  }

  if (provider === "huggingface") {
    const key = process.env.HUGGINGFACE_API_KEY;
    if (!key) return { status: "missing_secret", secret: "HUGGINGFACE_API_KEY", model };
    const res = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ inputs: "ping", parameters: { max_new_tokens: 8, return_full_text: false } }),
    });
    const text = await res.text();
    return res.ok
      ? { status: "ok", model, httpStatus: res.status, note: "response received" }
      : { status: "provider_error", model, httpStatus: res.status, error: normalizeErrorText(text) };
  }

  return { status: "unsupported", model };
}

async function main() {
  const src = fs.readFileSync(HELPERS_PATH, "utf8");
  const defaults = extractDefaults(src);
  const providers = ["groq", "gemini", "openai", "anthropic", "huggingface"];

  const results = [];
  for (const provider of providers) {
    const model = defaults?.[provider]?.speed;
    const outcome = await checkProvider(provider, model);
    results.push({ provider, ...outcome });
  }

  process.stdout.write(`${JSON.stringify({
    checkedAt: new Date().toISOString(),
    sourceDefaultsFile: HELPERS_PATH,
    results,
  }, null, 2)}\n`);
}

main().catch((err) => {
  console.error("live_provider_smoke_failed", err?.message || err);
  process.exitCode = 1;
});
