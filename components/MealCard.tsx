// components/MealCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import SafeLinearGradient from "@/components/SafeLinearGradient";

export type MealItem = {
  id: string;
  title: string;
  kcalPerServing: number;
  servings: number;
  proteinPerServing?: number;
  carbsPerServing?: number;
  fatPerServing?: number;
  // derived totals
  totalKcal: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
};

type Props = {
  meal: MealItem;
  onAddAgain: (meal: MealItem) => void;
  onEdit: (meal: MealItem) => void;
  onDelete: (id: string) => void;
  /** When false, hides the gradient "Add" pill (used for Today list). */
  showAdd?: boolean;
};

export default function MealCard({ meal, onAddAgain, onEdit, onDelete, showAdd = true }: Props) {
  const colors = useColors();
  const s = useMemo(() => styles(colors), [colors]);

  return (
    <View style={s.card}>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{meal.title}</Text>
        <Text style={s.kcal}>{meal.totalKcal} kcal</Text>
        <Text style={s.sub}>
          {meal.kcalPerServing} kcal/serv · {meal.servings} {meal.servings === 1 ? "serving" : "servings"}
        </Text>
        <Text style={s.sub}>
          P {Math.round(meal.totalProtein ?? 0)}g · C {Math.round(meal.totalCarbs ?? 0)}g · F {Math.round(meal.totalFat ?? 0)}g
        </Text>
      </View>

      <View style={s.btnRow}>
        {/* Pink gradient Add — hidden on Today */}
        {showAdd && (
          <SafeLinearGradient style={{ borderRadius: 12, overflow: "hidden" }}>
            <Pressable style={s.pillPress} onPress={() => onAddAgain(meal)}>
              <Text style={s.pillText}>Add</Text>
            </Pressable>
          </SafeLinearGradient>
        )}

        {/* Exceptions: Edit / Del keep their solid colors */}
        <Pressable style={[s.pillSolid, { backgroundColor: "#16a34a" }]} onPress={() => onEdit(meal)}>
          <Text style={s.pillText}>Edit</Text>
        </Pressable>
        <Pressable style={[s.pillSolid, { backgroundColor: "#dc2626" }]} onPress={() => onDelete(meal.id)}>
          <Text style={s.pillText}>Del</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    title: { color: colors.text, fontSize: 16, fontWeight: "800" },
    kcal: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
    sub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

    btnRow: { flexDirection: "row", alignItems: "center", gap: 8 },

    // Gradient pill: just the pressable area inside the gradient
    pillPress: { paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
    pillText: { color: "#fff", fontWeight: "800" },

    // Solid pills for Edit / Del
    pillSolid: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 12,
      alignItems: "center",
    },
  });
