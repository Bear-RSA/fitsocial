// components/AchievementsRow.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import { useApp, Achievement } from "@/context/AppContext";

type IconName =
  | "walk-outline"
  | "trophy-outline"
  | "flame-outline"
  | "calendar-outline"
  | "ribbon-outline";

const iconForAchievement: Record<string, IconName> = {
  first_run: "walk-outline",
  first_5k: "trophy-outline",
  ten_k_total: "flame-outline",
  streak_3: "calendar-outline",
  streak_7: "ribbon-outline",
};

const subtitleForAchievement: Record<string, string> = {
  first_run: "Log your very first run",
  first_5k: "One continuous 5 km run",
  ten_k_total: "Reach 10 km total distance",
  streak_3: "Run 3 days in a row",
  streak_7: "Run 7 days in a row",
};

export default function AchievementsRow() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { achievements } = useApp();

  const sorted = useMemo(
    () =>
      [...achievements].sort((a, b) => {
        const order: Record<string, number> = {
          first_run: 1,
          first_5k: 2,
          ten_k_total: 3,
          streak_3: 4,
          streak_7: 5,
        };
        return (order[a.id] ?? 99) - (order[b.id] ?? 99);
      }),
    [achievements]
  );

  if (!sorted.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Start tracking runs to unlock your first badge.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {sorted.map((ach) => (
        <AchievementBadge key={ach.id} achievement={ach} />
      ))}
    </ScrollView>
  );
}

function AchievementBadge({ achievement }: { achievement: Achievement }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const unlocked = achievement.unlocked;
  const iconName =
    iconForAchievement[achievement.id] ?? ("trophy-outline" as IconName);
  const subtitle =
    subtitleForAchievement[achievement.id] ?? "Keep moving to unlock this";

  const unlockedDate = achievement.unlockedAt
    ? new Date(achievement.unlockedAt).toLocaleDateString()
    : undefined;

  if (unlocked) {
    return (
      <SafeLinearGradient style={styles.badgeGradient}>
        <View style={styles.badgeInner}>
          <View style={styles.badgeIconCircle}>
            <Ionicons name={iconName} size={18} color="#0b1120" />
          </View>
          <Text numberOfLines={1} style={styles.badgeTitleUnlocked}>
            {achievement.title}
          </Text>
          <Text numberOfLines={2} style={styles.badgeSubtitleUnlocked}>
            {subtitle}
          </Text>
          {unlockedDate ? (
            <Text style={styles.badgeMetaUnlocked}>Unlocked · {unlockedDate}</Text>
          ) : (
            <Text style={styles.badgeMetaUnlocked}>Unlocked</Text>
          )}
        </View>
      </SafeLinearGradient>
    );
  }

  // Locked style
  return (
    <View style={styles.badgeLocked}>
      <View style={styles.badgeInner}>
        <View style={styles.badgeIconCircleLocked}>
          <Ionicons name={iconName} size={18} color={colors.textMuted} />
        </View>
        <Text numberOfLines={1} style={styles.badgeTitleLocked}>
          {achievement.title}
        </Text>
        <Text numberOfLines={2} style={styles.badgeSubtitleLocked}>
          {subtitle}
        </Text>
        <Text style={styles.badgeMetaLocked}>Locked</Text>
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    row: {
      paddingRight: spacing.lg,
      paddingLeft: spacing.xs,
    },
    empty: {
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
    },

    badgeGradient: {
      width: 180,
      borderRadius: 18,
      padding: 1,
      marginLeft: spacing.sm,
      marginRight: spacing.xs,
    },
    badgeInner: {
      flex: 1,
      backgroundColor: colors.bg,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },

    badgeLocked: {
      width: 180,
      borderRadius: 18,
      marginLeft: spacing.sm,
      marginRight: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },

    badgeIconCircle: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.8)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    badgeIconCircleLocked: {
      width: 26,
      height: 26,
      borderRadius: 999,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },

    badgeTitleUnlocked: {
      color: "#0b1120",
      fontWeight: "800",
      fontSize: 13,
    },
    badgeSubtitleUnlocked: {
      color: "#111827",
      fontSize: 11,
      marginTop: 2,
    },
    badgeMetaUnlocked: {
      color: "#0f172a",
      fontSize: 10,
      marginTop: 6,
      fontWeight: "600",
    },

    badgeTitleLocked: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    badgeSubtitleLocked: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    badgeMetaLocked: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 6,
    },
  });
}
