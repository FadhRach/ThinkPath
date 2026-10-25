import { enCopy } from "./content.en";
import { idCopy } from "./content.id";
import type { Copy, Lang, Theme } from "./types";

// Alamat kontak sungguhan belum ada. Selama kosong, tombol daftar tunggu dan
// "Hubungi tim" tampil nonaktif berlabel "Segera hadir", bukan alamat karangan.
const CONTACT_EMAIL = "";

export interface LandingQuery {
  lang?: string | string[];
  tema?: string | string[];
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Bahasa dan tema hidup di URL, bukan cookie atau localStorage: kebijakan privasi
// menyatakan ThinkPath hanya memakai satu cookie dan tidak menyimpan apa pun di
// penyimpanan peramban. Tanpa parameter, bahasa Indonesia dan tema mengikuti sistem.
export function parseLang(query: LandingQuery): Lang {
  return first(query.lang) === "en" ? "en" : "id";
}

export function parseTheme(query: LandingQuery): Theme | null {
  const value = first(query.tema);
  return value === "gelap" ? "dark" : value === "terang" ? "light" : null;
}

export const getCopy = (lang: Lang): Copy => (lang === "en" ? enCopy : idCopy);

export function landingHref(lang: Lang, theme: Theme | null, hash = ""): string {
  const params = new URLSearchParams();
  if (lang === "en") params.set("lang", "en");
  if (theme) params.set("tema", theme === "dark" ? "gelap" : "terang");
  const query = params.toString();
  return `/${query ? `?${query}` : ""}${hash}`;
}

export function mailtoHref(subject: string): string | null {
  return CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}` : null;
}
