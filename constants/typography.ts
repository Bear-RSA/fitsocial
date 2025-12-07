// constants/typography.ts
export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: 0.2 },
  h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: 0.2 },
  h3: { fontSize: 18, fontWeight: "600" as const },

  body: { fontSize: 14, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, fontWeight: "600" as const },

  caption: { fontSize: 12, fontWeight: "400" as const, letterSpacing: 0.3 },
  overline: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    fontWeight: "600" as const,
  },
};
