// app/index.tsx
import React, { useEffect, useState } from "react";
import { View, StyleSheet, Image, StatusBar } from "react-native";
import { useRouter } from "expo-router";

import { useColors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";

export default function Index() {
  const router = useRouter();
  const colors = useColors();

  const [showSplash, setShowSplash] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // 3-second splash timer
  useEffect(() => {
    const timeout = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timeout);
  }, []);

  // Supabase session check
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setHasSession(!!data.session);
      } catch (e) {
        console.warn("Failed to check Supabase session", e);
        setHasSession(null);
      } finally {
        setCheckingSession(false);
      }
    })();
  }, []);

  // When both splash + session check are done, route correctly
  useEffect(() => {
    if (showSplash || checkingSession || hasSession === null) return;

    if (hasSession) {
      // ✅ logged in → into tabs root
      router.replace("/");
    } else {
      // 🚪 not logged in → auth flow
      router.replace("/auth");
    }
  }, [showSplash, checkingSession, hasSession, router]);

  // While splash / session check are active, show the PNG fullscreen
  if (showSplash || checkingSession) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar hidden={false} barStyle="light-content" />
        <Image
          source={require("../assets/images/fitsocial-splash.png")}
          resizeMode="cover"
          style={styles.image}
        />
      </View>
    );
  }

  // Once navigation happens this screen never actually renders anything
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
