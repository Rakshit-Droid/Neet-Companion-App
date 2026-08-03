// Flat Touch-First system. Authoritative spec: DESIGN.md.
//
// No shadows anywhere: hierarchy comes from colour, weight and spacing.
// Every pairing below is measured against WCAG AA on its own surface.

export type Scheme = "light" | "dark"

export interface Palette {
  bg: string
  surface: string
  surfaceAlt: string
  border: string

  text: string
  textSecondary: string
  textMuted: string

  /** Brand fill. Labels on top of it must use `onAccent`, never white. */
  accent: string
  /** Accent as text on bg/surface. */
  accentText: string
  onAccent: string

  safe: string
  moderate: string
  reach: string

  safeBg: string
  moderateBg: string
  reachBg: string
}

const light: Palette = {
  bg: "#FFFFFF", // --background
  surface: "#F4F4F5", // --secondary
  surfaceAlt: "#F5F5F5", // --muted
  border: "#E5E5E5", // --border

  text: "#0A0A0A", // --foreground, 19.80 AAA
  textSecondary: "#18181B", // --secondary-foreground
  // Preset's --muted-foreground #737373 measures 4.31 on the card and fails
  // AA for body text, so it is darkened just enough to pass.
  textMuted: "#646464", // 5.92 on bg, 5.38 on surface

  accent: "#FDC700", // --primary
  // Raw amber as text is 1.57 and unusable, same trap as the lime it replaces.
  accentText: "#8F5A06", // 5.78 AA
  onAccent: "#733E0A", // --primary-foreground, 5.51 AA on amber

  // The preset ships only --destructive, so the confidence scale is built out.
  safe: "#0E6B52", // 6.47 AA
  moderate: "#9A4A00", // 6.26 AA
  reach: "#C10007", // 6.42 AA

  safeBg: "#DCF2EA",
  moderateBg: "#FBEEE0",
  reachBg: "#FDE7E7",
}

const dark: Palette = {
  bg: "#0A0A0A", // --background
  surface: "#171717", // --card
  surfaceAlt: "#262626", // --muted
  border: "#27272A", // --secondary, opaque stand-in for the preset's 10% white

  text: "#FAFAFA", // --foreground, 18.97 AAA
  textSecondary: "#E4E4E7",
  textMuted: "#A1A1A1", // --muted-foreground, 7.66 AAA

  accent: "#F0B100", // --primary
  accentText: "#F0B100", // 10.36 AAA on the dark background
  onAccent: "#733E0A", // --primary-foreground, 4.54 AA on amber

  safe: "#2DD4A7", // 10.45 AAA
  moderate: "#FDBA74", // 11.74 AAA
  reach: "#FF6467", // --destructive, 6.85 AA

  safeBg: "#0F2620",
  moderateBg: "#2A1C0E",
  reachBg: "#2B1416",
}

export const palettes: Record<Scheme, Palette> = { light, dark }

// Preset --radius is 0.875rem (14px). shadcn derives its scale from that:
// sm = radius - 4, md = radius, lg = radius + 4.
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const

export const space = {
  xs: 4,
  sm: 8,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const motion = {
  press: 120,
  base: 200,
} as const

export const font = {
  display: "Quantico-Regular",
  displayBold: "Quantico-Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
} as const

/**
 * Quantico carries display and labels; Inter carries everything you read.
 * Quantico ships only 400 and 700, so "bold" is 700 rather than 800.
 */
export const type = {
  displayXl: { fontFamily: font.displayBold, fontSize: 52, lineHeight: 54, letterSpacing: -1 },
  displayL: { fontFamily: font.displayBold, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  h1: { fontFamily: font.displayBold, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  h2: { fontFamily: font.displayBold, fontSize: 19, lineHeight: 24 },
  label: {
    fontFamily: font.display,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  bodyL: { fontFamily: font.body, fontSize: 17, lineHeight: 26 },
  body: { fontFamily: font.bodySemi, fontSize: 15, lineHeight: 22 },
  bodyRegular: { fontFamily: font.body, fontSize: 15, lineHeight: 23 },
  bodySm: { fontFamily: font.body, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: font.bodyMedium, fontSize: 12, lineHeight: 17 },
} as const

export const layout = {
  cardPadding: space.base,
  buttonHeight: 52,
  inputHeight: 52,
  /** Flat design leans on generous targets since there is no elevation cue. */
  touchMin: 48,
  proseMaxWidth: 620,
} as const
