import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?)$/.test(name) ? [path] : [];
  });
}

const sectionIds = new Set(
  [
    ...read("features/privacy/components/PolicyArticle.tsx").matchAll(/\{ id: "([^"]+)", title:/g),
  ].map((m) => m[1]),
);

test("every consent item points at a section that exists in the policy page", () => {
  const anchors = [...read("lib/privacy.ts").matchAll(/anchor: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(anchors.length > 0);
  for (const anchor of anchors) assert.ok(sectionIds.has(anchor), `bagian tidak ada: ${anchor}`);
});

test("every link into the policy page uses an anchor that exists", () => {
  const root = new URL("../", import.meta.url).pathname;
  const linked = new Set();
  for (const dir of ["app", "components", "features", "lib"]) {
    for (const file of sourceFiles(join(root, dir))) {
      for (const m of readFileSync(file, "utf8").matchAll(/kebijakan-privasi#([a-z-]+)/g))
        linked.add(m[1]);
    }
  }
  assert.ok(linked.size > 0);
  for (const anchor of linked) assert.ok(sectionIds.has(anchor), `jangkar tidak ada: ${anchor}`);
});
