// lib/sandpackBuilder.ts
// Builds Sandpack HTML for preview

export interface SandpackOptions {
  title: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
}

export function buildSandpackHtml(opts: SandpackOptions): string {
  const { title, files, dependencies } = opts;

  const config = {
    template: "react-ts",
    files: Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, { code: v }]),
    ),
    customSetup: dependencies ? { dependencies } : undefined,
    options: {
      externalResources: [] as string[],
      classes: {
        "sp-layout": "sp-layout",
      },
    },
  };

  const configJson = JSON.stringify(config).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<title>${title.replace(/</g, "")}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; color: #eee; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .header { position: fixed; top: 0; left: 0; right: 0; height: 48px; background: rgba(10,10,10,0.95); border-bottom: 1px solid #222; display:flex; align-items:center; justify-content:space-between; padding: 0 12px; z-index: 9999; }
  .title { font-weight: 700; font-size: 14px; color: #00ff88; }
  .meta { font-size: 11px; color: #888; }
  .btn { padding: 6px 10px; background: #151515; border: 1px solid #2a2a2a; border-radius: 8px; color: #fff; font-weight: 700; cursor: pointer; }
  .btn:active { transform: scale(0.98); }
  .content { position: absolute; top: 48px; left: 0; right: 0; bottom: 0; }
  #frame { width: 100%; height: 100%; border: 0; background: #000; }
  #overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap: 10px; background: #0a0a0a; }
  .spinner { width: 38px; height: 38px; border-radius: 999px; border: 3px solid #222; border-top-color: #00ff88; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .ot { font-size: 13px; color: #888; text-align:center; padding: 0 18px; line-height: 1.35; }
  #error { display:none; max-width: 520px; padding: 14px; border-radius: 12px; border: 1px solid #5b1b1b; background: #1a0505; color: #ffb3b3; }
  #error strong { color: #ff5555; }
  pre { white-space: pre-wrap; word-break: break-word; margin: 8px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #ffd2d2; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${title.replace(/</g, "")}</div>
      <div class="meta">In-App Preview (Sandpack) • Kein Browser</div>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="btn" id="btnReload">↻ Reload</button>
    </div>
  </div>

  <div class="content">
    <iframe id="frame" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe>
    <div id="overlay">
      <div class="spinner"></div>
      <div class="ot">Initialisiere Sandpack… (benötigt Internet für esm.sh / Bundler)</div>
      <div id="error">
        <strong>Fehler:</strong>
        <pre id="errorText"></pre>
      </div>
    </div>
  </div>

<script type="module">
  const overlay = document.getElementById("overlay");
  const errorBox = document.getElementById("error");
  const errorText = document.getElementById("errorText");
  const frame = document.getElementById("frame");
  const btnReload = document.getElementById("btnReload");

  const config = ${configJson};

  function showError(msg) {
    errorBox.style.display = "block";
    errorText.textContent = String(msg || "Unbekannter Fehler");
  }

  btnReload.addEventListener("click", () => {
    try { location.reload(); } catch {}
  });

  try {
    const mod = await import("https://esm.sh/@codesandbox/sandpack-client@2.19.0");
    const SandpackClient = mod.SandpackClient || mod.default || mod;

    const client = new SandpackClient(frame, config, {
      showLoadingScreen: true,
      showOpenInCodeSandbox: false,
    });

    const t = setTimeout(() => { overlay.style.display = "none"; }, 1200);
    client.listen((msg) => {
      if (msg?.type === "start") {
        overlay.style.display = "none";
        clearTimeout(t);
      }
      if (msg?.type === "error") {
        overlay.style.display = "flex";
        showError(msg?.error?.message || JSON.stringify(msg));
      }
    });
  } catch (e) {
    showError(e?.message || e);
  }
</script>
</body>
</html>`;
}
