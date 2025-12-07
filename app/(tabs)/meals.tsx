// app/(tabs)/meals.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import MealCard, { MealItem } from "@/components/MealCard";
import { ThemedScrollView } from "@/components/ui/Themed";
import { useTheme } from "@/theme/ThemeContext";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import { supabase } from "@/lib/supabase";

/** -------------------- Storage / helpers -------------------- */

// AsyncStorage stores an *object* keyed by date:
// { "2025-11-15": MealItem[], "2025-11-16": MealItem[] }
const HISTORY_KEY = "@meal_history_v4";

const g = (n: number | undefined) => n ?? 0;
const uid = () => Math.random().toString(36).slice(2, 9);

function computeTotals(
  item: Omit<
    MealItem,
    "totalKcal" | "totalProtein" | "totalCarbs" | "totalFat"
  >
) {
  const servings = item.servings;
  return {
    totalKcal: Math.round(item.kcalPerServing * servings),
    totalProtein: g(item.proteinPerServing) * servings,
    totalCarbs: g(item.carbsPerServing) * servings,
    totalFat: g(item.fatPerServing) * servings,
  };
}

/** -------------------- Edge Function helpers -------------------- */

type EstimateResponse = {
  kcalPerServing: number;
  protein: number;
  carbs: number;
  fat: number;
};

async function estimateFromPhoto(base64: string): Promise<EstimateResponse> {
  const { data, error } = await supabase.functions.invoke<EstimateResponse>(
    "estimate-meal",
    {
      body: {
        type: "photo",
        imageBase64: base64,
      },
    }
  );

  if (error) {
    console.log(
      "estimate-meal (photo) error:",
      JSON.stringify(error, null, 2)
    );
    // our Edge Function sends { error, details }
    const anyErr = error as any;
    const details =
      anyErr?.details ||
      anyErr?.message ||
      "Edge Function returned a non-2xx status code.";
    throw new Error(details);
  }

  if (!data) {
    throw new Error("No data returned from estimate-meal.");
  }

  return data;
}

/** -------------------- Suggestions -------------------- */

const SUGGESTIONS: {
  title: string;
  kcalPerServing: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}[] = [
  { title: "Grilled Chicken & Rice", kcalPerServing: 520, protein: 45, carbs: 58, fat: 12 },
  { title: "Oats + Banana + PB", kcalPerServing: 430, protein: 16, carbs: 58, fat: 15 },
  { title: "Greek Yogurt + Berries", kcalPerServing: 260, protein: 20, carbs: 28, fat: 6 },
  { title: "Eggs on Toast", kcalPerServing: 390, protein: 22, carbs: 34, fat: 17 },
  { title: "Beef Stir Fry", kcalPerServing: 610, protein: 38, carbs: 45, fat: 28 },
];

/** -------------------- Screen -------------------- */

