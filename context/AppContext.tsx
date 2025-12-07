// context/AppContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export type Run = {
  id: string;
  dateISO: string;
  distanceMeters: number;
  durationSec: number;
};

export type WeightPoint = { dateISO: string; kg: number };
export type GoalType = "lose" | "gain" | "maintain" | undefined;

export type User = {
  // 🧠 Profile
  username?: string;
  displayName?: string;
  bio?: string;
  link?: string;
  verified?: boolean;
  avatarUrl?: string;

  // 🌍 Personal info
  location?: string;
  tagline?: string;

  // 💪 Body / fitness
  weight: number;
  height?: number;
  dailyGoal?: number;
  goalType?: GoalType;
  weightHistory?: WeightPoint[];
  targetWeight?: number;
};

export type AchievementId =
  | "first_run"
  | "first_5k"
  | "ten_k_total"
  | "streak_3"
  | "streak_7";

export type Achievement = {
  id: AchievementId;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
};

export type AppContext = {
  user: User;
  runs: Run[];
  achievements: Achievement[];
  updateUser: (patch: Partial<User>) => Promise<void>;
  appendWeightEntry: (kg: number, dateISO?: string) => Promise<void>;
  setRuns: React.Dispatch<React.SetStateAction<Run[]>>;
};

const AppCtx = createContext<AppContext | undefined>(undefined);

const USER_KEY = "app:user";
const RUNS_KEY = "app:runs";

/** Base default user (no Bear-specific text) */
const DEFAULT_USER_BASE: User = {
  username: undefined,
  displayName: undefined,
  bio: "",
  link: "",
  verified: false,
  avatarUrl: undefined,

  location: "ZA/AT",
  tagline: "",

  weight: 80,
  height: 175,
  dailyGoal: 8000,
  goalType: "maintain",
  targetWeight: 80,
  weightHistory: [],
};

/** Create a small dummy series that ends at `endKg` */
function seedWeightHistory(
  endKg: number,
  goal: GoalType = "maintain"
): WeightPoint[] {
  const days = 10;
  let deltaPerDay = 0;
  if (goal === "lose") deltaPerDay = +0.25;
  if (goal === "gain") deltaPerDay = -0.25;
  if (goal === "maintain" || goal === undefined) deltaPerDay = 0;

  const points: WeightPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateISO = d.toISOString();
    const kg = Number((endKg + deltaPerDay * i).toFixed(1));
    points.push({ dateISO, kg });
  }
  return points;
}

/** Compute longest daily streak from runs */
function computeLongestStreak(runs: Run[]): number {
  if (!runs.length) return 0;

  const days = new Set<string>(
    runs.map((r) => (r.dateISO ?? "").slice(0, 10))
  );

  let longest = 0;
  let current = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    if (days.has(key)) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      if (current > longest) longest = current;
      current = 0;
    }
  }

  return longest;
}

