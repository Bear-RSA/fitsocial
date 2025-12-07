// components/SettingsModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { View, Text, StyleSheet, Modal, Pressable, Switch } from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import { useTheme } from "@/theme/ThemeContext";
import SafeLinearGradient from "@/components/SafeLinearGradient";

const NOTIF_KEY = "@fit_notif_enabled_v1";

type Props = {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
};

export default function SettingsModal({ visible, onClose, onLogout }: Props) {
  const colors = useColors();
  const { theme, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, theme), [colors, theme]);
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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <BlurView tint={theme === "dark" ? "dark" : "light"} intensity={35} style={StyleSheet.absoluteFill} />
      <View style={styles.dim} />

      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {/* Display */}
          <Text style={styles.sectionLabel}>Display</Text>
          <View style={styles.row}>
            <Pressable
              onPress={() => setTheme("light")}
              style={[styles.pill, theme === "light" && styles.pillActive]}
            >
              <Text style={[styles.pillText, theme === "light" && styles.pillTextActive]}>Light</Text>
            </Pressable>
            <Pressable
              onPress={() => setTheme("dark")}
              style={[styles.pill, theme === "dark" && styles.pillActive]}
            >
              <Text style={[styles.pillText, theme === "dark" && styles.pillTextActive]}>Dark</Text>
            </Pressable>
          </View>

          {/* Notifications */}
          <Text style={styles.sectionLabel}>Notifications</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.rowText}>Enable notifications</Text>
            <Switch value={notif} onValueChange={setNotif} thumbColor={notif ? colors.primary : undefined} />
          </View>

          {/* Logout */}
          <SafeLinearGradient style={{ borderRadius: 12, marginTop: spacing.lg }}>
            <Pressable onPress={onLogout} style={{ paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>Logout</Text>
            </Pressable>
          </SafeLinearGradient>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, theme: "light" | "dark") {
  return StyleSheet.create({
    dim: { ...StyleSheet.absoluteFillObject, backgroundColor: theme === "dark" ? "#0006" : "#0003" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
    card: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
    title: { color: colors.text, fontSize: 18, fontWeight: "800", flex: 1 },
    sectionLabel: { color: colors.textMuted, fontSize: 12, marginTop: spacing.md, marginBottom: 8 },
    row: { flexDirection: "row", gap: 8 },
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
    },
    rowText: { color: colors.text, fontWeight: "700" },
  });
}
