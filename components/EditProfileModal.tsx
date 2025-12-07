// components/EditProfileModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import { useTheme } from "@/theme/ThemeContext";
import SafeLinearGradient from "@/components/SafeLinearGradient";

export type EditUser = {
  displayName?: string;
  bio?: string;
  link?: string;
  avatarUrl?: string;

  weight: number;
  height?: number;
  dailyGoal?: number;
  targetWeight?: number;

  location?: string; // e.g. "ZA/KZN"
  tagline?: string; // e.g. "YNWA"
};

type Props = {
  visible: boolean;
  user: EditUser;
  onClose: () => void;
  onSaved?: (patch: Partial<EditUser>) => void;
};

const BIO_MAX = 120;

export default function EditProfileModal({
  visible,
  user,
  onClose,
  onSaved,
}: Props) {
  const colors = useColors();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(colors, theme), [colors, theme]);

  // ---------- FORM STATE ----------
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [bio, setBio] = useState((user?.bio ?? "").slice(0, BIO_MAX));
  const [link, setLink] = useState(user?.link ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");

  const [weight, setWeight] = useState(
    user?.weight != null ? String(user.weight) : ""
  );
  const [height, setHeight] = useState(
    user?.height != null ? String(user.height) : ""
  );
  const [dailyGoal, setDailyGoal] = useState(
    user?.dailyGoal != null ? String(user.dailyGoal) : ""
  );
  const [targetWeight, setTargetWeight] = useState(
    user?.targetWeight != null ? String(user.targetWeight) : ""
  );

  const [location, setLocation] = useState(user?.location ?? "ZA/");
  const [tagline, setTagline] = useState(user?.tagline ?? "");

  // When modal opens with a fresh user, sync form fields
  useEffect(() => {
    if (!visible) return;
    setDisplayName(user?.displayName ?? "");
    setBio((user?.bio ?? "").slice(0, BIO_MAX));
    setLink(user?.link ?? "");
    setAvatarUrl(user?.avatarUrl ?? "");

    setWeight(user?.weight != null ? String(user.weight) : "");
    setHeight(user?.height != null ? String(user.height) : "");
    setDailyGoal(user?.dailyGoal != null ? String(user.dailyGoal) : "");
    setTargetWeight(
      user?.targetWeight != null ? String(user.targetWeight) : ""
    );

    setLocation(user?.location ?? "ZA/");
    setTagline(user?.tagline ?? "");
  }, [visible, user]);

  // ---------- SELECT PROFILE IMAGE ----------
  async function choosePhoto() {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to choose a profile picture."
        );
        return;
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        // This is a local file:// URI.
        // ProfileScreen will handle uploading it to Supabase.
        setAvatarUrl(res.assets[0].uri);
      }
    } catch (e) {
      console.log("choosePhoto error", e);
      Alert.alert(
        "Photo",
        "Something went wrong while picking the photo. Please try again."
      );
    }
  }

  // ---------- SAVE ----------
  const save = () => {
    const w = Math.max(0, Number(weight) || 0);
    const h = height === "" ? undefined : Math.max(0, Number(height) || 0);
    const goal =
      dailyGoal === "" ? undefined : Math.max(0, Number(dailyGoal) || 0);
    const tw =
      targetWeight === ""
        ? undefined
        : Math.max(0, Number(targetWeight) || 0);

    const patch: Partial<EditUser> = {
      displayName: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      link: link.trim() || undefined,
      avatarUrl: avatarUrl?.trim() || undefined,

      weight: w,
      height: h,
      dailyGoal: goal,
      targetWeight: tw,

      location: location.trim() || undefined,
      tagline: tagline.trim() || undefined,
    };

    onSaved?.(patch);
    onClose();
  };

  const avatarPreview = avatarUrl || "";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <BlurView
        tint={theme === "dark" ? "dark" : "light"}
        intensity={35}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.dim} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.center}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Edit Profile</Text>

          {/* AVATAR */}
          <View style={styles.avatarRow}>
            <SafeLinearGradient style={styles.avatarRing}>
              {avatarPreview ? (
                <Image source={{ uri: avatarPreview }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={28} color={colors.textMuted} />
                </View>
              )}
            </SafeLinearGradient>

            <SafeLinearGradient style={styles.pickBtnGrad}>
              <Pressable onPress={choosePhoto} style={styles.pickBtnPress}>
                <Ionicons name="image" size={16} color="#fff" />
                <Text style={styles.pickBtnText}>Choose Photo</Text>
              </Pressable>
            </SafeLinearGradient>
          </View>

          {/* FORM */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={{ paddingBottom: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            {row("Display name", displayName, setDisplayName, colors)}

            {row("Location (e.g. ZA/KZN)", location, setLocation, colors)}

            {row("Tagline", tagline, setTagline, colors)}

            {/* BIO */}
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  marginBottom: 6,
                }}
              >
                Bio
              </Text>
              <TextInput
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
                placeholder="Write a short bio…"
                placeholderTextColor={colors.textMuted}
                style={styles.bioInput}
                multiline
                maxLength={BIO_MAX}
              />
              <Text style={styles.counter}>
                {bio.length}/{BIO_MAX}
              </Text>
            </View>

            {row("Link", link, setLink, colors)}
            {row("Weight (kg)", weight, setWeight, colors, "numeric")}
            {row("Height (cm)", height, setHeight, colors, "numeric")}
            {row(
              "Target weight (kg)",
              targetWeight,
              setTargetWeight,
              colors,
              "numeric"
            )}
            {row(
              "Daily goal (kcal/steps)",
              dailyGoal,
              setDailyGoal,
              colors,
              "numeric"
            )}
          </ScrollView>

          {/* BUTTONS */}
          <View style={styles.row}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, styles.btnSecondary]}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>

            <SafeLinearGradient style={styles.btn}>
              <Pressable onPress={save} style={styles.btnContent}>
                <Ionicons name="save" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </Pressable>
            </SafeLinearGradient>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* INPUT ROW HELPER */
