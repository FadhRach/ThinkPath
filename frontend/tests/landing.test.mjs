import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./helpers/load-ts.mjs";

const { idCopy } = await loadTs("features/landing/content.id.ts");
const { enCopy } = await loadTs("features/landing/content.en.ts");

// Bentuk pohon: nama kunci, dan panjang untuk daftar. Nilai string tidak dibandingkan.
function shape(value) {
  if (Array.isArray(value)) return { length: value.length, items: value.map(shape) };
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

function emptyStrings(value, path = "") {
  if (typeof value === "string") return value.trim() === "" ? [path] : [];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => emptyStrings(inner, `${path}.${key}`));
  }
  return [];
}

test("English and Indonesian landing copy have the same structure", () => {
  assert.deepEqual(shape(enCopy), shape(idCopy));
});

test("no landing copy string is empty", () => {
  assert.deepEqual(emptyStrings(idCopy), []);
  assert.deepEqual(emptyStrings(enCopy), []);
});

test("feature keys and section anchors match across languages", () => {
  assert.deepEqual(
    enCopy.features.items.map((i) => i.key),
    idCopy.features.items.map((i) => i.key),
  );
  assert.deepEqual(
    enCopy.nav.links.map((l) => l.href),
    idCopy.nav.links.map((l) => l.href),
  );
  assert.deepEqual(
    enCopy.pricing.plans.map((p) => p.state),
    idCopy.pricing.plans.map((p) => p.state),
  );
});