/** Compute achievements from runs only */
function computeAchievements(runs: Run[]): Achievement[] {
  const sortedRuns = [...runs].sort(
    (a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime()
  );

  const totalDistanceMeters = sortedRuns.reduce(
    (sum, r) => sum + (r.distanceMeters || 0),
    0
  );
  const firstRun = sortedRuns[0];
  const first5kRun = sortedRuns.find((r) => (r.distanceMeters ?? 0) >= 5000);
  const tenKTotalUnlocked = totalDistanceMeters >= 10000;
  const longestStreak = computeLongestStreak(sortedRuns);

  const achievements: Achievement[] = [
    {
      id: "first_run",
      title: "First Run Logged",
      description: "Track your very first run with FitSocial.",
      unlocked: !!firstRun,
      unlockedAt: firstRun ? firstRun.dateISO : undefined,
    },
    {
      id: "first_5k",
      title: "First 5K",
      description: "Complete a single run of at least 5 km.",
      unlocked: !!first5kRun,
      unlockedAt: first5kRun ? first5kRun.dateISO : undefined,
    },
    {
      id: "ten_k_total",
      title: "10 km Total",
      description: "Accumulate at least 10 km across all runs.",
      unlocked: tenKTotalUnlocked,
      unlockedAt:
        tenKTotalUnlocked && sortedRuns.length
          ? sortedRuns[sortedRuns.length - 1].dateISO
          : undefined,
    },
    {
      id: "streak_3",
      title: "3-Day Streak",
      description: "Run on 3 days in a row.",
      unlocked: longestStreak >= 3,
      unlockedAt:
        longestStreak >= 3 && sortedRuns.length
          ? sortedRuns[sortedRuns.length - 1].dateISO
          : undefined,
    },
    {
      id: "streak_7",
      title: "7-Day Streak",
      description: "Run on 7 days in a row.",
      unlocked: longestStreak >= 7,
      unlockedAt:
        longestStreak >= 7 && sortedRuns.length
          ? sortedRuns[sortedRuns.length - 1].dateISO
          : undefined,
    },
  ];

  return achievements;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);

  // start with a seeded default user (before hydration)
  const [user, setUser] = useState<User>(() => {
    const series = seedWeightHistory(
      DEFAULT_USER_BASE.weight,
      DEFAULT_USER_BASE.goalType
    );
    return { ...DEFAULT_USER_BASE, weightHistory: series };
  });

  const [lastAuthId, setLastAuthId] = useState<string | null>(
    authUser?.id ?? null
  );

  // Hydrate from AsyncStorage on first mount
  useEffect(() => {
    (async () => {
      try {
        const [uRaw, rRaw] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(RUNS_KEY),
        ]);

        if (uRaw) {
          const parsed = JSON.parse(uRaw) as User;
          if (
            !Array.isArray(parsed.weightHistory) ||
            parsed.weightHistory.length < 2
          ) {
            const series = seedWeightHistory(
              parsed.weight ?? DEFAULT_USER_BASE.weight,
              parsed.goalType
            );
            parsed.weightHistory = series;
          }
          setUser(parsed);
        } else {
          const series = seedWeightHistory(
            DEFAULT_USER_BASE.weight,
            DEFAULT_USER_BASE.goalType
          );
          const next = { ...DEFAULT_USER_BASE, weightHistory: series };
          setUser(next);
          AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
        }

        if (rRaw) setRuns(JSON.parse(rRaw));
      } catch {
        // ignore
      }
    })();
  }, []);

  // Persist runs whenever they change
  useEffect(() => {
    AsyncStorage.setItem(RUNS_KEY, JSON.stringify(runs)).catch(() => {});
  }, [runs]);

  // When the Supabase auth user changes (login/logout/switch),
  // wipe local data and hydrate from Supabase `profiles` so
  // username + avatar are consistent across devices.
  useEffect(() => {
    const currentId = authUser?.id ?? null;
    if (currentId === lastAuthId) return;

    (async () => {
      try {
        await AsyncStorage.multiRemove([USER_KEY, RUNS_KEY]);
      } catch {
        // ignore
      }

      const baseSeries = seedWeightHistory(
        DEFAULT_USER_BASE.weight,
        DEFAULT_USER_BASE.goalType
      );
      let next: User = { ...DEFAULT_USER_BASE, weightHistory: baseSeries };

      if (currentId) {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select(
              "username, display_name, avatar_url, bio, link"
            )
            .eq("id", currentId)
            .maybeSingle();

          if (!error && data) {
            next = {
              ...next,
              username: data.username ?? undefined,
              displayName: data.display_name ?? undefined,
              avatarUrl: data.avatar_url ?? undefined,
              bio: data.bio ?? "",
              link: data.link ?? "",
            };
          }
        } catch {
          // if this fails we just fall back to defaults
        }
      }

      setUser(next);
      setRuns([]);

      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
      AsyncStorage.setItem(RUNS_KEY, JSON.stringify([])).catch(() => {});
    })();

    setLastAuthId(currentId);
  }, [authUser?.id, lastAuthId]);

  // Unified user updater
  const updateUser = async (patch: Partial<User>) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // Append weight entry
  const appendWeightEntry = async (kg: number, dateISO?: string) => {
    setUser((prev) => {
      const entry: WeightPoint = {
        dateISO: dateISO ?? new Date().toISOString(),
        kg,
      };
      const series = Array.isArray(prev.weightHistory)
        ? [...prev.weightHistory, entry]
        : [entry];

      const next: User = { ...prev, weight: kg, weightHistory: series };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const achievements = useMemo(
    () => computeAchievements(runs),
    [runs]
  );

  const value = useMemo<AppContext>(
    () => ({ user, runs, achievements, updateUser, appendWeightEntry, setRuns }),
    [user, runs, achievements]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): AppContext {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
