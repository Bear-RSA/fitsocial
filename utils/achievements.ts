// utils/achievements.ts
export type Run = { dateISO: string; distanceMeters: number; durationSec: number };
export type StatsShape = { weeklyStreak: number };
export type Achievement = {
  id: string;
  icon: string;         // Ionicons name
  color: string;        // unlocked color
  rule: (stats: StatsShape, runs: Run[]) => boolean;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_run",
    icon: "trophy",
    color: "#22D3EE",
    rule: (_stats, runs) => runs.length >= 1,
  },
  {
    id: "streak_5",
    icon: "flame",
    color: "#FB923C",
    rule: (stats) => stats.weeklyStreak >= 5,
  },
  {
    id: "distance_5k",
    icon: "walk",
    color: "#34D399",
    rule: (_stats, runs) => runs.some((r) => r.distanceMeters >= 5000),
  },
  {
    id: "distance_10k",
    icon: "walk",
    color: "#A78BFA",
    rule: (_stats, runs) => runs.some((r) => r.distanceMeters >= 10000),
  },
];
