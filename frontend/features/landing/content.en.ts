import type { Copy } from "./types";

export const enCopy: Copy = {
  meta: {
    title: "ThinkPath: see how the work was done",
    description:
      "A process-based understanding check for academic integrity. Writing trail, Bloom level and Cek Paham in one evidence summary for lecturers.",
  },
  nav: {
    links: [
      { href: "#masalah", label: "Problem" },
      { href: "#fitur", label: "Features" },
      { href: "#cara-kerja", label: "How it works" },
      { href: "#teknologi", label: "Technology" },
      { href: "#paket", label: "Plans" },
    ],
    login: "Log in",
    register: "Sign up",
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",
    languageLabel: "Language",
  },
  hero: {
    title: "The grade can be the same. How it was earned may not be.",
    lead: "ThinkPath records how students write, maps their level of thinking, and turns both into evidence a lecturer can review. The decision stays with the lecturer.",
    primary: "Get started",
    secondary: "See how it works",
    tagline:
      "ThinkPath: A Process-Based Understanding Verification System for Student Academic Integrity",
  },
  sheet: {
    document: "Nature and Environment Essay, draft 3",
    excerpt:
      "AI data centers draw millions of liters of fresh water for cooling and add to carbon emissions, so their growth should be limited by water permits and renewable energy targets.",
    chartLabel: "Word count over time",
    started: "Started 7:42 pm",
    duration: "47 minutes",
    revisions: "6 revisions",
    level: "L4 Analyzing",
    note: "Ask: what is your basis for saying the impact reaches the global climate?",
  },
  problem: {
    title: "An AI detector alone is not enough",
    lead: "Language models keep changing, while a detector only sees the final text. Lecturers end up holding a number that is hard to defend.",
    beforeHeading: "AI detector only",
    afterHeading: "With ThinkPath",
    rows: [
      {
        aspect: "What is checked",
        before: "Only the final text, without knowing how it was made",
        after:
          "The process: when it started, how long it took, how often it was revised, plus Bloom levels L1 to L6",
      },
      {
        aspect: "Facing new AI",
        before: "Has to keep chasing ever smarter AI models",
        after:
          "Does not rest on one guess: process, thinking level and Cek Paham support each other",
      },
      {
        aspect: "Honest students",
        before: "Can get flagged with no explanation",
        after: "The AI indication is one clue, shown apart from the writing pattern",
      },
      {
        aspect: "Result for the lecturer",
        before: "One number that feels like a verdict",
        after: "An Evidence Summary and a spoken Cek Paham, with the decision left to the lecturer",
      },
    ],
    punchline: "A detector gives a guess. ThinkPath gives evidence you can review.",
  },
  features: {
    title: "One assignment, evidence from many angles",
    lead: "Each feature answers one question a lecturer has: does this student really understand what they wrote?",
    items: [
      {
        key: "process",
        title: "Writing trail",
        body: "Drafts are saved on the server automatically. Lecturers see when writing started, how long it took, and how the word count grew.",
      },
      {
        key: "bloom",
        title: "Bloom thinking level",
        body: "Answers are mapped to L1 through L6, from remembering to creating, and compared with the level the assignment targets.",
      },
      {
        key: "cekpaham",
        title: "Cek Paham",
        body: "A short spoken check: students explain their answer out loud. The score is only a suggestion and is not yet calibrated.",
      },
      {
        key: "ai",
        title: "AI indication, kept apart",
        body: "Calculated from the text alone and never mixed with the writing pattern. Students do not see this score.",
      },
      {
        key: "summary",
        title: "Evidence Summary",
        body: "One page per answer showing what deserves attention first, not a pass or fail verdict.",
      },
      {
        key: "import",
        title: "Document import",
        body: "Students can upload a PDF, DOCX or photo. The text is read automatically and the answer is marked as imported.",
      },
    ],
  },
  how: {
    title: "How it works",
    lead: "Four steps from class to evidence, with no complicated setup.",
    steps: [
      {
        role: "Lecturer",
        title: "Create a class and assignment",
        body: "Set the deadline and target Bloom level, then share the class code.",
      },
      {
        role: "Student",
        title: "Write the answer",
        body: "Drafts save automatically. There is nothing extra to do.",
      },
      {
        role: "ThinkPath",
        title: "Analysis runs",
        body: "Process, Bloom level and AI indication are calculated in the background.",
      },
      {
        role: "Lecturer",
        title: "Review the evidence",
        body: "Read the Evidence Summary, then talk to the student or run Cek Paham if needed.",
      },
    ],
  },
  proof: {
    title: "The technology behind ThinkPath",
    lead: "Built from components you can check. Analysis uses Winston AI and Groq, and data is stored on a server in Jakarta.",
    stackNote: "The technology ThinkPath uses, not a claim of partnership or official endorsement.",
    stack: [
      { name: "Next.js", role: "Interface" },
      { name: "Django", role: "API" },
      { name: "PostgreSQL", role: "Database" },
      { name: "Groq", role: "AI analysis" },
      { name: "Winston AI", role: "AI detector" },
      { name: "IDCloudHost", role: "Jakarta server" },
      { name: "Vercel", role: "Web hosting" },
      { name: "Docker", role: "Containers" },
    ],
    principles: [
      {
        title: "Data in Jakarta",
        body: "The database and answer files are stored on an IDCloudHost server in Jakarta.",
      },
      {
        title: "Scores hidden from students",
        body: "The AI indication score is shown to lecturers only.",
      },
      {
        title: "Delete any time",
        body: "Users can delete their own account and data from Settings.",
      },
    ],
  },
  pricing: {
    title: "Plans",
    lead: "ThinkPath is free to use today, including several classes. Paid plans add a stronger AI detector and features for organizations.",
    note: "What the paid plans include is still planned and may change.",
    unavailable: "Coming soon",
    waitlistSubject: "ThinkPath waitlist",
    plans: [
      {
        state: "now",
        name: "Individual",
        audience: "Lecturers and students",
        badge: "Available now",
        price: "Free",
        blurb: "All core features for a lecturer and their classes.",
        detector: "Standard detector",
        features: [
          "Several classes and assignments",
          "Writing trail and Bloom level",
          "Cek Paham",
          "Evidence Summary",
        ],
        cta: "Get started",
      },
      {
        state: "soon",
        name: "Class Plus",
        audience: "Lecturers who need a stronger detector",
        badge: "Coming soon",
        price: "Coming soon",
        blurb: "A premium detector option for chosen classes.",
        detector: "Premium detector (planned)",
        features: [
          "Premium detector integration such as Turnitin or Copyleaks (planned)",
          "Chosen per class",
          "Everything in Individual",
        ],
        cta: "Join the waitlist",
      },
      {
        state: "contact",
        name: "Institution and tutoring",
        audience: "Universities and tutoring centers",
        badge: "For organizations",
        price: "Contact us",
        blurb: "For many classes and many instructors.",
        detector: "Tailored to the organization",
        features: [
          "One organization account for many instructors",
          "Single sign-on (SSO)",
          "Reports across classes",
          "Data stays on servers in Indonesia",
        ],
        cta: "Contact the team",
      },
    ],
  },
  footer: {
    tagline: "A process-based understanding check for academic integrity.",
    productHeading: "Product",
    infoHeading: "Information",
    contactHeading: "Contact",
    privacy: "Privacy Policy",
    login: "Log in",
    register: "Sign up",
    contact: "Contact the team",
    rights: "© 2026 Tim DataDigger",
  },
};
