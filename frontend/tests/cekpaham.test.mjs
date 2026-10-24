import assert from "node:assert/strict";
import test from "node:test";

import { loadTs } from "./helpers/load-ts.mjs";

const cp = await loadTs(
  "features/cekpaham/lib/recording.ts",
  "features/cekpaham/lib/labels.ts",
  "features/cekpaham/lib/queue.ts",
  "lib/text.ts",
);

test("recording format: webm/opus first, mp4 for Safari, undefined when nothing works", () => {
  assert.equal(
    cp.pickRecordingMime(() => true),
    "audio/webm;codecs=opus",
  );
  assert.equal(
    cp.pickRecordingMime((m) => m === "audio/mp4"),
    "audio/mp4",
  );
  assert.equal(
    cp.pickRecordingMime(() => false),
    undefined,
  );
});

test("rmsLevel separates dead input, room noise, and speech", () => {
  const dead = new Uint8Array(512).fill(128);
  const noise = Uint8Array.from({ length: 512 }, (_, i) => 128 + (i % 2 ? 1 : -1));
  const speech = Uint8Array.from({ length: 512 }, (_, i) => 128 + Math.round(40 * Math.sin(i / 5)));
  assert.equal(cp.rmsLevel(dead), 0);
  assert.equal(cp.rmsLevel([]), 0);
  assert.ok(cp.rmsLevel(dead) < cp.DEAD_INPUT_LEVEL);
  assert.ok(cp.rmsLevel(noise) > cp.DEAD_INPUT_LEVEL && cp.rmsLevel(noise) < cp.SPEECH_LEVEL);
  assert.ok(cp.rmsLevel(speech) > cp.SPEECH_LEVEL);
});

test("countWords ignores extra whitespace", () => {
  assert.equal(cp.countWords(""), 0);
  assert.equal(cp.countWords("   "), 0);
  assert.equal(cp.countWords("  satu   dua\ttiga \n"), 3);
});

test("secondsLeft counts down from the server deadline, not the client clock", () => {
  const server = "2026-10-22T10:00:00Z";
  const deadline = "2026-10-22T10:00:45Z";
  assert.equal(cp.secondsLeft(deadline, server, 0), 45);
  assert.equal(cp.secondsLeft(deadline, server, 10_500), 35);
  assert.equal(cp.secondsLeft(deadline, server, 45_000), 0);
  assert.equal(cp.secondsLeft(deadline, server, 90_000), 0);
});

test("appendCaption joins chunks with single spaces and skips empty ones", () => {
  assert.equal(cp.appendCaption("", "halo"), "halo");
  assert.equal(cp.appendCaption("halo", "  dunia  "), "halo dunia");
  assert.equal(cp.appendCaption("halo", "   "), "halo");
});

test("student-facing wording never frames Cek Paham as suspicion or scoring", () => {
  const forbidden = /\bAI\b|indikasi|curiga|mencurigakan|palsu|skor|dinilai|nilai/i;
  for (const message of Object.values(cp.STUDENT_STATE_MESSAGE)) {
    assert.doesNotMatch(message, forbidden, message);
  }
});

test("commitReady pastes captions in chunk order and skips failed chunks", () => {
  const done = new Map();
  done.set(1, "dunia");
  assert.deepEqual(cp.commitReady(done, 0, ""), { text: "", next: 0 });
  done.set(0, "halo");
  assert.deepEqual(cp.commitReady(done, 0, ""), { text: "halo dunia", next: 2 });
  assert.equal(done.size, 0);
  done.set(3, "lagi");
  done.set(2, null);
  assert.deepEqual(cp.commitReady(done, 2, "halo dunia"), { text: "halo dunia lagi", next: 4 });
});

test("queueStats counts waiting, scored, and open reports; cancelled is not awaited", () => {
  const row = (status, attempt) => ({ status, attempt });
  const stats = cp.queueStats([
    row("active", null),
    row("cancelled", null),
    row("active", { status: "scored", open_reports: 2 }),
    row("active", { status: "processing", open_reports: 0 }),
  ]);
  assert.deepEqual(stats, { waiting: 1, scored: 1, openReports: 2 });
});
