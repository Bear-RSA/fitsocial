// constants/colors.ts
import { useTheme } from "@/theme/ThemeContext";


// Extracted from the logo
const ORANGE = "#ff5100ff";
const ORANGE_DARK = "#a85839ff";
const ORANGE_BURNT = "#221711ff";

// Light mode (soft, NOT bright white)
export const lightColors = {
  bg: "#e7dccdff",              // soft warm off-white (easy on eyes)
  card: "#FFFFFF",
  border: "#c4ac98ff",

  text: "#0B0B0C",
  textMuted: "#5C5C5F",

  primary: ORANGE,            // signature FitSocial orange
  primaryDark: ORANGE_DARK,
  accentGradient: [ORANGE, ORANGE_DARK] as [string, string],
};

// Dark mode (logo theme)
export const darkColors = {
  bg: "#000000ff",              // almost pure black
  card: "#1a1d1dff",
  border: "#4d4c4cff",

  text: "#ffffffff",
  textMuted: "#b8b8b8ff",

  primary: ORANGE,
  primaryDark: ORANGE_DARK,
  accentGradient: [ORANGE, ORANGE_BURNT] as [string, string],
};

/* -------------------------------------------------------------
   LIVE SINGLETON (legacy-safe)
   - Keeps compatibility with older components importing default
--------------------------------------------------------------*/

const live = { ...lightColors } as typeof lightColors;
export default live;

export function applyThemeToColors(theme: "light" | "dark") {
  const src = theme === "dark" ? darkColors : lightColors;

  (Object.keys(src) as Array<keyof typeof src>).forEach((k) => {
    // @ts-expect-error intentional mutation
    live[k] = src[k];
  });
}

/* -------------------------------------------------------------
   HOOK: Recommended for all new components
--------------------------------------------------------------*/

export function useColors() {
  const { theme } = useTheme();
  return theme === "dark" ? darkColors : lightColors;
}
