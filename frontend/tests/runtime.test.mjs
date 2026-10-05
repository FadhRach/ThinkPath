import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../lib/api-shared.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("Tailwind config loads and produces the existing animation utilities", async () => {
  const loadConfig = require("tailwindcss/loadConfig");
  const config = loadConfig(fileURLToPath(new URL("../tailwind.config.ts", import.meta.url)));
  const result = await postcss([tailwindcss({
    ...config,
    content: [{ raw: '<div class="animate-in fade-in rounded-card"></div>' }],
  })]).process("@tailwind utilities;", { from: undefined });
  assert.match(result.css, /\.animate-in/);
  assert.match(result.css, /@keyframes enter/);
  assert.match(result.css, /\.rounded-card/);
});

test("registration displays the duplicate email message from DRF", () => {
  assert.equal(api.getApiErrorMessage(
    new api.ApiError(400, { email: ["Email sudah terdaftar."] }), "Gagal memproses.",
  ), "Email sudah terdaftar.");
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
    status: 500, headers: { "content-type": "text/html" },
  });
  await assert.rejects(api.resolveJson(response), (error) => {
    assert.equal(api.getApiErrorMessage(error, "Periksa isian."), api.SERVER_ERROR_MESSAGE);
    return true;
  });
});

test("network failures keep the connection message", () => {
  assert.equal(api.getApiErrorMessage(new api.NetworkError(new TypeError("fetch failed")), "Gagal."),
    api.NETWORK_ERROR_MESSAGE);
});
