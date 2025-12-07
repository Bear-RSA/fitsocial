// app/run-summary.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ImageBackground,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, {
  Polyline,
  PROVIDER_GOOGLE,
  Region,
  LatLng,
} from "react-native-maps";
import ViewShot from "react-native-view-shot";
import * as ImagePicker from "expo-image-picker";
import Svg, { Path, Rect } from "react-native-svg";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";

type Mode = "map" | "photo";

export default function RunSummaryScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useApp();

  const distanceMeters = Number(params.distanceMeters ?? 0);
  const durationSec = Number(params.durationSec ?? 0);

  let routeCoords: LatLng[] = [];
  try {
    if (typeof params.coords === "string") {
      routeCoords = JSON.parse(params.coords) as LatLng[];
    }
  } catch {
    routeCoords = [];
  }

  const distanceKm = distanceMeters / 1000;
  const paceMinPerKm = distanceKm > 0 ? durationSec / 60 / distanceKm : 0;

  const formattedTime = formatTime(durationSec);
  const formattedDistance = distanceKm.toFixed(2);
  const formattedPace = distanceKm > 0 ? formatPace(paceMinPerKm) : "--:--";

  const [mode, setMode] = useState<Mode>("map");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const viewShotRef = useRef<ViewShot | null>(null);

  const hasRoute = routeCoords.length > 1;

  const region: Region | undefined = useMemo(() => {
    if (!routeCoords.length) return undefined;
    return computeRegionFromCoords(routeCoords);
  }, [routeCoords]);

  const pickPhoto = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow photo access to use your own background."
      );
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
    });

    if (!res.canceled && res.assets && res.assets[0]?.uri) {
      setPhotoUri(res.assets[0].uri);
      setMode("photo");
    }
  };

  const generateImage = async () => {
    if (!viewShotRef.current) return;

    setIsGenerating(true);
    try {
      // 1) Capture PNG from ViewShot
      await new Promise((resolve) => setTimeout(resolve, 150));
      const localUri = await viewShotRef.current.capture?.();
      if (!localUri) {
        throw new Error("No image captured");
      }

      // 2) Convert to blob
      const res = await fetch(localUri);
      const blob = await res.blob();

      // 3) Upload to Supabase Storage (run_cards bucket)
      const ext = "png";
      const username = user?.username || "runner";
      const filePath = `${username}/${Date.now()}_run_card.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("run_cards")
        .upload(filePath, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;
      if (!uploadData?.path) {
        throw new Error("Upload did not return a path");
      }

      const { data: publicData } = supabase.storage
        .from("run_cards")
        .getPublicUrl(uploadData.path);

      const publicUrl = publicData.publicUrl;

      setIsGenerating(false);

      const caption = `Just finished a run · ${formattedDistance} km in ${formattedTime} · ${formattedPace}/km`;

      // 4) Ask whether to share to Community
      Alert.alert(
        "Run card ready",
        "Your run card was saved.\nShare it to the Community feed?",
        [
          {
            text: "Not now",
            style: "cancel",
          },
          {
            text: "Share",
            onPress: () => {
              (async () => {
                try {
                  const insertPayload = {
                    author_id: null, // optional for now
                    author_username: user?.username ?? "anon",
                    author_display_name: user?.displayName ?? null,
                    author_avatar_url: user?.avatarUrl ?? null,
                    text: caption,
                    media_urls: [publicUrl],
                  };

                  const { error: postError } = await supabase
                    .from("posts")
                    .insert(insertPayload);

                  if (postError) throw postError;

                  Alert.alert(
                    "Shared",
                    "Your run was posted to the Community feed."
                  );
                } catch (e: any) {
                  Alert.alert(
                    "Share failed",
                    e?.message ?? "Could not share this run."
                  );
                }
              })();
            },
          },
        ]
      );
    } catch (e: any) {
      setIsGenerating(false);
      Alert.alert(
        "Could not create image",
        e?.message ??
          "Something went wrong while creating or uploading the card."
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Run Summary</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{formattedTime}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>
            {formattedDistance} <Text style={styles.statUnit}>km</Text>
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Pace</Text>
          <Text style={styles.statValue}>
            {formattedPace} <Text style={styles.statUnit}>/km</Text>
          </Text>
        </View>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        <Pressable
          style={[
            styles.modeChip,
            mode === "map" && styles.modeChipActive,
          ]}
          onPress={() => setMode("map")}
        >
          <Ionicons
            name="map"
            size={16}
            color={mode === "map" ? "#fff" : colors.text}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.modeChipText,
              mode === "map" && styles.modeChipTextActive,
            ]}
          >
            Map Background
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.modeChip,
            mode === "photo" && styles.modeChipActive,
          ]}
          onPress={pickPhoto}
        >
          <Ionicons
            name="image"
            size={16}
            color={mode === "photo" ? "#fff" : colors.text}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.modeChipText,
              mode === "photo" && styles.modeChipTextActive,
            ]}
          >
            Use My Photo
          </Text>
        </Pressable>
      </View>

      {/* Preview Card (ViewShot target) */}
      <ViewShot
        ref={viewShotRef}
        options={{ format: "png", quality: 1, result: "tmpfile" }}
        style={styles.cardWrapper}
      >
        <View style={styles.card}>
          {/* Top strip / brand */}
          <SafeLinearGradient style={styles.brandBar}>
            <Text style={styles.brandText}>FITSOCIAL</Text>
          </SafeLinearGradient>

          {/* Main visual */}
          <View style={styles.visual}>
            {mode === "photo" && photoUri ? (
              <ImageBackground
                source={{ uri: photoUri }}
                style={styles.visual}
                resizeMode="cover"
              >
                <RouteOverlaySvg coords={routeCoords} />
              </ImageBackground>
            ) : (
              <View style={styles.visual}>
                {region ? (
                  <MapView
                    style={StyleSheet.absoluteFill}
                    provider={PROVIDER_GOOGLE}
                    initialRegion={region}
                  >
                    {hasRoute && (
                      <Polyline
                        coordinates={routeCoords}
                        strokeWidth={5}
                        strokeColor={colors.accentGradient[1]}
                      />
                    )}
                  </MapView>
                ) : (
                  <View style={styles.visualPlaceholder}>
                    <Ionicons
                      name="map"
                      size={24}
                      color={colors.textMuted}
                    />
                    <Text style={styles.visualPlaceholderText}>
                      Route will appear here
                    </Text>
                  </View>
                )}
                {/* Extra SVG overlay on top of map for stronger line */}
                <RouteOverlaySvg coords={routeCoords} />
              </View>
            )}
          </View>

          {/* Bottom stats in card */}
          <View style={styles.cardStatsRow}>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Time</Text>
              <Text style={styles.cardStatValue}>{formattedTime}</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Distance</Text>
              <Text style={styles.cardStatValue}>{formattedDistance} km</Text>
            </View>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatLabel}>Pace</Text>
              <Text style={styles.cardStatValue}>{formattedPace} /km</Text>
            </View>
          </View>
        </View>
      </ViewShot>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.replace("/(tabs)/home")}
        >
          <Text style={styles.secondaryText}>Done</Text>
        </Pressable>

        <SafeLinearGradient style={styles.primaryGrad}>
          <Pressable
            style={styles.primaryBtn}
            onPress={generateImage}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="download"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryText}>
                  Generate & Share Card
                </Text>
              </>
            )}
          </Pressable>
        </SafeLinearGradient>
      </View>
    </View>
  );
}

/* ---------- SVG Overlay ---------- */
function RouteOverlaySvg({ coords }: { coords: LatLng[] }) {
  if (!coords || coords.length < 2) {
    return (
      <Svg style={{ position: "absolute", inset: 0 }}>
        <Rect x={0} y={0} width="100%" height="100%" fill="transparent" />
      </Svg>
    );
  }

  const { pathData } = buildSvgPath(coords);

  return (
    <Svg style={{ position: "absolute", inset: 0 }}>
      <Path
        d={pathData}
        stroke="#ec4899"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function buildSvgPath(coords: LatLng[]) {
  // Normalize lat/lng into 0..1 box then scale up to SVG 100x100
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
  }

  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;

  const padding = 8; // px inside the SVG area
  const size = 100 - padding * 2;

  const points = coords.map((c) => {
    const normX = (c.longitude - minLng) / lngRange;
    const normY = (c.latitude - minLat) / latRange;

    // invert Y so north is up
    const x = padding + normX * size;
    const y = padding + (1 - normY) * size;

    return { x, y };
  });

  const pathData = points
    .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return { pathData };
}

function formatTime(totalSec: number) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const hh = h.toString().padStart(2, "0");
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatPace(minPerKm: number) {
  const totalSec = minPerKm * 60;
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function computeRegionFromCoords(coords: LatLng[]): Region {
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latDelta = Math.max(maxLat - minLat, 0.01) * 1.4;
  const lngDelta = Math.max(maxLng - minLng, 0.01) * 1.4;

  return {
    latitude,
    longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

/* ---------- Styles ---------- */
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingTop: 50,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      marginBottom: 12,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },

    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.lg,
      marginHorizontal: spacing.lg,
      gap: 10,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 4,
    },
    statValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    statUnit: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "500",
    },

    modeRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      marginTop: spacing.lg,
      marginHorizontal: spacing.lg,
    },
    modeChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modeChipActive: {
      backgroundColor: colors.accentGradient[1],
      borderColor: colors.accentGradient[1],
    },
    modeChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
    },
    modeChipTextActive: {
      color: "#fff",
    },

    cardWrapper: {
      marginTop: spacing.lg,
      marginHorizontal: spacing.lg,
      borderRadius: 24,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    card: {
      padding: 16,
      backgroundColor: colors.bg,
    },
    brandBar: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 18,
      alignSelf: "center",
      marginBottom: 12,
    },
    brandText: {
      color: "#0b1120",
      fontWeight: "900",
      letterSpacing: 3,
      fontSize: 14,
    },
    visual: {
      width: "100%",
      height: 260,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    visualPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    visualPlaceholderText: {
      color: colors.textMuted,
      fontSize: 12,
    },

    cardStatsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 14,
    },
    cardStat: {
      flex: 1,
      alignItems: "center",
    },
    cardStatLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 3,
    },
    cardStatValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },

    actions: {
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
      flexDirection: "row",
      gap: 12,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    primaryGrad: {
      flex: 1,
      borderRadius: 999,
      overflow: "hidden",
    },
    primaryBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
    },
    primaryText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
  });
}
