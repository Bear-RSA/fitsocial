// utils/gradients.ts
import type { ColorValue } from "react-native";
import colors from "@/constants/colors";

const DEFAULT_ACCENT: [ColorValue, ColorValue] = ["#ff66cc", "#9b5cff"];

export function getACCENT(): [ColorValue, ColorValue] {
  const g = (colors as any)?.accentGradient;
  if (Array.isArray(g) && g.length >= 2) {
    return [g[0], g[1]] as [ColorValue, ColorValue];
  }
  return DEFAULT_ACCENT;
}
