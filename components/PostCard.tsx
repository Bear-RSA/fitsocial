// components/PostCard.tsx
import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";

/* Public type used by Community/Profile screens */
export type Post = {
  id: string;

  // media (optional for text-only posts)
  uri?: string;

  // text (optional if it's just a photo post)
  caption?: string;

  // meta
  likes: number;
  comments: number;
  createdAt: string; // ISO

  // author info (required to show header)
  authorUsername: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;

  // like state for current user
  isLikedByCurrentUser?: boolean;
};

type Props = {
  post: Post;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onPressAuthor?: (username: string) => void;

  /** If true, show the 3-dots menu icon (for the owner’s posts). */
  showMenu?: boolean;
};

export default function PostCard({
  post,
  onLike,
  onComment,
  onPressAuthor,
  showMenu = false,
}: Props) {
  const colors = useColors();
  const s = makeStyles(colors);

  const displayName = post.authorDisplayName || post.authorUsername;
  const avatar =
    post.authorAvatarUrl ||
    `https://i.pravatar.cc/120?u=${encodeURIComponent(post.authorUsername)}`;
  const dateLabel = new Date(post.createdAt).toLocaleDateString();

  const heartName = post.isLikedByCurrentUser ? "heart" : "heart-outline";
  const heartColor = post.isLikedByCurrentUser ? "#ef4444" : colors.textMuted;

  return (
    <View style={s.card}>
      {/* Author header */}
      <Pressable
        style={s.headerRow}
        onPress={() => onPressAuthor?.(post.authorUsername)}
        android_ripple={{ color: "#00000010" }}
      >
        <Image source={{ uri: avatar }} style={s.headerAvatar} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.headerName}>
            {displayName}
          </Text>
          <Text numberOfLines={1} style={s.headerMeta}>
            @{post.authorUsername} · {dateLabel}
          </Text>
        </View>

        {/* 3-dots only on the owner’s posts */}
        {showMenu && (
          <Ionicons
            name="ellipsis-horizontal"
            size={18}
            color={colors.textMuted}
          />
        )}
      </Pressable>

      {/* Media (if any) */}
      {post.uri ? (
        <Image
          source={{ uri: post.uri }}
          style={s.image}
          resizeMode="contain"
        />
      ) : null}

      {/* Caption (if any) */}
      {post.caption ? <Text style={s.caption}>{post.caption}</Text> : null}

      {/* Actions */}
      <View style={s.row}>
        <Pressable style={s.chip} onPress={() => onLike(post.id)}>
          <Ionicons name={heartName} size={16} color={heartColor} />
          <Text style={s.chipText}>{post.likes}</Text>
        </Pressable>
        <Pressable style={s.chip} onPress={() => onComment(post.id)}>
          <Ionicons
            name="chatbubble-ellipses"
            size={16}
            color={colors.textMuted}
          />
          <Text style={s.chipText}>{post.comments}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: "hidden",
      marginBottom: 12,
    },

    /* Header */
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerAvatar: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: colors.bg,
    },
    headerName: { color: colors.text, fontWeight: "800", fontSize: 13 },
    headerMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

    /* Media */
    image: {
      width: "100%",
      // Show the full image without cropping, with a nice, tall card
      aspectRatio: 4 / 5,
      backgroundColor: colors.bg,
    },

    /* Body */
    caption: {
      color: colors.text,
      fontSize: 14,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 4,
    },

    /* Footer */
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 6,
    },
    chip: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
    },
    chipText: { color: colors.text, fontWeight: "700" },
  });
