// app/tracker.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapView, {
  Polyline,
  PROVIDER_GOOGLE,
  Region,
  LatLng,
} from "react-native-maps";
import * as Location from "expo-location";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import { useApp } from "@/context/AppContext";
import type { Run } from "@/context/AppContext";

type TrackerStatus = "idle" | "running" | "paused";

export default function TrackerScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { setRuns } = useApp();

  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [initialRegion, setInitialRegion] = useState<Region | undefined>();
  const [isRequestingPerms, setIsRequestingPerms] = useState(false);

  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasRoute = routeCoords.length > 1;

  const distanceKm = distanceMeters / 1000;
  const paceMinPerKm = distanceKm > 0 ? elapsedSec / 60 / distanceKm : 0;

  const formattedTime = useMemo(() => formatTime(elapsedSec), [elapsedSec]);
  const formattedDistance = distanceKm.toFixed(2);
  const formattedPace = distanceKm > 0 ? formatPace(paceMinPerKm) : "--:--";

  // ---- helpers ----
  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopLocationUpdates = async () => {
    if (watchSubRef.current) {
      watchSubRef.current.remove();
      watchSubRef.current = null;
    }
  };

  const resetSession = () => {
    setStatus("idle");
    setRouteCoords([]);
    setElapsedSec(0);
    setDistanceMeters(0);
    setInitialRegion(undefined);
  };

  // ---- Start / Pause / Resume / Stop ----

  const requestLocationPermission = useCallback(async () => {
    setIsRequestingPerms(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Location permission is required to track your run."
        );
        return false;
      }
      return true;
    } finally {
      setIsRequestingPerms(false);
    }
  }, []);

  const startTimer = () => {
    clearTimer();
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
  };

  const startRun = async () => {
    const ok = await requestLocationPermission();
    if (!ok) return;

    // Get initial position
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const firstCoord: LatLng = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };

    setRouteCoords([firstCoord]);
    setInitialRegion({
      latitude: firstCoord.latitude,
      longitude: firstCoord.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    // Start watching position
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 3, // meters between updates
      },
      (loc) => {
        const coord: LatLng = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setRouteCoords((prev) => {
          if (prev.length === 0) return [coord];
          const last = prev[prev.length - 1];
          const increment = haversineMeters(last, coord);
          if (increment > 0) {
            setDistanceMeters((d) => d + increment);
          }
          return [...prev, coord];
        });
      }
    );

    watchSubRef.current = sub;
    setStatus("running");
    startTimer();
  };

  const pauseRun = async () => {
    await stopLocationUpdates();
    clearTimer();
    setStatus("paused");
  };

  const resumeRun = async () => {
    const ok = await requestLocationPermission();
    if (!ok) return;

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 3,
      },
      (loc) => {
        const coord: LatLng = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setRouteCoords((prev) => {
          if (prev.length === 0) return [coord];
          const last = prev[prev.length - 1];
          const increment = haversineMeters(last, coord);
          if (increment > 0) {
            setDistanceMeters((d) => d + increment);
          }
          return [...prev, coord];
        });
      }
    );

    watchSubRef.current = sub;
    setStatus("running");
    startTimer();
  };

  const stopRun = async () => {
    if (status === "idle") {
      resetSession();
      return;
    }

    await stopLocationUpdates();
    clearTimer();

    if (!hasRoute || distanceMeters < 10) {
      Alert.alert(
        "Run too short",
        "We need a bit more distance to save this run."
      );
      resetSession();
      return;
    }

    const distanceKm = distanceMeters / 1000;
    const pace = distanceKm > 0 ? elapsedSec / 60 / distanceKm : 0;
    const summary = `Distance: ${distanceKm.toFixed(
      2
    )} km\nTime: ${formattedTime}\nPace: ${
      distanceKm > 0 ? formatPace(pace) : "--:--"
    } /km`;

    Alert.alert("Save this run?", summary, [
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          resetSession();
        },
      },
      {
        text: "Save",
        style: "default",
        onPress: () => {
          const newRun: Run = {
            id: String(Date.now()),
            dateISO: new Date().toISOString(),
            distanceMeters,
            durationSec: elapsedSec,
          };
          setRuns((prev) => [newRun, ...prev]);

          const coordsJson = JSON.stringify(routeCoords);

          resetSession();

          // 👇 Cast as any so Expo Router TS stops complaining
          router.push({
            pathname: "/run-summary",
            params: {
              distanceMeters: String(distanceMeters),
              durationSec: String(elapsedSec),
              coords: coordsJson,
            },
          } as any);
        },
      },
    ]);
  };

  // ---- cleanup on unmount ----
  useEffect(() => {
    return () => {
      stopLocationUpdates();
      clearTimer();
    };
  }, []);

  // ---- Map region fallback ----
  const mapRegion: Region | undefined = useMemo(() => {
    if (initialRegion) return initialRegion;
    return undefined;
  }, [initialRegion]);

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
        <Text style={styles.headerTitle}>Live Jogging Tracker</Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={mapRegion}
            region={mapRegion}
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
          <View style={styles.mapPlaceholder}>
            {isRequestingPerms ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="map" size={32} color={colors.textMuted} />
                <Text style={styles.mapPlaceholderText}>
                  Start a run to see your route.
                </Text>
              </>
            )}
          </View>
        )}
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

      {/* Controls */}
      <View style={styles.controls}>
        {status === "idle" && (
          <SafeLinearGradient style={styles.mainCtaGrad}>
            <Pressable
              style={styles.mainCtaBtn}
              onPress={startRun}
              disabled={isRequestingPerms}
            >
              {isRequestingPerms ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name="play"
                    size={20}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.mainCtaText}>Start Run</Text>
                </>
              )}
            </Pressable>
          </SafeLinearGradient>
        )}

        {status === "running" && (
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.secondaryBtn, { flex: 1 }]}
              onPress={pauseRun}
            >
              <Ionicons
                name="pause"
                size={18}
                color={colors.text}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.secondaryBtnText}>Pause</Text>
            </Pressable>

            <Pressable
              style={[styles.stopBtn, { flex: 1 }]}
              onPress={stopRun}
            >
              <Ionicons
                name="square"
                size={18}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.stopBtnText}>Stop</Text>
            </Pressable>
          </View>
        )}

        {status === "paused" && (
          <View style={styles.controlsRow}>
            <SafeLinearGradient style={[styles.mainCtaGrad, { flex: 1 }]}>
              <Pressable style={styles.mainCtaBtn} onPress={resumeRun}>
                <Ionicons
                  name="play"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.mainCtaText}>Resume</Text>
              </Pressable>
            </SafeLinearGradient>

            <Pressable
              style={[styles.stopBtn, { flex: 1 }]}
              onPress={stopRun}
            >
              <Ionicons
                name="square"
                size={18}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.stopBtnText}>Stop</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

// ---- helpers ----
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

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000; // meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const c =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return R * d;
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

    mapContainer: {
      marginHorizontal: spacing.lg,
      borderRadius: 18,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      height: 260,
      backgroundColor: colors.card,
    },
    mapPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    mapPlaceholderText: {
      color: colors.textMuted,
      fontSize: 13,
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

    controls: {
      marginTop: spacing.xl,
      marginHorizontal: spacing.lg,
    },
    controlsRow: {
      flexDirection: "row",
      gap: 12,
    },

    mainCtaGrad: {
      borderRadius: 999,
      overflow: "hidden",
    },
    mainCtaBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 999,
    },
    mainCtaText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 16,
    },

    secondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 14,
    },

    stopBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: "#ef4444",
    },
    stopBtnText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 14,
    },
  });
}
