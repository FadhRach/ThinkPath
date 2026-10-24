export type Lang = "id" | "en";
export type Theme = "light" | "dark";

export type FeatureKey = "process" | "bloom" | "cekpaham" | "ai" | "summary" | "import";
export type PlanState = "now" | "soon" | "contact";

export interface Copy {
  meta: { title: string; description: string };
  nav: {
    links: { href: string; label: string }[];
    login: string;
    register: string;
    toLight: string;
    toDark: string;
    languageLabel: string;
  };
  hero: {
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    tagline: string;
  };
  sheet: {
    document: string;
    excerpt: string;
    chartLabel: string;
    started: string;
    duration: string;
    revisions: string;
    level: string;
    note: string;
  };
  problem: {
    title: string;
    lead: string;
    beforeHeading: string;
    afterHeading: string;
    rows: { aspect: string; before: string; after: string }[];
    punchline: string;
  };
  features: {
    title: string;
    lead: string;
    items: { key: FeatureKey; title: string; body: string }[];
  };
  how: {
    title: string;
    lead: string;
    steps: { role: string; title: string; body: string }[];
  };
  proof: {
    title: string;
    lead: string;
    stackNote: string;
    stack: { name: string; role: string }[];
    principles: { title: string; body: string }[];
  };
  pricing: {
    title: string;
    lead: string;
    note: string;
    unavailable: string;
    waitlistSubject: string;
    plans: {
      state: PlanState;
      name: string;
      audience: string;
      badge: string;
      price: string;
      blurb: string;
      detector: string;
      features: string[];
      cta: string;
    }[];
  };
  footer: {
    tagline: string;
    productHeading: string;
    infoHeading: string;
    contactHeading: string;
    privacy: string;
    login: string;
    register: string;
    contact: string;
    rights: string;
  };
}
