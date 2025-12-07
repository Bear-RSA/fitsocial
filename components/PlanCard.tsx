// components/PlanCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";

type Props = {
  name: string;
  icon: string; // Ionicons name
  color: string; // accent for icon/progress
  completed: number;
  total: number;
  onPress?: () => void;
};

export default function PlanCard({
  name,
  icon,
  color,
  completed,
  total,
  onPress,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors, color), [colors, color]);

  const pct =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.iconBadge}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>

      <Text style={styles.title}>{name}</Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      <Text style={styles.caption}>
        {completed}/{total} complete
      </Text>
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, accent: string) {
  return StyleSheet.create({
    card: {
      width: "48%",
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    iconBadge: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${accent}55`,
      backgroundColor: `${accent}22`,
      marginBottom: 8,
    },
    title: {
      color: colors.text,
      fontWeight: "800",
    },
    track: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: 6,
      marginTop: spacing.sm,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: 6,
      backgroundColor: accent,
    },
    caption: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 6,
    },
  });
}
