import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const require = createRequire(import.meta.url);
process.env.NEXT_PUBLIC_BACKEND_URL ??= "http://backend.test";
const api = await loadTs("lib/api/errors.ts", "lib/api/messages.ts", "lib/api/request.ts");

test("Tailwind config loads and produces animation utilities and the design tokens", async () => {
  const loadConfig = require("tailwindcss/loadConfig");
  const config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url)));
  const result = await postcss([
    tailwindcss({
      ...config,
      content: [
        {
          raw: '<div class="animate-in fade-in font-display text-micro text-title text-brand-ink"></div>',
        },
      ],
    }),
  ]).process("@tailwind utilities;", { from: undefined });
  assert.match(result.css, /\.animate-in/);
  assert.match(result.css, /@keyframes enter/);
  // Token desain milik ThinkPath: kalau salah satu hilang dari config, halaman diam-diam kehilangan gayanya.
  for (const utility of ["font-display", "text-micro", "text-title", "text-brand-ink"]) {
    assert.match(result.css, new RegExp(`\\.${utility}`), utility);
  }
});

test("registration displays the duplicate email message from DRF", () => {
  assert.equal(
    api.getApiErrorMessage(
      new api.ApiError(400, { email: ["Email sudah terdaftar."] }),
      "Gagal memproses.",
    ),
    "Email sudah terdaftar.",
  );
});

test("login preserves wrong-password and wrong-role messages", () => {
  for (const [status, detail] of [
    [401, "Email atau kata sandi salah."],
    [403, "Akun ini terdaftar sebagai dosen. Pilih peran Dosen untuk masuk."],
  ]) {
    assert.equal(api.getApiErrorMessage(new api.ApiError(status, { detail }), "Gagal."), detail);
  }
});

test("HTML server errors show a service error instead of an input error", async () => {
  const response = new Response("<html>Server Error</html>", {
    status: 500,
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(api.resolveJson(response), (error) => {
    assert.equal(api.getApiErrorMessage(error, "Periksa isian."), api.SERVER_ERROR_MESSAGE);
    return true;
  });
});

test("network failures keep the connection message", () => {
  assert.equal(
    api.getApiErrorMessage(new api.NetworkError(new TypeError("fetch failed")), "Gagal."),
    api.NETWORK_ERROR_MESSAGE,
  );
});

test("a bare DRF ValidationError (list body) shows its message", () => {
  assert.equal(
    api.getApiErrorMessage(new api.ApiError(400, ["Ukuran berkas maksimal 10 MB."]), "Gagal."),
    "Ukuran berkas maksimal 10 MB.",
  );
});

test("FormData uploads keep the browser's multipart Content-Type", async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent.push(new Headers(init.headers));
    return new Response("{}");
  };
  try {
    await api.fetchApi("/upload", { method: "POST", body: new FormData() }, null);
    await api.fetchApi("/json", { method: "POST", body: "{}" }, null);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(sent[0].get("Content-Type"), null);
  assert.equal(sent[1].get("Content-Type"), "application/json");
});
