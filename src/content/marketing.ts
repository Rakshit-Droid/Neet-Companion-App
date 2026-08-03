// Marketing copy mirrored from neetcompanion.com so the app carries the same
// story as the site. Kept as data, not scattered through components.

export const HERO = {
  eyebrow: "NEET Predictor & State Explorer",
  title: "Your complete NEET companion",
  body:
    "Predict your All India Rank, see which colleges are actually reachable, and build a " +
    "counselling list that holds up. Built on seven years of real MCC results.",
}

export interface Feature {
  title: string
  body: string
  icon: "target" | "map" | "map-pin" | "check-square" | "clipboard" | "calendar" | "zap"
  route?: string
  cta?: string
  soon?: boolean
}

export const FEATURES: Feature[] = [
  {
    title: "NEET Predictor",
    body: "Your rank from your score, then every MBBS, BDS and nursing seat within reach.",
    icon: "target",
    route: "/",
    cta: "Open predictor",
  },
  {
    title: "State Explorer",
    body: "Browse colleges state by state and compare cutoffs and seats side by side.",
    icon: "map",
    route: "/states",
    cta: "Explore states",
  },
  {
    title: "Telangana state quota",
    body: "KNRUHS competent-authority cutoffs, local and non-local. Not covered yet.",
    icon: "map-pin",
    soon: true,
  },
  { title: "Syllabus Tracker", body: "Track every chapter across Physics, Chemistry and Biology.", icon: "check-square", soon: true },
  { title: "Mock Tests", body: "Take a mock and see the colleges that score would reach.", icon: "clipboard", soon: true },
  { title: "Daily Goals", body: "A study target for each day, and a streak worth keeping.", icon: "calendar", soon: true },
  { title: "Quick Tips", body: "Short, practical strategy notes for the last mile.", icon: "zap", soon: true },
]

export const STEPS = [
  { n: "01", title: "Enter your score", body: "Or your rank, if results are already out." },
  { n: "02", title: "See what is reachable", body: "Seats sorted into Safe, Moderate and Reach against real cutoffs." },
  { n: "03", title: "Build your choice list", body: "Order preferences aspirational-first, the way counselling allots them." },
]

export interface Testimonial {
  quote: string
  name: string
  detail: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Everything I needed in one place instead of ten different tabs and PDFs.",
    name: "Divya P.",
    detail: "NEET 2026 aspirant",
  },
  {
    quote: "As a repeater I needed to know exactly which colleges my rank could reach.",
    name: "Arjun S.",
    detail: "NEET repeater, third attempt",
  },
  {
    quote: "Seeing the colleges a score would qualify for made the target concrete.",
    name: "Sneha R.",
    detail: "NEET 2025 aspirant",
  },
]

export const OFFICIAL_LINKS = [
  { label: "MCC counselling", url: "https://mcc.nic.in" },
  { label: "NTA NEET", url: "https://neet.nta.nic.in" },
]

export const DISCLAIMER =
  "For guidance only. Always verify against official MCC and NTA notifications before " +
  "making a counselling decision."
