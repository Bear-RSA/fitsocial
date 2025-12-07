// app/(tabs)/home.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import { useApp } from "@/context/AppContext";

import StatCard from "@/constants/StatCard";
import WeightChart, { WeightPoint } from "@/components/WeightChart";
import AchievementsRow from "@/components/AchievementsRow";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import Screen from "@/components/ui/Screen";
import PrimaryButton from "@/components/ui/PrimaryButton";

const WEIGHT_KEY = "@fit_weight_history_v1";

export default function Home() {
  const colors = useColors();
  const router = useRouter();
  const { user, runs } = useApp();

  // 🔥 Greeting name: Display Name → Username → “Bear”
  const displayName =
    user?.displayName?.trim() || user?.username?.trim() || "Bear";

  // ---------- Progress (weight) ----------
  const [weightData, setWeightData] = useState<WeightPoint[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [weightInput, setWeightInput] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(WEIGHT_KEY);
        if (raw) setWeightData(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(weightData)).catch(() => {});
  }, [weightData]);

  function addWeight() {
    const w = Number(weightInput);
    if (!isFinite(w) || w <= 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const next = [
      ...weightData.filter((p) => p.date !== today),
      { date: today, weight: w },
    ].sort((a, b) => a.date.localeCompare(b.date));
    setWeightData(next);
    setWeightInput("");
    setAddOpen(false);
  }

  // ---------- Home stats ----------
  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyWorkoutsSafe = useMemo(
    () => runs.filter((r) => (r.dateISO ?? "").startsWith(todayKey)).length,
    [runs, todayKey]
  );

  const weeklyStreakSafe = useMemo(() => {
    if (!runs.length) return 0;
    const days = new Set(runs.map((r) => (r.dateISO ?? "").slice(0, 10)));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      if (days.has(k)) streak++;
      else break;
    }
    return streak;
  }, [runs]);

  return (
    <Screen padded={false}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
      >
        {/* Greeting */}
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: "800",
            marginTop: spacing.md,
          }}
        >
          Hello, {displayName}.
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 6 }}>
          Ready to crush your goals today?
        </Text>

        {/* Big CTA */}
        <Pressable
          onPress={() => router.push("/tracker")}
          style={{ marginTop: spacing.xl }}
        >
          <SafeLinearGradient
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderRadius: 20,
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.xl,
              shadowColor: colors.primary,
              shadowOpacity: 0.22,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 18,
                  fontWeight: "800",
                }}
              >
                Live Jogging Tracker
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.86)",
                  fontSize: 13,
                  marginTop: 2,
                }}
              >
                Start a new run and track your progress live.
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.18)",
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="map" size={24} color="#ffffff" />
            </View>
          </SafeLinearGradient>
        </Pressable>

        {/* Stats */}
        <View style={{ marginTop: spacing.xl }}>
          <StatCard
            icon="flash"
            value={dailyWorkoutsSafe}
            label="Workouts Done"
            color="#FACC15"
          />
          <StatCard
            icon="flame"
            value={weeklyStreakSafe}
            label="Day Streak"
            color="#FB923C"
          />
        </View>

        {/* Progress */}
        <View
          style={{
            marginTop: spacing.xl,
            marginBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.text,
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Progress
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Weight over time (every 5 days on X-axis)
            </Text>
          </View>

          {/* Brand gradient "Add Weight" button */}
          <SafeLinearGradient style={{ borderRadius: 10, overflow: "hidden" }}>
            <Pressable
              onPress={() => setAddOpen(true)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>
                + Add Weight
              </Text>
            </Pressable>
          </SafeLinearGradient>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <WeightChart data={weightData} />
        </View>

        {/* Achievements */}
        <View style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Achievements
          </Text>
        </View>
        <AchievementsRow />
      </ScrollView>

      {/* Add Weight Modal */}
      <Modal
        visible={addOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddOpen(false)}
      >
        <Pressable
          style={styles(colors).backdrop}
          onPress={() => setAddOpen(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles(colors).modalWrap}
          pointerEvents="box-none"
        >
          <View style={styles(colors).modalCard}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles(colors).modalTitle}>Add today’s weight</Text>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={{ marginLeft: "auto" }}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles(colors).label}>Weight (kg)</Text>
            <TextInput
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="numeric"
              placeholder="e.g. 78.6"
              placeholderTextColor={colors.textMuted}
              style={styles(colors).input}
            />

            <View style={styles(colors).buttonRow}>
              <Pressable
                onPress={() => setAddOpen(false)}
                style={styles(colors).cancelBtn}
              >
                <Text style={styles(colors).cancelText}>Cancel</Text>
              </Pressable>

              <PrimaryButton
                label="Save"
                onPress={addWeight}
                style={styles(colors).saveBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    backdrop: {
      position: "absolute",
      inset: 0,
      backgroundColor: "#0008",
    },
    modalWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    modalCard: {
      width: "92%",
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: spacing.md,
    },
    input: {
      marginTop: 6,
      backgroundColor: colors.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      color: colors.text,
      fontSize: 16,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: spacing.md,
    },
    cancelBtn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor:
        colors.bg === "#020202" ? "#111111" : "rgba(0,0,0,0.02)",
    },
    cancelText: {
      color: colors.text,
      fontWeight: "600",
    },
    saveBtn: {
      flex: 1,
    },
  });
