// app/user/[username].tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import SafeLinearGradient from "@/components/SafeLinearGradient";

type RemoteProfile = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  link: string | null;
};

type AllianceRow = {
  id: string;
  follower_id: string;
  follower_username: string;
  followed_id: string;
  followed_username: string;
};

const DEFAULT_AVATAR = require("../../assets/images/default-avatar.jpg");

export default function UserProfileScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username?: string }>();
  const { user: appUser } = useApp();
  const { user: authUser } = useAuth();

  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [iFollowThem, setIFollowThem] = useState(false);
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const [allyLoading, setAllyLoading] = useState(false);

  const isMe =
    appUser?.username &&
    username &&
    appUser.username.toLowerCase() === username.toLowerCase();

  /* Load target user's profile */
  const loadProfile = useCallback(async () => {
    if (!username) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, username, display_name, avatar_url, bio, link")
        .eq("username", username)
        .maybeSingle();

      if (error) throw error;
      setProfile((data as RemoteProfile) ?? null);
    } catch (e: any) {
      console.warn("loadProfile error", e?.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  /* Load alliances between current user and this user */
  const loadAllianceState = useCallback(async () => {
    if (!authUser || !profile) {
      setIFollowThem(false);
      setTheyFollowMe(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("alliances")
        .select(
          "id, follower_id, follower_username, followed_id, followed_username"
        )
        .or(
          `and(follower_id.eq.${authUser.id},followed_id.eq.${profile.id}),and(follower_id.eq.${profile.id},followed_id.eq.${authUser.id})`
        );

      if (error) throw error;

      const rows = (data || []) as AllianceRow[];
      const iFollow = rows.some(
        (r) => r.follower_id === authUser.id && r.followed_id === profile.id
      );
      const theyFollow = rows.some(
        (r) => r.follower_id === profile.id && r.followed_id === authUser.id
      );

      setIFollowThem(iFollow);
      setTheyFollowMe(theyFollow);
    } catch (e: any) {
      console.warn("loadAllianceState error", e?.message);
      setIFollowThem(false);
      setTheyFollowMe(false);
    }
  }, [authUser, profile]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile && authUser) {
      loadAllianceState();
    }
  }, [profile, authUser, loadAllianceState]);

  const isMutual = iFollowThem && theyFollowMe;

  const avatarSrc =
    profile?.avatar_url && profile.avatar_url.trim().length > 0
      ? { uri: profile.avatar_url }
      : DEFAULT_AVATAR;

  const finalDisplayName =
    profile?.display_name || profile?.username || "Member";
  const finalUsername = profile?.username || "username";
  const finalBio = profile?.bio || "";
  const finalLink = profile?.link || "";

  /* Handle Add / Remove Ally */
  const handleToggleAlly = async () => {
    if (!authUser || !profile) {
      Alert.alert(
        "Not logged in",
        "Please log in and complete your profile before adding Allies."
      );
      return;
    }

    if (isMe) return;

    if (iFollowThem) {
      // Remove Ally
      Alert.alert("Remove Ally", `Remove @${finalUsername} as an Ally?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setAllyLoading(true);
            try {
              await supabase
                .from("alliances")
                .delete()
                .eq("follower_id", authUser.id)
                .eq("followed_id", profile.id);

              setIFollowThem(false);
            } catch (e: any) {
              console.warn("remove ally failed", e?.message);
              Alert.alert(
                "Ally",
                e?.message ?? "Could not remove Ally. Try again."
              );
            } finally {
              setAllyLoading(false);
            }
          },
        },
      ]);
      return;
    }

    // Add Ally
    setAllyLoading(true);
    try {
      await supabase.from("alliances").insert({
        follower_id: authUser.id,
        follower_username: appUser?.username ?? "",
        followed_id: profile.id,
        followed_username: finalUsername,
      });

      setIFollowThem(true);

      // Create notifications for the other user
      const baseNotification = {
        recipient_id: profile.id,
        from_username: appUser?.username ?? "",
        from_avatar_url: appUser?.avatarUrl ?? null,
      };

      // Always: "ally_follow"
      const inserts: any[] = [
        {
          ...baseNotification,
          type: "ally_follow",
        },
      ];

      // If they already follow me, also: "ally_mutual"
      if (theyFollowMe) {
        inserts.push({
          ...baseNotification,
          type: "ally_mutual",
        });
      }

      if (inserts.length > 0) {
        await supabase.from("notifications").insert(inserts);
      }
    } catch (e: any) {
      console.warn("add ally failed", e?.message);
      Alert.alert(
        "Ally",
        e?.message ?? "Could not add Ally. Please try again."
      );
    } finally {
      setAllyLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.screen, { justifyContent: "center" }]}>
        <Text style={{ color: colors.text }}>
          This member could not be found.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
    >
      {/* Top bar */}
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{ paddingRight: 12, paddingVertical: 4 }}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={colors.textMuted}
          />
        </Pressable>
        <Text
          style={{
            color: colors.text,
            fontSize: 22,
            fontWeight: "900",
            flex: 1,
          }}
        >
          {finalDisplayName}
        </Text>
      </View>

      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ borderRadius: 999, padding: 3 }}>
          <SafeLinearGradient style={{ borderRadius: 999, padding: 3 }}>
            <Image
              source={avatarSrc}
              style={{
                width: 80,
                height: 80,
                borderRadius: 999,
                backgroundColor: colors.card,
              }}
            />
          </SafeLinearGradient>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.displayName}>{finalDisplayName}</Text>
          <Text style={styles.username}>@{finalUsername}</Text>

          {/* Ally button row */}
          {!isMe && (
            <View style={{ marginTop: 10, flexDirection: "row" }}>
              <SafeLinearGradient
                style={[
                  styles.allyBtnGrad,
                  iFollowThem && !isMutual && { opacity: 0.92 },
                  isMutual && { opacity: 0.96 },
                ]}
              >
                <Pressable
                  disabled={allyLoading}
                  onPress={handleToggleAlly}
                  style={styles.allyBtn}
                >
                  {allyLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          isMutual
                            ? "people"
                            : iFollowThem
                            ? "person"
                            : "person-add"
                        }
                        size={16}
                        color="#fff"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.allyBtnText}>
                        {isMutual
                          ? "Mutual Allies"
                          : iFollowThem
                          ? "Allied"
                          : "Add Ally"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </SafeLinearGradient>
            </View>
          )}
        </View>
      </View>

      {/* Bio + link */}
      <View style={{ marginTop: 16 }}>
        {finalBio ? (
          <Text style={styles.bio}>{finalBio}</Text>
        ) : (
          <Text style={[styles.bio, { color: colors.textMuted }]}>
            This member has not added a bio yet.
          </Text>
        )}

        {finalLink ? (
          <View style={styles.linkRow}>
            <Ionicons
              name="link-outline"
              size={14}
              color={colors.primary}
            />
            <Text style={styles.linkText}>
              {finalLink.replace(/^https?:\/\//, "")}
            </Text>
          </View>
        ) : null}
      </View>

      {/* You can later render this user's posts grid / timeline here */}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    displayName: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    username: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
    },
    allyBtnGrad: {
      borderRadius: 999,
      overflow: "hidden",
    },
    allyBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
    },
    allyBtnText: {
      color: "#fff",
      fontWeight: "800",
      fontSize: 13,
    },
    bio: {
      marginTop: 4,
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
    },
    linkText: {
      marginLeft: 6,
      color: colors.primary,
      fontSize: 12,
      textDecorationLine: "underline",
    },
  });
}
