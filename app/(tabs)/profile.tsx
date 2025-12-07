// app/(tabs)/profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useApp } from "@/context/AppContext";
import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import EditProfileModal from "@/components/EditProfileModal";
import PostCard, { type Post } from "@/components/PostCard";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// grid sizes for media thumbnails
const SCREEN_W = Dimensions.get("window").width;
const GRID_GAP = 2;
const GRID_COLS = 3;
const H_PADDING = 16;
const CELL_W = Math.floor(
  (SCREEN_W - H_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
);

type MediaItem = { type: "image" | "video"; uri: string };

/** Shape of the row in Supabase `profiles` table (we only use some fields). */
type RemoteProfile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  link: string | null;
  onboarded: boolean | null;
};

// 🔹 Static default avatar — used for EVERYONE unless they have a real custom URL
const DEFAULT_AVATAR = require("../../assets/images/default-avatar.jpg");

export default function ProfileScreen() {
  const { user, runs, updateUser, appendWeightEntry } = useApp();
  const { user: authUser } = useAuth(); // just to know which Supabase profile to load
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [editOpen, setEditOpen] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [remoteProfile, setRemoteProfile] = useState<RemoteProfile | null>(
    null
  );
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasAutoOpened, setHasAutoOpened] = useState(false); // to avoid weird loops

  // Totals
  const totalMeters = runs.reduce((s, r) => s + (r?.distanceMeters ?? 0), 0);
  const totalSec = runs.reduce((s, r) => s + (r?.durationSec ?? 0), 0);
  const kmRan = Math.round((totalMeters / 1000) * 10) / 10;
  const kcalBurned = Math.round(totalSec * 0.12);

  // Avg pace
  const avgPace = (() => {
    if (!totalMeters || totalMeters < 100) return "—";
    const secPerKm = totalSec / (totalMeters / 1000);
    const m = Math.floor(secPerKm / 60);
    const s = Math.round(secPerKm % 60);
    return `${m}:${String(s).padStart(2, "0")} /km`;
  })();

  // BMI
  const bmi = (() => {
    const h = (user?.height ?? 0) / 100;
    if (!h || !user?.weight) return undefined;
    return Math.round((user.weight / (h * h)) * 10) / 10;
  })();

  /* 1) Load this Supabase user's profile (to get `onboarded`, avatar, etc.) */
  useEffect(() => {
    if (!authUser) {
      setRemoteProfile(null);
      setProfileLoading(false);
      return;
    }

    let isCancelled = false;

    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select(
            "id, email, username, display_name, avatar_url, bio, link, onboarded"
          )
          .eq("id", authUser.id)
          .maybeSingle();

        if (error && (error as any).code !== "PGRST116") {
          console.log("Error loading remote profile", error);
        }

        if (!isCancelled) {
          setRemoteProfile((data as RemoteProfile) ?? null);
        }
      } catch (e) {
        if (!isCancelled) {
          console.log("Error loading remote profile", e);
          setRemoteProfile(null);
        }
      } finally {
        if (!isCancelled) {
          setProfileLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      isCancelled = true;
    };
  }, [authUser?.id]);

  /* 2) Load this user's Community posts → media grid + timeline */
  useEffect(() => {
    const loadMyPosts = async () => {
      if (!authUser) {
        setMyPosts([]);
        setMedia([]);
        return;
      }

      setPostsLoading(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("author_id", authUser.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const mapped: Post[] = (data || []).map((row: any) => {
          const firstImage = Array.isArray(row.media_urls)
            ? row.media_urls[0]
            : "";
          return {
            id: row.id,
            uri: firstImage || "",
            caption: row.text ?? "",
            likes: row.likes ?? 0,
            comments: row.comments ?? 0,
            createdAt: row.created_at,
            authorUsername: row.author_username,
            authorDisplayName: row.author_display_name,
            authorAvatarUrl:
              row.author_avatar_url || undefined, // let PostCard handle default if needed
            isLikedByCurrentUser: false,
          };
        });

        setMyPosts(mapped);

        const imgs: MediaItem[] = mapped
          .filter((p) => !!p.uri)
          .map((p) => ({ type: "image" as const, uri: p.uri! }));

        setMedia(imgs);
      } catch (e) {
        console.log("Error loading my posts for profile", e);
        setMyPosts([]);
        setMedia([]);
      } finally {
        setPostsLoading(false);
      }
    };

    loadMyPosts();
  }, [authUser?.id]);

  /* 3) AUTO-OPEN EDIT PROFILE ONLY if not onboarded */
  useEffect(() => {
    if (!authUser) return;
    if (profileLoading) return;
    if (!remoteProfile) return;

    // already marked as onboarded → never auto-open
    if (remoteProfile.onboarded) return;

    // avoid infinite loop: only auto-open once per session
    if (hasAutoOpened) return;

    setHasAutoOpened(true);
    setEditOpen(true);
  }, [authUser, profileLoading, remoteProfile, hasAutoOpened]);

  /* 4) Derive final display values, preferring remoteProfile over local AppContext */

  // Username: internal base value (no placeholder)
  const computedUsername =
    remoteProfile?.username || user?.username || undefined;

  // What we show in UI
  const finalUsername = computedUsername || "username_here";

  const finalDisplayName =
    remoteProfile?.display_name || user?.displayName || "Display name here";

  const finalBio = remoteProfile?.bio || user?.bio || "";

  const finalLink = remoteProfile?.link || user?.link || "";
  const finalLinkLabel = finalLink
    ? finalLink.replace(/^https?:\/\//, "")
    : "Add a link";

  // Avatar: only use a custom URL if it is a non-empty string.
  const rawAvatarFromRemote = remoteProfile?.avatar_url ?? "";
  const rawAvatarFromLocal = user?.avatarUrl ?? "";
  const mergedRawAvatar = (rawAvatarFromRemote || rawAvatarFromLocal).trim();
  const hasCustomAvatar = mergedRawAvatar.length > 0;

  const avatarSrc = hasCustomAvatar
    ? { uri: mergedRawAvatar }
    : DEFAULT_AVATAR;

  // Location + tagline (ZA/PROVINCE • tagline)
  const finalLocation = user?.location || "ZA/—";
  const finalTagline = user?.tagline || "YNWA";

  /* 4b) SELF-HEAL username in AppContext (Option A) */
  useEffect(() => {
    // Only repair when we have a real username from Supabase/local
    // and AppContext currently has nothing.
    if (computedUsername && !user?.username) {
      updateUser({ username: computedUsername });
    }
  }, [computedUsername, user?.username, updateUser]);

  /* 5) Handle save from EditProfileModal:
        - Update local AppContext
        - Update Supabase `profiles`
        - Mark onboarded = true (if not already)
  */
  const handleProfileSaved = async (patch: Partial<{
    displayName?: string;
    bio?: string;
    link?: string;
    avatarUrl?: string;
    weight: number;
    height?: number;
    dailyGoal?: number;
    targetWeight?: number;
    location?: string;
    tagline?: string;
  }>) => {
    try {
      // Update local AppContext (weight history etc.)
      if (typeof patch.weight === "number" && patch.weight !== user.weight) {
        await appendWeightEntry(patch.weight);
      }
      await updateUser(patch);

      // Update remote Supabase profile (if logged in)
      if (authUser) {
        const updates: any = {};
        if (patch.displayName !== undefined) {
          updates.display_name = patch.displayName;
        }
        if (patch.bio !== undefined) {
          updates.bio = patch.bio;
        }
        if (patch.link !== undefined) {
          updates.link = patch.link;
        }
        if (patch.avatarUrl !== undefined) {
          updates.avatar_url = patch.avatarUrl;
        }

        // IMPORTANT: mark onboarded = true the first time they save
        if (!remoteProfile?.onboarded) {
          updates.onboarded = true;
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", authUser.id);

          if (error) {
            console.log("Error updating remote profile", error);
            Alert.alert(
              "Profile",
              "Your profile was updated locally, but saving to the server failed. Try again later."
            );
          } else {
            // Sync remoteProfile in state so we don't auto-open again
            setRemoteProfile((prev) =>
              prev
                ? {
                    ...prev,
                    display_name:
                      updates.display_name ?? prev.display_name,
                    bio: updates.bio ?? prev.bio,
                    link: updates.link ?? prev.link,
                    avatar_url: updates.avatar_url ?? prev.avatar_url,
                    onboarded:
                      updates.onboarded !== undefined
                        ? updates.onboarded
                        : prev.onboarded,
                  }
                : prev
            );
          }
        }
      }
    } catch (e) {
      console.log("Error in handleProfileSaved", e);
    }
  };

  // While remote profile is loading (first time hitting Profile)
  if (profileLoading && !remoteProfile) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // LOGGED-IN PROFILE VIEW (no login/auth redirect here)
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 24,
        }}
      >
        {/* Top bar */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            style={{
              color: colors.text,
              fontSize: 28,
              fontWeight: "900",
              flex: 1,
            }}
          >
            Profile
          </Text>
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ borderRadius: 999, padding: 3 }}>
            <SafeLinearGradient style={{ borderRadius: 999, padding: 3 }}>
              <Image
                source={avatarSrc}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 999,
                  backgroundColor: colors.card,
                }}
              />
            </SafeLinearGradient>
          </View>

          <View style={{ flex: 1 }}>
            {/* Name block: Display name on top, @username below */}
            <View style={styles.nameBlock}>
              <Text style={styles.displayName}>{finalDisplayName}</Text>

              <View style={styles.usernameRow}>
                <Text style={styles.username}>@{finalUsername}</Text>
                {user?.verified ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.primary}
                    style={{ marginLeft: 6 }}
                  />
                ) : null}
              </View>
            </View>

            <View style={styles.statsRow}>
              <Stat value={`${kmRan} km`} label="KM Ran" />
              <Dot color={colors.textMuted} />
              <Stat value={kcalBurned} label="Kcal Burned" />
            </View>
          </View>
        </View>

        {/* Bio + link */}
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {finalLocation} • {finalTagline}
          </Text>

          {finalBio ? (
            <Text
              style={[styles.bio, { color: colors.text, marginTop: 8 }]}
            >
              {finalBio}
            </Text>
          ) : (
            <Text
              style={[
                styles.bio,
                { color: colors.textMuted, marginTop: 8 },
              ]}
            >
              Add a short bio to tell people who you are.
            </Text>
          )}

          <View style={styles.linkRow}>
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <Pressable>
              <Text style={[styles.link, { color: colors.primary }]}>
                {finalLinkLabel}
              </Text>
            </Pressable>
            <Ionicons
              name="globe-outline"
              size={14}
              color={colors.textMuted}
              style={{ marginLeft: 10 }}
            />
            <Text
              style={[
                styles.meta,
                { color: colors.textMuted, marginLeft: 4 },
              ]}
            >
              {finalUsername}
            </Text>
          </View>
        </View>

        {/* Edit button */}
        <View style={{ marginTop: 12 }}>
          <SafeLinearGradient style={styles.editBtnGrad}>
            <Pressable
              onPress={() => setEditOpen(true)}
              style={styles.editBtnPress}
            >
              <Text style={styles.editBtnText}>Edit profile</Text>
            </Pressable>
          </SafeLinearGradient>
        </View>

        {/* Biometrics + Goals (right-aligned) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Biometrics</Text>

            <View style={styles.goalsStrip}>
              <GoalStat
                label="Goal Weight"
                value={
                  user?.targetWeight ? `${user.targetWeight} kg` : "—"
                }
              />
              <Separator />
              <GoalStat label="Total KM" value={`${kmRan} km`} />
            </View>
          </View>

          <Row
            label="Weight"
            value={user?.weight ? `${user.weight} kg` : "—"}
          />
          <Row
            label="Height"
            value={user?.height ? `${user.height} cm` : "—"}
          />
          <Row label="BMI" value={bmi ? String(bmi) : "—"} />
          <Row label="Avg Pace" value={avgPace} />
        </View>
        
        {/* Timeline of my posts */}
        {myPosts.length > 0 && (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={[styles.cardTitle, { marginBottom: 4 }]}>
              Timeline
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Your recent posts in the Community Hub.
            </Text>

            <View style={{ marginTop: 8 }}>
              {myPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  // Read-only here for now – chips show counts but do nothing
                  onLike={() => {}}
                  onComment={() => {}}
                  showMenu={false}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <EditProfileModal
        visible={editOpen}
        user={{
          displayName: finalDisplayName,
          bio: finalBio,
          link: finalLink,
          avatarUrl: hasCustomAvatar ? mergedRawAvatar : undefined,
          weight: user?.weight ?? 0,
          height: user?.height,
          dailyGoal: user?.dailyGoal,
          targetWeight: user?.targetWeight,
          location: user?.location,
          tagline: user?.tagline,
        }}
        onClose={() => setEditOpen(false)}
        onSaved={handleProfileSaved}
      />
    </>
  );
}

/* — Helpers — */
function Stat({ value, label }: { value: string | number; label: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={{ color: colors.text, fontWeight: "800" }}>{value} </Text>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        marginHorizontal: 10,
      }}
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: colors.textMuted, width: 110 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function GoalStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 10,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: colors.text,
          fontWeight: "800",
          fontSize: 12,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Separator() {
  const colors = useColors();
  return (
    <View
      style={{
        width: 1,
        height: 24,
        backgroundColor: colors.border,
        marginLeft: 12,
        marginRight: 0,
      }}
    />
  );
}

/* — Styles — */
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    headerRow: {
      marginTop: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },

    // name block (display name + @username)
    nameBlock: {
      alignItems: "flex-start",
      justifyContent: "center",
      marginBottom: 4,
    },
    displayName: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.text,
      textAlign: "left",
    },
    usernameRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 2,
    },
    username: {
      fontSize: 15, // ~1/3 smaller than 22
      color: colors.textMuted,
      textAlign: "left",
    },

    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },
    meta: { fontSize: 12 },
    bio: { fontSize: 13, lineHeight: 18 },
    linkRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
    link: { fontSize: 12, textDecorationLine: "underline", marginLeft: 6 },

    editBtnGrad: { borderRadius: 10, overflow: "hidden", height: 38 },
    editBtnPress: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    editBtnText: { color: "#fff", fontWeight: "800" },

    card: {
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: spacing.lg,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },

    goalsStrip: {
      marginLeft: "auto",
      flexDirection: "row",
      alignItems: "center",
    },

    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GRID_GAP,
      marginTop: 2,
    },
    cell: {
      width: CELL_W,
      aspectRatio: 1,
      borderRadius: 8,
      backgroundColor: colors.card,
    },
  });
}
