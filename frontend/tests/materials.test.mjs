import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/materials.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const materials = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("safeHref only lets http(s) links through", () => {
  assert.equal(materials.safeHref("https://docs.google.com/document/d/1"), "https://docs.google.com/document/d/1");
  assert.equal(materials.safeHref("HTTP://contoh.id"), "HTTP://contoh.id");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "//contoh.id", "", "ftp://contoh.id"]) {
    assert.equal(materials.safeHref(bad), null, bad);
  }
});
