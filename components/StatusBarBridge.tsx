// components/StatusBarBridge.tsx
import React from "react";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/theme/ThemeContext";

export default function StatusBarBridge() {
  const { theme } = useTheme();
  // light theme -> dark text; dark theme -> light text
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}
