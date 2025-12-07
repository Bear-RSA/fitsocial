// components/StatCard.tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";

type Props = {
  icon: string;
  value: number | string;
  label: string;
  color: string;
};

export default function StatCard({ icon, value, label, color }: Props) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: colors.primary,
        },
      ]}
    >
      <View style={styles.inner}>
        <Ionicons name={icon as any} size={24} color={color} style={styles.icon} />
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  inner: {
    alignItems: "center", // ✅ centers everything horizontally
    justifyContent: "center", // ✅ centers vertically too
  },
  icon: {
    marginBottom: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 2,
    textAlign: "center",
  },
  label: {
    fontSize: 13,
    textAlign: "center",
  },
});
