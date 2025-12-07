// theme/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";
type ThemeCtx = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};
const KEY = "@fit_theme_v1";

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(KEY)) as ThemeMode | null;
      if (saved === "light" || saved === "dark") {
        setThemeState(saved);
      } else {
        const sys = Appearance.getColorScheme();
        setThemeState(sys === "light" ? "light" : "dark");
      }
    })();
  }, []);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    AsyncStorage.setItem(KEY, t).catch(() => {});
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
