// app/auth.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { supabase } from "@/lib/supabase";
import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import SafeLinearGradient from "@/components/SafeLinearGradient";

type Mode = "login" | "signup";

export default function AuthScreen() {
  const colors = useColors();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");

  // Login fields
  const [identifier, setIdentifier] = useState(""); // email OR username
  const [loginPassword, setLoginPassword] = useState("");

  // Signup fields
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const styles = makeStyles(colors);

  const toggleMode = (next: Mode) => {
    setMode(next);
  };

  /* -------- Username validation for sign-up -------- */
  const validateUsername = (raw: string): string | null => {
    const u = raw.trim();
    if (u.length < 3) return "Username must be at least 3 characters.";
    if (!/^[a-zA-Z0-9]+$/.test(u)) {
      return "Username can only contain letters and numbers (no spaces or symbols).";
    }
    return null;
  };

  /* -------- LOGIN: email OR username -------- */
  const handleLogin = async () => {
    if (!identifier || !loginPassword) {
      return Alert.alert(
        "Missing info",
        "Please enter your email or username and your password."
      );
    }

    setLoading(true);
    try {
      const raw = identifier.trim();
      let loginEmail = "";

      if (raw.includes("@")) {
        // treat as email
        loginEmail = raw.toLowerCase();
      } else {
        // treat as username -> look up email in profiles
        const cleanUsername = raw.toLowerCase();
        const { data, error } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", cleanUsername)
          .maybeSingle();

        // PGRST116 = no rows; don't treat as a fatal error
        if (error && (error as any).code !== "PGRST116") {
          throw error;
        }

        if (!data?.email) {
          return Alert.alert(
            "Login failed",
            "No account found for that username."
          );
        }

        loginEmail = (data.email as string).toLowerCase();
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (signInErr) {
        return Alert.alert("Login failed", signInErr.message);
      }

      // success → go into the app
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Login error", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* -------- SIGN UP: email + username + password -------- */
  const handleSignup = async () => {
    if (!email || !username || !signupPassword) {
      return Alert.alert(
        "Missing info",
        "Please enter email, username and password."
      );
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return Alert.alert("Invalid username", usernameError);
    }

    setLoading(true);
    try {
      const cleanUsername = username.trim().toLowerCase();
      const cleanEmail = email.trim().toLowerCase();

      // 1) Check if username exists
      const { data: existing, error: checkErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (checkErr && (checkErr as any).code !== "PGRST116") {
        throw checkErr;
      }
      if (existing) {
        return Alert.alert(
          "Username taken",
          "That username is already in use. Please choose another one."
        );
      }

      // 2) Create auth user
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password: signupPassword,
      });
      if (signUpErr) throw signUpErr;

      const newUser = data.user;
      if (!newUser) {
        // This would only really happen if email confirmation is on
        Alert.alert(
          "Sign up",
          "Account created. Please check your email to confirm."
        );
        return;
      }

      // 3) Create / upsert profile row with onboarded = false
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          id: newUser.id,
          email: cleanEmail,
          username: cleanUsername,
          display_name: cleanUsername,
          onboarded: false, // 🔑 used by Profile screen to force first-time setup
        },
        { onConflict: "id" }
      );

      if (profileErr) throw profileErr;

      // 4) New account → go STRAIGHT to Profile tab for onboarding
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      Alert.alert("Sign up failed", e?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = mode === "login" ? handleLogin : handleSignup;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {/* App title / welcome */}
        <Text style={[styles.title, { color: colors.text }]}>
          Welcome to FitSocial
        </Text>

        {/* Mode toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => toggleMode("login")}
            style={[
              styles.modeBtn,
              mode === "login" && {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.modeText,
                {
                  color:
                    mode === "login" ? colors.bg : colors.textMuted,
                },
              ]}
            >
              Log in
            </Text>
          </Pressable>

          <Pressable
            onPress={() => toggleMode("signup")}
            style={[
              styles.modeBtn,
              mode === "signup" && {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.modeText,
                {
                  color:
                    mode === "signup" ? colors.bg : colors.textMuted,
                },
              ]}
            >
              Create account
            </Text>
          </Pressable>
        </View>

        {mode === "login" ? (
          <>
            {/* LOGIN FORM */}
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Email or username"
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                },
              ]}
            />

            <View className="" style={styles.passwordRow}>
              <TextInput
                value={loginPassword}
                onChangeText={setLoginPassword}
                placeholder="Password"
                secureTextEntry={!showPassword}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={[
                  styles.input,
                  styles.passwordInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
                  },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <SafeLinearGradient style={styles.primaryGrad}>
              <Pressable
                style={styles.button}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Log in</Text>
                )}
              </Pressable>
            </SafeLinearGradient>
          </>
        ) : (
          <>
            {/* SIGN UP FORM */}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                },
              ]}
            />

            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username (letters & numbers only)"
              autoCapitalize="none"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.bg,
                },
              ]}
            />

            <View style={styles.passwordRow}>
              <TextInput
                value={signupPassword}
                onChangeText={setSignupPassword}
                placeholder="Password"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.input,
                  styles.passwordInput,
                  {
                    color: colors.text,
                    borderColor: colors.border,
                    backgroundColor: colors.bg,
                  },
                ]}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <SafeLinearGradient style={styles.primaryGrad}>
              <Pressable
                style={styles.button}
                onPress={handleSignup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create account</Text>
                )}
              </Pressable>
            </SafeLinearGradient>
          </>
        )}
      </View>
    </View>
  );
}

/* ---------- Styles ---------- */
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: spacing.lg },
    card: {
      borderRadius: 20,
      padding: spacing.lg,
      borderWidth: 1,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      marginBottom: 16,
      textAlign: "center",
    },
    modeToggle: {
      flexDirection: "row",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      overflow: "hidden",
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    modeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    input: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      marginBottom: 10,
    },
    passwordRow: {
      position: "relative",
      marginBottom: 10,
    },
    passwordInput: {
      paddingRight: 40, // space for the eye icon
    },
    eyeBtn: {
      position: "absolute",
      right: 14,
      top: 10,
      height: 30,
      justifyContent: "center",
      alignItems: "center",
    },
    primaryGrad: {
      borderRadius: 999,
      overflow: "hidden",
      marginTop: 4,
    },
    button: {
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
  });
}
