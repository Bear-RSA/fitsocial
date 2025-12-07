// app/(tabs)/settings.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import { useTheme } from "@/theme/ThemeContext";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import { supabase } from "@/lib/supabase";

const NOTIF_KEY = "@fit_notif_enabled_v1";

export default function SettingsScreen() {
  const colors = useColors();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [notif, setNotif] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(NOTIF_KEY);
      if (raw != null) setNotif(raw === "1");
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(NOTIF_KEY, notif ? "1" : "0").catch(() => {});
  }, [notif]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network errors for now
    }
    // AppContext will wipe local data when auth user changes.
    router.replace("/auth");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: 28,
          fontWeight: "900",
          marginBottom: spacing.lg,
        }}
      >
        Settings
      </Text>

      {/* Appearance */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Appearance</Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => setTheme("light")}
            style={[styles.pill, theme === "light" && styles.pillActive]}
          >
            <Text
              style={[
                styles.pillText,
                theme === "light" && styles.pillTextActive,
              ]}
            >
              Light
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTheme("dark")}
            style={[styles.pill, theme === "dark" && styles.pillActive]}
          >
            <Text
              style={[
                styles.pillText,
                theme === "dark" && styles.pillTextActive,
              ]}
            >
              Dark
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.rowText}>Enable notifications</Text>
          <Switch
            value={notif}
            onValueChange={setNotif}
            thumbColor={notif ? colors.primary : undefined}
          />
        </View>
      </View>

      {/* Logout */}
      <SafeLinearGradient
        style={{ borderRadius: 12, marginTop: spacing.lg }}
      >
        <Pressable
          onPress={handleLogout}
          style={{ paddingVertical: 12, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Logout</Text>
        </Pressable>
      </SafeLinearGradient>
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: spacing.lg,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 10,
    },
    row: { flexDirection: "row", gap: 8, marginTop: 6 },
    pill: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    pillActive: { backgroundColor: colors.card, borderColor: colors.primary },
    pillText: { color: colors.textMuted, fontWeight: "700" },
    pillTextActive: { color: colors.text },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: 6,
    },
    rowText: { color: colors.text, fontWeight: "700" },
  });
}
