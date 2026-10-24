import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const materials = await loadTs("features/materials/lib/materials.ts");

test("safeHref only lets http(s) links through", () => {
  assert.equal(
    materials.safeHref("https://docs.google.com/document/d/1"),
    "https://docs.google.com/document/d/1",
  );
  assert.equal(materials.safeHref("HTTP://contoh.id"), "HTTP://contoh.id");
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html,x",
    "//contoh.id",
    "",
    "ftp://contoh.id",
  ]) {
    assert.equal(materials.safeHref(bad), null, bad);
  }
});