export default function MealsScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, theme), [colors, theme]);

  const todayKey = useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  const [history, setHistory] = useState<MealItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MealItem | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [fromAI, setFromAI] = useState(false); // flag to show "Estimated from photo (AI)"

  // form state
  const [title, setTitle] = useState("");
  const [kcalPerServing, setKcalPerServing] = useState<string>("500");
  const [servings, setServings] = useState<string>("1");
  const [protein, setProtein] = useState<string>("");
  const [carbs, setCarbs] = useState<string>("");
  const [fat, setFat] = useState<string>("");

  /** Load today's meals only */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        if (!raw) return;
        const allDays = JSON.parse(raw) as Record<string, MealItem[]>;
        setHistory(allDays[todayKey] ?? []);
      } catch (e) {
        console.log("Failed to load meal history", e);
      }
    })();
  }, [todayKey]);

  /** Persist today's meals back into the per-day object */
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(HISTORY_KEY);
        const allDays = raw ? (JSON.parse(raw) as Record<string, MealItem[]>) : {};
        allDays[todayKey] = history;
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(allDays));
      } catch (e) {
        console.log("Failed to save meal history", e);
      }
    })();
  }, [history, todayKey]);

  /** Totals for today */
  const totalKcalToday = useMemo(
    () => history.reduce((s, m) => s + m.totalKcal, 0),
    [history]
  );
  const totalProteinToday = useMemo(
    () => history.reduce((s, m) => s + g(m.totalProtein), 0),
    [history]
  );
  const totalCarbsToday = useMemo(
    () => history.reduce((s, m) => s + g(m.totalCarbs), 0),
    [history]
  );
  const totalFatToday = useMemo(
    () => history.reduce((s, m) => s + g(m.totalFat), 0),
    [history]
  );

  /** ---------- Modal helpers ---------- */
  const openAddModal = (prefill?: Partial<MealItem>, options?: { fromAI?: boolean }) => {
    setEditing(null);
    setFromAI(options?.fromAI ?? false);

    setTitle(prefill?.title ?? "");
    setKcalPerServing(
      prefill?.kcalPerServing != null ? String(prefill.kcalPerServing) : "500"
    );
    setServings(prefill?.servings != null ? String(prefill.servings) : "1");
    setProtein(
      prefill?.proteinPerServing != null
        ? String(prefill.proteinPerServing)
        : ""
    );
    setCarbs(
      prefill?.carbsPerServing != null ? String(prefill.carbsPerServing) : ""
    );
    setFat(prefill?.fatPerServing != null ? String(prefill.fatPerServing) : "");
    setModalVisible(true);
  };

  const openEditModal = (meal: MealItem) => {
    setEditing(meal);
    setFromAI(false);
    setTitle(meal.title);
    setKcalPerServing(String(meal.kcalPerServing));
    setServings(String(meal.servings));
    setProtein(
      meal.proteinPerServing != null ? String(meal.proteinPerServing) : ""
    );
    setCarbs(meal.carbsPerServing != null ? String(meal.carbsPerServing) : "");
    setFat(meal.fatPerServing != null ? String(meal.fatPerServing) : "");
    setModalVisible(true);
  };

  const saveModal = () => {
    const kps = Math.max(0, Number(kcalPerServing) || 0);
    const sv = Math.max(0, Number(servings) || 0);

    if (!title.trim() || kps <= 0 || sv <= 0) {
      Alert.alert("Check fields", "Title, kcal/serving, and servings must be valid.");
      return;
    }

    const pps = protein === "" ? undefined : Math.max(0, Number(protein) || 0);
    const cps = carbs === "" ? undefined : Math.max(0, Number(carbs) || 0);
    const fps = fat === "" ? undefined : Math.max(0, Number(fat) || 0);

    const base = {
      id: editing?.id ?? uid(),
      title: title.trim(),
      kcalPerServing: kps,
      servings: sv,
      proteinPerServing: pps,
      carbsPerServing: cps,
      fatPerServing: fps,
    };
    const totals = computeTotals(base);
    const finalItem: MealItem = { ...base, ...totals };

    if (editing) {
      setHistory((prev) => prev.map((m) => (m.id === editing.id ? finalItem : m)));
    } else {
      setHistory((prev) => [finalItem, ...prev]);
    }

    setModalVisible(false);
    setFromAI(false);
  };

  const deleteMeal = (id: string) =>
    setHistory((prev) => prev.filter((m) => m.id !== id));

  const addSuggestion = (s: (typeof SUGGESTIONS)[number]) =>
    openAddModal({
      title: s.title,
      kcalPerServing: s.kcalPerServing,
      servings: 1,
      proteinPerServing: s.protein,
      carbsPerServing: s.carbs,
      fatPerServing: s.fat,
    });

  /** ---------- Photo → AI kcal estimation ---------- */
  const uploadAndEstimate = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo library access.");
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true, // we need base64 for the Edge Function
      });
      if (res.canceled || !res.assets?.length) return;

      const asset = res.assets[0];
      if (!asset.base64) {
        Alert.alert(
          "Scan failed",
          "Could not read image data. Try another photo."
        );
        return;
      }

      setEstimating(true);

      const { kcalPerServing, protein, carbs, fat } =
        await estimateFromPhoto(asset.base64);

      // 🔥 This is the AI output: kcal + macros/serv
      // We show it clearly in an "Estimated Meal" modal, but still editable.
      openAddModal(
        {
          title: "Estimated Meal",
          kcalPerServing,
          servings: 1,
          proteinPerServing: protein,
          carbsPerServing: carbs,
          fatPerServing: fat,
        },
        { fromAI: true }
      );
    } catch (e: any) {
      console.log("uploadAndEstimate error", e);
      Alert.alert(
        "Scan failed",
        e?.message ?? "Could not estimate calories from this photo."
      );
    } finally {
      setEstimating(false);
    }
  };

  return (
    <ThemedScrollView
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
    >
      <Text style={styles.title}>Meals</Text>
      <Text style={styles.caption}>
        Track today’s calories and macros. Upload a photo to estimate kcal/serving with AI, then choose your servings.
      </Text>
      <Text style={styles.disclaimer}>
        Calories reset every 24 hours at midnight. Only today’s meals are counted here.
      </Text>

      {/* Totals card */}
      <View style={styles.totalCard}>
        <View>
          <Text style={styles.totalLabel}>Total today</Text>
          <Text style={styles.totalValue}>{totalKcalToday} kcal</Text>
          <Text style={styles.totalMacros}>
            P {Math.round(totalProteinToday)}g · C{" "}
            {Math.round(totalCarbsToday)}g · F {Math.round(totalFatToday)}g
          </Text>
        </View>

        {/* Add manually */}
        <SafeLinearGradient style={styles.gradBtnOuter}>
          <Pressable onPress={() => openAddModal()} style={styles.gradBtnPress}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.gradBtnText}>Add manually</Text>
          </Pressable>
        </SafeLinearGradient>
      </View>

      {/* Upload photo → AI */}
      <SafeLinearGradient
        style={[
          styles.gradBtnOuter,
          { alignSelf: "flex-start", borderRadius: 16, marginTop: spacing.lg },
        ]}
      >
        <Pressable
          onPress={uploadAndEstimate}
          style={[
            styles.gradBtnPress,
            { paddingVertical: 12, paddingHorizontal: 14 },
          ]}
          disabled={estimating}
        >
          <Ionicons name="image" size={20} color="#fff" />
          <Text style={styles.gradBtnText}>
            {estimating ? "Scanning meal…" : "Upload Meal Photo (AI kcal + macros/serv)"}
          </Text>
        </Pressable>
      </SafeLinearGradient>

      {/* Suggestions */}
      <View style={{ marginTop: spacing.xl }}>
        <Text style={styles.sectionTitle}>Suggestions</Text>
        <View style={{ marginTop: spacing.sm }}>
          {SUGGESTIONS.map((s) => (
            <View key={s.title} style={styles.suggestionRow}>
              <Text style={styles.suggestionText}>{s.title}</Text>
              <SafeLinearGradient
                style={{ borderRadius: 10, overflow: "hidden" }}
              >
                <Pressable
                  onPress={() => addSuggestion(s)}
                  style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Add</Text>
                </Pressable>
              </SafeLinearGradient>
            </View>
          ))}
        </View>
      </View>

      {/* Today’s history */}
      <View style={{ marginTop: spacing.xl }}>
        <Text style={styles.sectionTitle}>Today</Text>
        {history.length === 0 ? (
          <Text style={styles.caption}>No meals added yet.</Text>
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            {history.map((m) => (
              <MealCard
                key={m.id}
                meal={m}
                showAdd={false}
                onAddAgain={() => {}}
                onEdit={openEditModal}
                onDelete={deleteMeal}
              />
            ))}
          </View>
        )}
      </View>

      {/* Add/Edit modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          setFromAI(false);
        }}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? "Edit meal" : fromAI ? "Estimated from photo (AI)" : "Add meal"}
            </Text>
            {fromAI && (
              <Text style={styles.aiHelper}>
                These values were generated by AI from your photo. Adjust title or servings if needed, then save to today.
              </Text>
            )}

            <Text style={styles.label}>Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Grilled Chicken & Rice"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>kcal per serving</Text>
            <TextInput
              value={kcalPerServing}
              onChangeText={setKcalPerServing}
              keyboardType="numeric"
              placeholder="500"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Servings</Text>
            <TextInput
              value={servings}
              onChangeText={setServings}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Protein per serving (g) — optional</Text>
            <TextInput
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
              placeholder="e.g. 30"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Carbs per serving (g) — optional</Text>
            <TextInput
              value={carbs}
              onChangeText={setCarbs}
              keyboardType="numeric"
              placeholder="e.g. 45"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Fat per serving (g) — optional</Text>
            <TextInput
              value={fat}
              onChangeText={setFat}
              keyboardType="numeric"
              placeholder="e.g. 12"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => {
                  setModalVisible(false);
                  setFromAI(false);
                }}
                style={[styles.modalBtn, styles.cancelBtnBg]}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>

              <SafeLinearGradient
                style={[
                  styles.modalBtn,
                  { borderRadius: 12, overflow: "hidden" },
                ]}
              >
                <Pressable
                  onPress={saveModal}
                  style={{ paddingVertical: 12, alignItems: "center" }}
                >
                  <Text style={styles.modalBtnText}>Save</Text>
                </Pressable>
              </SafeLinearGradient>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedScrollView>
  );
}

/** -------------------- Styles -------------------- */

function makeStyles(
  colors: ReturnType<typeof useColors>,
  theme: "light" | "dark"
) {
  const inputBg = theme === "dark" ? colors.bg : colors.card;

  return StyleSheet.create({
    title: { color: colors.text, fontSize: 22, fontWeight: "800" },
    caption: { color: colors.textMuted, marginTop: 6 },
    disclaimer: { color: colors.textMuted, marginTop: 4, fontSize: 11 },

    totalCard: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    totalLabel: { color: colors.textMuted, fontSize: 12 },
    totalValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
    totalMacros: { color: colors.textMuted, marginTop: 4 },

    gradBtnOuter: { borderRadius: 12, overflow: "hidden" },
    gradBtnPress: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    gradBtnText: { color: "#fff", fontWeight: "800" },

    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
    suggestionRow: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 12,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    suggestionText: { color: colors.text },

    modalWrap: {
      flex: 1,
      backgroundColor: "#0008",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 6,
    },
    aiHelper: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 8,
    },
    label: { color: colors.textMuted, fontSize: 12, marginTop: 8 },
    input: {
      backgroundColor: inputBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      color: colors.text,
      marginTop: 6,
    },

    modalBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
    modalBtn: {
      flex: 1,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnText: { color: "#fff", fontWeight: "800" },
    cancelBtnBg: {
      backgroundColor: theme === "dark" ? "#334155" : "#475569",
    },
  });
}
