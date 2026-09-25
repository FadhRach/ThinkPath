import type { Material } from "@/lib/types";

/**
 * Susunan materi: kelas → topik → materi, seperti "Tugas Kelas" di Google
 * Classroom dan daftar sesi di LMS kampus. Mahasiswa mencari materi dengan
 * mengingat pertemuannya ("slide pertemuan 6"), bukan tanggal dibagikannya.
 */

export const GENERAL_TOPIC_LABEL = "Umum";

/** Materi dianggap baru selama sepekan setelah dibagikan. */
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

export type MaterialSource =
  | "slides"
  | "docs"
  | "sheets"
  | "forms"
  | "drive"
  | "video"
  | "pdf"
  | "web"
  | "note";

export interface SourceInfo {
  kind: MaterialSource;
  /** Nama tempat materinya berada, supaya mahasiswa tahu apa yang akan terbuka. */
  label: string;
}

export function describeSource(url: string): SourceInfo {
  if (!url) return { kind: "note", label: "Catatan dosen" };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: "web", label: url };
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const path = parsed.pathname.toLowerCase();

  if (host === "docs.google.com") {
    if (path.startsWith("/presentation")) return { kind: "slides", label: "Google Slides" };
    if (path.startsWith("/spreadsheets")) return { kind: "sheets", label: "Google Sheets" };
    if (path.startsWith("/forms")) return { kind: "forms", label: "Google Forms" };
    return { kind: "docs", label: "Google Docs" };
  }
  if (host === "drive.google.com") return { kind: "drive", label: "Google Drive" };
  if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com")) {
    return { kind: "video", label: "YouTube" };
  }
  if (path.endsWith(".pdf")) return { kind: "pdf", label: `PDF · ${host}` };
  if (/\.pptx?$/.test(path)) return { kind: "slides", label: `Slide · ${host}` };
  if (host.endsWith("wikipedia.org")) return { kind: "web", label: "Wikipedia" };
  return { kind: "web", label: host };
}

export function isRecent(material: Material, now: number): boolean {
  return now - new Date(material.created_at).getTime() <= RECENT_MS;
}

export interface TopicGroup {
  /** Kosong untuk materi umum. */
  topic: string;
  label: string;
  /** id elemen, dipakai indeks topik untuk melompat. */
  anchor: string;
  materials: Material[];
}

// numeric: "Pertemuan 2" sebelum "Pertemuan 10", bukan urutan huruf.
const collator = new Intl.Collator("id", { numeric: true, sensitivity: "base" });

function slugOf(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "topik"
  );
}

/**
 * Kelompokkan materi per topik. Materi umum di paling atas, lalu topik
 * berurutan seperti silabus. Di dalam topik, materi terbaru di atas.
 */
export function groupByTopic(materials: Material[]): TopicGroup[] {
  const groups = new Map<string, TopicGroup>();
  for (const material of materials) {
    const topic = material.topic.trim();
    const key = topic.toLocaleLowerCase("id");
    const group = groups.get(key) ?? {
      topic,
      label: topic || GENERAL_TOPIC_LABEL,
      anchor: "",
      materials: [],
    };
    group.materials.push(material);
    groups.set(key, group);
  }

  const sorted = Array.from(groups.values()).sort((a, b) => {
    if (!a.topic) return -1;
    if (!b.topic) return 1;
    return collator.compare(a.topic, b.topic);
  });
  const used = new Set<string>();
  for (const group of sorted) {
    const base = `topik-${group.topic ? slugOf(group.topic) : "umum"}`;
    let anchor = base;
    for (let n = 2; used.has(anchor); n += 1) anchor = `${base}-${n}`;
    used.add(anchor);
    group.anchor = anchor;
    group.materials.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return sorted;
}

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("id");
}

/** Semua kata kunci harus muncul di salah satu isian, urutannya bebas. */
export function matchesQuery(material: Material, query: string): boolean {
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalise(
    [
      material.title,
      material.topic,
      material.description,
      material.class_name,
      describeSource(material.url).label,
    ].join(" "),
  );
  return words.every((word) => haystack.includes(word));
}

// Warna folder per kelas, dipilih dari id supaya kelas yang sama selalu
// berwarna sama di daftar kelas dan di halaman kelasnya.
const CLASS_ACCENTS = [
  "bg-secondary text-primary",
  "bg-warning-soft text-warning",
  "bg-success-soft text-success",
  "bg-brand-pink text-danger",
  "bg-accent text-accent-foreground",
];

export function classAccent(classId: string): string {
  let hash = 0;
  for (const char of classId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CLASS_ACCENTS[hash % CLASS_ACCENTS.length];
}