function row(
  label: string,
  value: string,
  setValue: (t: string) => void,
  colors: ReturnType<typeof useColors>,
  keyboardType?: "numeric"
) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          color: colors.text,
          fontWeight: "700",
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => setValue(t)}
        placeholderTextColor={colors.textMuted}
        style={{
          color: colors.text,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
        }}
        keyboardType={keyboardType}
      />
    </View>
  );
}

/* STYLES */
function makeStyles(
  colors: ReturnType<typeof useColors>,
  theme: "light" | "dark"
) {
  return StyleSheet.create({
    dim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme === "dark" ? "#0006" : "#0003",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    card: {
      width: "92%",
      maxWidth: 420,
      maxHeight: "80%",
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: spacing.md,
    },
    formScroll: { maxHeight: 420 },

    avatarRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: spacing.md,
    },
    avatarRing: { borderRadius: 999, padding: 3 },
    avatarImg: { width: 72, height: 72, borderRadius: 999 },
    avatarPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },

    pickBtnGrad: { borderRadius: 12, overflow: "hidden" },
    pickBtnPress: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pickBtnText: { color: "#fff", fontWeight: "800" },

    bioInput: {
      color: colors.text,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 88,
      textAlignVertical: "top",
    },
    counter: {
      alignSelf: "flex-end",
      marginTop: 4,
      color: colors.textMuted,
      fontSize: 12,
    },

    row: { flexDirection: "row", gap: 10, marginTop: spacing.lg },
    btn: { flex: 1, borderRadius: 14, overflow: "hidden" },
    btnContent: {
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    btnPrimaryText: { color: "#fff", fontWeight: "800" },
    btnSecondary: {
      backgroundColor: theme === "dark" ? "#334155" : "#475569",
    },
    btnSecondaryText: {
      color: "#fff",
      fontWeight: "800",
      textAlign: "center",
      paddingVertical: 12,
    },
  });
}
