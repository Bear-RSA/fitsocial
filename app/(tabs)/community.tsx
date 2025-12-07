// app/(tabs)/community.tsx
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { decode } from "base64-arraybuffer";

import { useColors } from "@/constants/colors";
import spacing from "@/constants/spacing";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import SafeLinearGradient from "@/components/SafeLinearGradient";
import { ThemedScrollView } from "@/components/ui/Themed";
import PostCard from "@/components/PostCard";
import { supabase } from "@/lib/supabase";

/* ---------- Constants ---------- */
const POST_MEDIA_BUCKET = "post-media";

/* ---------- Types ---------- */
type DbPost = {
  id: string;
  author_id?: string | null;
  author_username?: string | null;
  author_display_name?: string | null;
  author_avatar_url?: string | null;
  text: string | null;
  media_urls: string[] | null;
  likes?: number | null;
  comments?: number | null;
  created_at: string;
};

type UiPost = {
  id: string;
  authorUsername: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  caption?: string;
  images?: string[];
  likes: number;
  comments: number;
  createdAt: string;
  isLikedByCurrentUser?: boolean;
};

type DbComment = {
  id: string;
  post_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  text: string;
  likes?: number | null;
  created_at: string;
  media_url?: string | null;
};

type UiComment = {
  id: string;
  postId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  text: string;
  likes: number;
  createdAt: string;
  isLikedByCurrentUser?: boolean;
  imageUrl?: string;
};

type Friend = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
};

type ChallengeType = "running" | "calories";

type ChallengeParticipant = {
  id: string;
  name: string;
  avatarUrl: string;
  km: number;
  calories: number;
  accepted: boolean;
};

type Challenge = {
  id: string;
  type: ChallengeType;
  createdBy: string;
  createdByAvatar: string;
  createdAt: string;
  participants: ChallengeParticipant[];
};

type DbChallenge = {
  id: string;
  creator_username: string;
  creator_display_name: string | null;
  creator_avatar_url: string | null;
  type: ChallengeType;
  status: "active" | "completed" | "cancelled" | null;
  created_at: string;
};

type DbParticipant = {
  id: string;
  challenge_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  km: number | null;
  calories: number | null;
  accepted: boolean | null;
  created_at: string;
};

/* ---------- Helpers ---------- */
const avatarFor = (username?: string) =>
  `https://i.pravatar.cc/120?u=${encodeURIComponent(username ?? "you")}`;

function mapDbToUi(row: DbPost): UiPost {
  return {
    id: row.id,
    authorUsername: row.author_username ?? "unknown",
    authorDisplayName: row.author_display_name ?? undefined,
    authorAvatarUrl: row.author_avatar_url ?? undefined,
    caption: row.text ?? undefined,
    images: row.media_urls ?? undefined,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    createdAt: row.created_at,
  };
}

function mapDbCommentToUi(row: DbComment): UiComment {
  return {
    id: row.id,
    postId: row.post_id,
    username: row.username,
    displayName: row.display_name ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    text: row.text,
    likes: row.likes ?? 0,
    createdAt: row.created_at,
    imageUrl: row.media_url ?? undefined,
  };
}

function buildUiChallenge(
  ch: DbChallenge,
  participants: DbParticipant[]
): Challenge {
  const uiParticipants: ChallengeParticipant[] = participants.map((p) => ({
    id: p.id,
    name: p.display_name || p.username || "Unknown",
    avatarUrl: p.avatar_url || avatarFor(p.username || "unknown"),
    km: Number(p.km ?? 0),
    calories: Number(p.calories ?? 0),
    accepted: !!p.accepted,
  }));

  return {
    id: ch.id,
    type: ch.type,
    createdBy: ch.creator_display_name || ch.creator_username,
    createdByAvatar:
      ch.creator_avatar_url || avatarFor(ch.creator_username),
    createdAt: ch.created_at,
    participants: uiParticipants,
  };
}

function formatTimeAgo(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return new Date(iso).toLocaleDateString();
}

/* ---------- Component ---------- */
export default function CommunityScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, runs } = useApp();
  const { user: authUser } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] =
    useState<"feed" | "challenges" | "friends">("feed");
  const [posts, setPosts] = useState<UiPost[]>([]);
  const [loading, setLoading] = useState(false);

  // Composer state (posts)
  const [caption, setCaption] = useState("");
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [pickedImageBase64, setPickedImageBase64] =
    useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Comments modal state
  const [commentTargetPost, setCommentTargetPost] = useState<UiPost | null>(
    null
  );
  const [comments, setComments] = useState<UiComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentImageUri, setCommentImageUri] = useState<string | null>(null);
  const [commentImageBase64, setCommentImageBase64] =
    useState<string | null>(null);

  // Friends (placeholder)
  const [friends] = useState<Friend[]>([
    {
      id: "storm",
      username: "storm_kat",
      displayName: "Storm Kat",
      avatarUrl: avatarFor("Storm Kat"),
    },
    {
      id: "neo",
      username: "neo_runner",
      displayName: "Neo Runner",
      avatarUrl: avatarFor("Neo Runner"),
    },
    {
      id: "brenda",
      username: "brenda_m",
      displayName: "Brenda M.",
      avatarUrl: avatarFor("Brenda M."),
    },
    {
      id: "thabo",
      username: "thabo_fit",
      displayName: "Thabo Fit",
      avatarUrl: avatarFor("Thabo Fit"),
    },
  ]);

  // Challenges state
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(
    null
  );
  const [incomingChallenge, setIncomingChallenge] =
    useState<Challenge | null>(null);
  const [incomingModalVisible, setIncomingModalVisible] = useState(false);

  const [selectFriendsVisible, setSelectFriendsVisible] = useState(false);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [chooseTypeVisible, setChooseTypeVisible] = useState(false);

  const hasChallengeNotification = !!incomingChallenge;

  /* ----- Load posts from Supabase with live likes/comments ----- */
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data: postRows, error: postErr } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (postErr) throw postErr;

      let mapped = (postRows as DbPost[]).map(mapDbToUi);
      if (mapped.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = mapped.map((p) => p.id);

      // likes
      const { data: likeRows, error: likeErr } = await supabase
        .from("post_likes")
        .select("post_id, username")
        .in("post_id", postIds);

      const likesByPost = new Map<string, number>();
      const likedByMe = new Set<string>();

      if (!likeErr && likeRows) {
        (likeRows as { post_id: string; username: string }[]).forEach(
          (row) => {
            likesByPost.set(
              row.post_id,
              (likesByPost.get(row.post_id) ?? 0) + 1
            );
            if (row.username === user?.username) {
              likedByMe.add(row.post_id);
            }
          }
        );
      }

      // comment counts
      const { data: commentRows, error: commentErr } = await supabase
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      const commentsByPost = new Map<string, number>();
      if (!commentErr && commentRows) {
        (commentRows as { post_id: string }[]).forEach((row) => {
          commentsByPost.set(
            row.post_id,
            (commentsByPost.get(row.post_id) ?? 0) + 1
          );
        });
      }

      // merge
      mapped = mapped.map((p) => ({
        ...p,
        likes: likesByPost.get(p.id) ?? p.likes ?? 0,
        comments: commentsByPost.get(p.id) ?? p.comments ?? 0,
        isLikedByCurrentUser: likedByMe.has(p.id),
      }));

      setPosts(mapped);
    } catch (e: any) {
      console.warn("loadPosts failed", e?.message);
      Alert.alert(
        "Could not load posts",
        e?.message ?? "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  /* ----- Load challenges from Supabase ----- */
  const loadChallenges = useCallback(async () => {
    if (!user?.username) {
      setActiveChallenge(null);
      setIncomingChallenge(null);
      return;
    }

    try {
      const { data: myParts, error: myErr } = await supabase
        .from("challenge_participants")
        .select("*")
        .eq("username", user.username);

      if (myErr) throw myErr;
      const myParticipantRows = (myParts || []) as DbParticipant[];

      if (myParticipantRows.length === 0) {
        setActiveChallenge(null);
        setIncomingChallenge(null);
        return;
      }

      const challengeIds = Array.from(
        new Set(myParticipantRows.map((p) => p.challenge_id))
      );

      const { data: chRows, error: chErr } = await supabase
        .from("challenges")
        .select("*")
        .in("id", challengeIds);

      if (chErr) throw chErr;
      const challengeRows = (chRows || []) as DbChallenge[];

      if (challengeRows.length === 0) {
        setActiveChallenge(null);
        setIncomingChallenge(null);
        return;
      }

      const { data: allParts, error: allErr } = await supabase
        .from("challenge_participants")
        .select("*")
        .in("challenge_id", challengeIds);

      if (allErr) throw allErr;
      const allParticipantRows = (allParts || []) as DbParticipant[];

      let active: DbChallenge | null = null;
      let incoming: DbChallenge | null = null;

      const findMyRow = (challengeId: string) =>
        myParticipantRows.find((p) => p.challenge_id === challengeId);

      for (const ch of challengeRows) {
        if (ch.status !== "active") continue;
        const mine = findMyRow(ch.id);
        if (!mine) continue;

        if (mine.accepted) {
          if (
            !active ||
            new Date(ch.created_at).getTime() >
              new Date(active.created_at).getTime()
          ) {
            active = ch;
          }
        } else {
          if (
            !incoming ||
            new Date(ch.created_at).getTime() >
              new Date(incoming.created_at).getTime()
          ) {
            incoming = ch;
          }
        }
      }

      if (active) {
        const related = allParticipantRows.filter(
          (p) => p.challenge_id === active!.id
        );
        setActiveChallenge(buildUiChallenge(active, related));
      } else {
        setActiveChallenge(null);
      }

      if (incoming) {
        const related = allParticipantRows.filter(
          (p) => p.challenge_id === incoming!.id
        );
        setIncomingChallenge(buildUiChallenge(incoming, related));
      } else {
        setIncomingChallenge(null);
      }
    } catch (e: any) {
      console.warn("Failed to load challenges", e?.message);
    }
  }, [user?.username]);

  useEffect(() => {
    if (activeTab === "challenges") {
      loadChallenges();
    }
  }, [activeTab, loadChallenges]);

  /* ----- Pick photo (for main post) ----- */
  const pickPhoto = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const asset = res.assets[0];
      setPickedImageUri(asset.uri);
      setPickedImageBase64(asset.base64 ?? null);
    }
  };

  /* ----- Pick photo for a comment ----- */
  const pickCommentPhoto = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const asset = res.assets[0];
      setCommentImageUri(asset.uri);
      setCommentImageBase64(asset.base64 ?? null);
    }
  };

  /* ----- Create post (text-only or with image) ----- */
  const createPost = async () => {
    const text = caption.trim();
    if (!text && !pickedImageUri) {
      Alert.alert("Write something", "Add a caption or pick a photo to post.");
      return;
    }

    if (!authUser) {
      Alert.alert(
        "Log in required",
        "Please log in or create an account to post in the Community Hub."
      );
      return;
    }

    if (!user?.username) {
      Alert.alert("Not ready", "Missing username on profile.");
      return;
    }

    setPosting(true);
    try {
      let uploadedUrl: string | null = null;

      if (pickedImageUri) {
        if (!pickedImageBase64) {
          throw new Error("Could not read image data. Please pick the photo again.");
        }

        const ext =
          pickedImageUri.split(".").pop()?.toLowerCase() || "jpeg";
        const path = `${user.username}/${Date.now()}.${ext}`;
        const arrayBuffer = decode(pickedImageBase64);

        const { data: up, error: upErr } = await supabase.storage
          .from(POST_MEDIA_BUCKET)
          .upload(path, arrayBuffer, {
            contentType: `image/${ext}`,
          });

        if (upErr) throw upErr;

        const { data: pub } = supabase.storage
          .from(POST_MEDIA_BUCKET)
          .getPublicUrl(up!.path);
        uploadedUrl = pub.publicUrl;
      }

      const insertPayload = {
        author_id: authUser.id,
        author_username: user.username!,
        author_display_name: user.displayName ?? null,
        author_avatar_url: user.avatarUrl ?? null,
        text: text || null,
        media_urls: uploadedUrl ? [uploadedUrl] : [],
      };

      const { data, error } = await supabase
        .from("posts")
        .insert(insertPayload)
        .select("*")
        .single();

      if (error) throw error;

      const uiPost = mapDbToUi(data as DbPost);

      setPosts((prev) => [uiPost, ...prev]);
      setCaption("");
      setPickedImageUri(null);
      setPickedImageBase64(null);
    } catch (e: any) {
      Alert.alert("Post failed", e?.message ?? "Something went wrong.");
    } finally {
      setPosting(false);
    }
  };

  /* ----- Likes: toggle per user (like/unlike) ----- */
  const likePost = async (id: string) => {
    if (!user?.username) {
      Alert.alert("Not ready", "Please complete your profile to like posts.");
      return;
    }

    const target = posts.find((p) => p.id === id);
    const wasLiked = !!target?.isLikedByCurrentUser;

    // optimistic UI
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const delta = wasLiked ? -1 : 1;
        return {
          ...p,
          isLikedByCurrentUser: !wasLiked,
          likes: Math.max(0, (p.likes || 0) + delta),
        };
      })
    );

    try {
      if (wasLiked) {
        await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", id)
          .eq("username", user.username);
      } else {
        await supabase.from("post_likes").insert({
          post_id: id,
          username: user.username,
        });
      }

      const fresh = await supabase
        .from("post_likes")
        .select("id", { count: "exact", head: true })
        .eq("post_id", id);

      if (fresh.count !== null) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, likes: fresh.count ?? p.likes } : p
          )
        );
      }
    } catch (e) {
      console.warn("Like toggle failed", e);
      loadPosts();
    }
  };

  /* ----- Comments: open modal + load comments + their likes ----- */
  const openCommentsForPost = async (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;

    setCommentTargetPost(post);
    setComments([]);
    setNewCommentText("");
    setCommentImageUri(null);
    setCommentImageBase64(null);
    setCommentsLoading(true);

    try {
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      let mapped = (data as DbComment[]).map(mapDbCommentToUi);

      if (user?.username && mapped.length > 0) {
        const ids = mapped.map((c) => c.id);
        const { data: likedRows, error: likedErr } = await supabase
          .from("comment_likes")
          .select("comment_id")
          .eq("username", user.username)
          .in("comment_id", ids);

        if (!likedErr && likedRows) {
          const likedSet = new Set<string>(
            (likedRows as { comment_id: string }[]).map(
              (r) => r.comment_id
            )
          );
          mapped = mapped.map((c) => ({
            ...c,
            isLikedByCurrentUser: likedSet.has(c.id),
          }));
        }
      }

      setComments(mapped);
    } catch (e: any) {
      Alert.alert(
        "Could not load comments",
        e?.message ?? "Something went wrong."
      );
    } finally {
      setCommentsLoading(false);
    }
  };

  const closeCommentsModal = () => {
    setCommentTargetPost(null);
    setComments([]);
    setNewCommentText("");
    setCommentImageUri(null);
    setCommentImageBase64(null);
    setCommentsLoading(false);
    setCommentSubmitting(false);
  };

  /* ----- Submit comment (text + optional image) ----- */
  const submitComment = async () => {
    if (!commentTargetPost) return;

    const text = newCommentText.trim();
    if (!text && !commentImageUri) {
      // nothing to send
      return;
    }

    if (!user?.username) {
      Alert.alert("Not ready", "Please complete your profile to comment.");
      return;
    }

    setCommentSubmitting(true);
    try {
      let uploadedCommentImageUrl: string | null = null;

      if (commentImageUri) {
        if (!commentImageBase64) {
          throw new Error(
            "Could not read image data for comment. Please pick the image again."
          );
        }

        const ext =
          commentImageUri.split(".").pop()?.toLowerCase() || "jpeg";
        const path = `comments/${user.username}/${Date.now()}.${ext}`;
        const arrayBuffer = decode(commentImageBase64);

        const { data: up, error: upErr } = await supabase.storage
          .from(POST_MEDIA_BUCKET)
          .upload(path, arrayBuffer, {
            contentType: `image/${ext}`,
          });

        if (upErr) throw upErr;

        const { data: pub } = supabase.storage
          .from(POST_MEDIA_BUCKET)
          .getPublicUrl(up!.path);
        uploadedCommentImageUrl = pub.publicUrl;
      }

      const payload = {
        post_id: commentTargetPost.id,
        username: user.username,
        display_name: user.displayName ?? null,
        avatar_url: user.avatarUrl ?? null,
        text: text || "", // allow pure image comments
        media_url: uploadedCommentImageUrl ?? null,
      };

      const { data, error } = await supabase
        .from("post_comments")
        .insert(payload)
        .select("*")
        .single();

      if (error) throw error;

      const uiComment = mapDbCommentToUi(data as DbComment);
      const newCount = comments.length + 1;

      setComments((prev) => [...prev, uiComment]);
      setNewCommentText("");
      setCommentImageUri(null);
      setCommentImageBase64(null);

      setPosts((prev) =>
        prev.map((p) =>
          p.id === commentTargetPost.id
            ? { ...p, comments: newCount }
            : p
        )
      );

      try {
        await supabase
          .from("posts")
          .update({ comments: newCount })
          .eq("id", commentTargetPost.id);
      } catch {
        // ignore
      }
    } catch (e: any) {
      Alert.alert(
        "Comment failed",
        e?.message ?? "Something went wrong."
      );
    } finally {
      setCommentSubmitting(false);
    }
  };

  /* ----- Toggle like on a comment ----- */
  const toggleCommentLike = async (commentId: string) => {
    if (!user?.username) {
      Alert.alert(
        "Not ready",
        "Please complete your profile to like comments."
      );
      return;
    }

    const target = comments.find((c) => c.id === commentId);
    const wasLiked = !!target?.isLikedByCurrentUser;

    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const delta = wasLiked ? -1 : 1;
        return {
          ...c,
          isLikedByCurrentUser: !wasLiked,
          likes: Math.max(0, (c.likes || 0) + delta),
        };
      })
    );

    try {
      if (wasLiked) {
        await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", commentId)
          .eq("username", user.username);
      } else {
        await supabase.from("comment_likes").insert({
          comment_id: commentId,
          username: user.username,
        });
      }

      const fresh = await supabase
        .from("comment_likes")
        .select("id", { count: "exact", head: true })
        .eq("comment_id", commentId);

      if (fresh.count !== null) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, likes: fresh.count ?? c.likes }
              : c
          )
        );
      }
    } catch (e) {
      console.warn("Comment like toggle failed", e);
    }
  };

  // ----- Current user basics -----
  const avatarUri = user?.avatarUrl || avatarFor(user?.username);
  const currentUsername = user?.username || "You";
  const currentDisplayName = user?.displayName || currentUsername;

  /* ----- Weekly totals for challenges ----- */
  const weeklyKm = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    const totalMeters = runs
      .filter((r) => new Date(r.dateISO).getTime() >= weekAgo)
      .reduce((s, r) => s + (r?.distanceMeters ?? 0), 0);
    return Math.round((totalMeters / 1000) * 10) / 10;
  }, [runs]);

  const weeklyCalories = 0; // placeholder

  /* ----- Challenge helpers ----- */
  const openSelectFriends = () => {
    setSelectedFriendIds([]);
    setSelectFriendsVisible(true);
  };

  const toggleFriendSelection = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const cancelSelectFriends = () => {
    setSelectFriendsVisible(false);
    setSelectedFriendIds([]);
  };

  const doneSelectFriends = () => {
    if (selectedFriendIds.length === 0) return;
    setSelectFriendsVisible(false);
    setChooseTypeVisible(true);
  };

  const createChallenge = async (type: ChallengeType) => {
    if (!user?.username) {
      Alert.alert("Not ready", "Please complete your profile first.");
      return;
    }

    try {
      const { data: chData, error: chErr } = await supabase
        .from("challenges")
        .insert({
          creator_username: user.username,
          creator_display_name: user.displayName ?? null,
          creator_avatar_url: user.avatarUrl ?? null,
          type,
          status: "active",
        })
        .select("*")
        .single();

      if (chErr) throw chErr;
      const challengeRow = chData as DbChallenge;

      const pickedFriends = friends.filter((f) =>
        selectedFriendIds.includes(f.id)
      );

      const payload: Partial<DbParticipant>[] = [
        {
          challenge_id: challengeRow.id,
          username: user.username,
          display_name: user.displayName ?? null,
          avatar_url: user.avatarUrl ?? null,
          km: weeklyKm,
          calories: weeklyCalories,
          accepted: true,
        },
        ...pickedFriends.map((f) => ({
          challenge_id: challengeRow.id,
          username: f.username,
          display_name: f.displayName,
          avatar_url: f.avatarUrl,
          km: 0,
          calories: 0,
          accepted: false,
        })),
      ];

      const { data: partData, error: partErr } = await supabase
        .from("challenge_participants")
        .insert(payload)
        .select("*");

      if (partErr) throw partErr;

      const participants = (partData || []) as DbParticipant[];
      const uiChallenge = buildUiChallenge(challengeRow, participants);

      setActiveChallenge(uiChallenge);
      setChooseTypeVisible(false);
      setSelectedFriendIds([]);
    } catch (e: any) {
      Alert.alert(
        "Challenge failed",
        e?.message ?? "Could not create challenge."
      );
    }
  };

  const openIncomingModal = () => {
    if (!incomingChallenge) return;
    setIncomingModalVisible(true);
  };

  const acceptIncomingChallenge = async () => {
    if (!incomingChallenge || !user?.username) return;

    try {
      await supabase
        .from("challenge_participants")
        .update({ accepted: true })
        .eq("challenge_id", incomingChallenge.id)
        .eq("username", user.username);

      setIncomingModalVisible(false);
      await loadChallenges();
    } catch (e: any) {
      Alert.alert(
        "Could not accept",
        e?.message ?? "Please try again."
      );
    }
  };

  const declineIncomingChallenge = async () => {
    if (!incomingChallenge || !user?.username) {
      setIncomingChallenge(null);
      setIncomingModalVisible(false);
      return;
    }

    try {
      await supabase
        .from("challenge_participants")
        .update({ accepted: false })
        .eq("challenge_id", incomingChallenge.id)
        .eq("username", user.username);

      setIncomingChallenge(null);
      setIncomingModalVisible(false);
    } catch (e: any) {
      console.warn("Decline failed", e?.message);
      setIncomingChallenge(null);
      setIncomingModalVisible(false);
    }
  };

  /* ----- Helper: render comment text with @mentions tappable ----- */
  const renderCommentText = (c: UiComment) => {
    const parts = c.text.split(/(\s+)/);

    return (
      <Text style={styles.commentText}>
        {parts.map((part, idx) => {
          const isWhitespace = /^\s+$/.test(part);
          if (isWhitespace || part.length === 0) {
            return <Text key={idx}>{part}</Text>;
          }

          if (part.startsWith("@") && part.length > 1) {
            const username = part.slice(1);
            const isYou =
              username.toLowerCase() === currentUsername.toLowerCase();

            return (
              <Text
                key={idx}
                style={styles.commentMention}
                onPress={() => {
                  if (isYou) {
                    router.push("/profile" as any);
                  } else {
                    Alert.alert(
                      "Coming soon",
                      "Viewing other members' profiles is coming in a future update."
                    );
                  }
                }}
              >
                {part}
              </Text>
            );
          }

          return <Text key={idx}>{part}</Text>;
        })}
      </Text>
    );
  };

  return (
    <ThemedScrollView contentContainerStyle={{ paddingBottom: 160 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Hub</Text>

        <View style={styles.tabRow}>
          {(["feed", "challenges", "friends"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab[0].toUpperCase() + tab.slice(1);
            const showDot = tab === "challenges" && hasChallengeNotification;

            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={styles.tab}
              >
                {isActive ? (
                  <SafeLinearGradient style={styles.tabGradient}>
                    <View style={styles.tabLabelRow}>
                      <Text style={styles.activeTabText}>{label}</Text>
                      {showDot && <View style={styles.redDot} />}
                    </View>
                  </SafeLinearGradient>
                ) : (
                  <View style={styles.tabLabelRow}>
                    <Text style={styles.tabText}>{label}</Text>
                    {showDot && <View style={styles.redDot} />}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* FEED */}
      {activeTab === "feed" && (
        <View style={{ padding: spacing.lg }}>
          {/* Composer */}
          <View style={styles.composer}>
            <View style={styles.composerTopRow}>
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.composerTitle}>Share your progress</Text>
                <Text style={styles.composerSubtitle}>
                  How did training go today?
                </Text>
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                placeholder="Write a post to the community…"
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                style={styles.input}
                multiline
              />
            </View>

            <View style={styles.composerBottomRow}>
              <Pressable
                onPress={pickPhoto}
                style={styles.photoChip}
                hitSlop={8}
              >
                <Ionicons
                  name="image"
                  size={18}
                  color={colors.accentGradient[1]}
                />
                <Text style={styles.photoChipText}>Add photo</Text>
              </Pressable>

              <SafeLinearGradient style={styles.postGrad}>
                <Pressable
                  onPress={createPost}
                  style={styles.postBtn}
                  disabled={posting}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.postText}>Post</Text>
                  )}
                </Pressable>
              </SafeLinearGradient>
            </View>
          </View>

          {/* Image preview */}
          {pickedImageUri ? (
            <View style={styles.previewRow}>
              <Image
                source={{ uri: pickedImageUri }}
                style={styles.previewImg}
              />
              <Pressable
                onPress={() => {
                  setPickedImageUri(null);
                  setPickedImageBase64(null);
                }}
                style={styles.removePreview}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          ) : null}

          {/* Posts list */}
          <View style={{ marginTop: 18 }}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : posts.length === 0 ? (
              <Text style={styles.noPosts}>
                No posts yet — share your first!
              </Text>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={{
                    id: p.id,
                    uri: p.images?.[0] || "",
                    caption: p.caption || "",
                    likes: p.likes,
                    comments: p.comments,
                    createdAt: p.createdAt,
                    authorUsername: p.authorUsername,
                    authorDisplayName: p.authorDisplayName,
                    authorAvatarUrl:
                      p.authorAvatarUrl || avatarFor(p.authorUsername),
                    isLikedByCurrentUser: p.isLikedByCurrentUser,
                  }}
                  onLike={likePost}
                  onComment={openCommentsForPost}
                  onPressAuthor={(username) => {
                    const isYou =
                      username.toLowerCase() ===
                      currentUsername.toLowerCase();
                    if (isYou) {
                      router.push("/profile" as any);
                    } else {
                      Alert.alert(
                        "Coming soon",
                        "Viewing other members' profiles is coming in a future update."
                      );
                    }
                  }}
                />
              ))
            )}
          </View>
        </View>
      )}

      {/* CHALLENGES */}
      {activeTab === "challenges" && (
        <View style={styles.sectionCenter}>
          {incomingChallenge && (
            <View style={styles.incomingBox}>
              <Text style={styles.incomingTitle}>You have been challenged</Text>
              <Text style={styles.incomingBody}>
                You have been challenged by {incomingChallenge.createdBy} to
                take part in a weekly{" "}
                {incomingChallenge.type === "running"
                  ? "Running (KM)"
                  : "Calories"}{" "}
                leaderboard. Do you accept?
              </Text>
              <SafeLinearGradient style={styles.readMoreGrad}>
                <Pressable
                  style={styles.readMoreBtn}
                  onPress={openIncomingModal}
                >
                  <Text style={styles.readMoreText}>Read More</Text>
                </Pressable>
              </SafeLinearGradient>
            </View>
          )}

          {!incomingChallenge && !activeChallenge && (
            <View style={styles.challengeEmpty}>
              <Ionicons
                name="trophy"
                size={40}
                color={colors.accentGradient[1]}
              />
              <Text style={styles.sectionTitle}>No active challenges yet</Text>
              <Text style={styles.sectionText}>
                Start a Weekly Leaderboard and challenge your friends in KM or
                Calories.
              </Text>
              <SafeLinearGradient style={styles.challengeCtaGrad}>
                <Pressable
                  style={styles.challengeCtaBtn}
                  onPress={openSelectFriends}
                >
                  <Text style={styles.challengeCtaText}>
                    Challenge your friends
                  </Text>
                </Pressable>
              </SafeLinearGradient>
            </View>
          )}

          {activeChallenge && (
            <View style={{ width: "100%", marginTop: 10 }}>
              <Text style={styles.sectionTitle}>
                Weekly Leaderboard (
                {activeChallenge.type === "running" ? "KM" : "Calories"})
              </Text>
              <Text style={styles.sectionText}>
                Created by {activeChallenge.createdBy}
              </Text>

              <View style={{ marginTop: 18 }}>
                {activeChallenge.participants
                  .filter((p) => p.accepted)
                  .slice()
                  .sort((a, b) =>
                    activeChallenge.type === "running"
                      ? b.km - a.km
                      : b.calories - a.calories
                  )
                  .map((p, index) => {
                    const value =
                      activeChallenge.type === "running"
                        ? `${p.km.toFixed(1)} km`
                        : `${p.calories} kcal`;
                    const isYou = p.name === currentDisplayName;

                    return (
                      <View key={p.id} style={styles.lbRow}>
                        <Text style={styles.lbRank}>{index + 1}</Text>
                        <View style={styles.lbUser}>
                          <Image
                            source={{ uri: p.avatarUrl }}
                            style={styles.lbAvatar}
                          />
                          <Text
                            style={[
                              styles.lbName,
                              isYou && {
                                color: colors.accentGradient[1],
                                fontWeight: "800",
                              },
                            ]}
                          >
                            {p.name}
                          </Text>
                        </View>
                        <Text style={styles.lbValue}>{value}</Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* FRIENDS */}
      {activeTab === "friends" && (
        <View style={styles.sectionCenter}>
          <Ionicons
            name="people"
            size={50}
            color={colors.accentGradient[1]}
          />
          <Text style={styles.sectionText}>
            Find friends & join teams 💬
          </Text>
        </View>
      )}

      {/* COMMENTS MODAL */}
      <Modal
        visible={!!commentTargetPost}
        animationType="fade"
        transparent
        onRequestClose={closeCommentsModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentTitle}>Comments</Text>
              <Pressable
                onPress={closeCommentsModal}
                style={styles.commentCloseBtn}
              >
                <Ionicons
                  name="close"
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {commentTargetPost && (
              <View style={styles.commentPostPreview}>
                <Image
                  source={{
                    uri:
                      commentTargetPost.authorAvatarUrl ||
                      avatarFor(commentTargetPost.authorUsername),
                  }}
                  style={styles.commentPostAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentPostName}>
                    {commentTargetPost.authorDisplayName ||
                      commentTargetPost.authorUsername}
                  </Text>
                  {commentTargetPost.caption ? (
                    <Text
                      style={styles.commentPostCaption}
                      numberOfLines={2}
                    >
                      {commentTargetPost.caption}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            <View style={styles.commentListContainer}>
              {commentsLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : comments.length === 0 ? (
                <Text style={styles.noCommentsText}>
                  No comments yet — be the first to reply.
                </Text>
              ) : (
                <ScrollView
                  contentContainerStyle={{ paddingBottom: 8 }}
                >
                  {comments.map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <Image
                        source={{
                          uri: c.avatarUrl || avatarFor(c.username),
                        }}
                        style={styles.commentAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <View style={styles.commentNameRow}>
                          <Text style={styles.commentName}>
                            {c.displayName || c.username}
                          </Text>
                          <Text style={styles.commentTime}>
                            {formatTimeAgo(c.createdAt)}
                          </Text>
                        </View>
                        {!!c.text && renderCommentText(c)}
                        {c.imageUrl ? (
                          <Image
                            source={{ uri: c.imageUrl }}
                            style={styles.commentImage}
                          />
                        ) : null}
                      </View>

                      <Pressable
                        style={styles.commentLikeChip}
                        onPress={() => toggleCommentLike(c.id)}
                      >
                        <Ionicons
                          name={
                            c.isLikedByCurrentUser
                              ? "heart"
                              : "heart-outline"
                          }
                          size={14}
                          color={
                            c.isLikedByCurrentUser
                              ? "#ef4444"
                              : colors.textMuted
                          }
                        />
                        <Text style={styles.commentLikeCount}>
                          {c.likes}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Comment image preview */}
            {commentImageUri ? (
              <View style={styles.commentPreviewRow}>
                <Image
                  source={{ uri: commentImageUri }}
                  style={styles.commentPreviewImg}
                />
                <Pressable
                  onPress={() => {
                    setCommentImageUri(null);
                    setCommentImageBase64(null);
                  }}
                  style={styles.commentRemovePreview}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.commentInputRow}>
              <Pressable
                style={styles.commentMediaBtn}
                onPress={pickCommentPhoto}
              >
                <Ionicons name="image" size={18} color="#fff" />
              </Pressable>

              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment…"
                placeholderTextColor={colors.textMuted}
                value={newCommentText}
                onChangeText={setNewCommentText}
                multiline
              />
              <SafeLinearGradient style={styles.commentSendGrad}>
                <Pressable
                  onPress={submitComment}
                  style={styles.commentSendBtn}
                  disabled={
                    commentSubmitting ||
                    (newCommentText.trim().length === 0 &&
                      !commentImageUri)
                  }
                >
                  {commentSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.commentSendText}>Send</Text>
                  )}
                </Pressable>
              </SafeLinearGradient>
            </View>
          </View>
        </View>
      </Modal>

      {/* SELECT FRIENDS MODAL */}
      <Modal
        visible={selectFriendsVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelSelectFriends}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.challengeModalContent}>
            <Text style={styles.commentTitle}>Challenge your friends</Text>
            <Text style={styles.modalSubtitle}>
              Select friends to add to this Weekly Leaderboard.
            </Text>

            <ScrollView
              style={styles.friendList}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              {friends.map((f) => {
                const selected = selectedFriendIds.includes(f.id);
                return (
                  <Pressable
                    key={f.id}
                    style={[
                      styles.friendRow,
                      selected && styles.friendRowSelected,
                    ]}
                    onPress={() => toggleFriendSelection(f.id)}
                  >
                    <Image
                      source={{ uri: f.avatarUrl }}
                      style={styles.friendAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.friendName}>{f.displayName}</Text>
                      <Text style={styles.friendUsername}>
                        @{f.username}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.accentGradient[1]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.challengeModalButtonsRow}>
              <Pressable
                style={[styles.pillBtn, styles.pillBtnSecondary]}
                onPress={cancelSelectFriends}
              >
                <Text style={styles.pillBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <SafeLinearGradient style={styles.pillGrad}>
                <Pressable
                  style={styles.pillBtn}
                  onPress={doneSelectFriends}
                  disabled={selectedFriendIds.length === 0}
                >
                  <Text style={styles.pillBtnText}>Done</Text>
                </Pressable>
              </SafeLinearGradient>
            </View>
          </View>
        </View>
      </Modal>

      {/* CHALLENGE TYPE MODAL */}
      <Modal
        visible={chooseTypeVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setChooseTypeVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.challengeModalContent}>
            <Text style={styles.commentTitle}>Confirm challenge type</Text>
            <Text style={styles.modalSubtitle}>
              You are about to challenge your friends. Please confirm type of
              challenge.
            </Text>

            <View style={styles.challengeTypeRow}>
              <SafeLinearGradient style={styles.pillGrad}>
                <Pressable
                  style={styles.pillBtn}
                  onPress={() => createChallenge("running")}
                >
                  <Text style={styles.pillBtnText}>Running</Text>
                </Pressable>
              </SafeLinearGradient>
              <SafeLinearGradient style={styles.pillGrad}>
                <Pressable
                  style={styles.pillBtn}
                  onPress={() => createChallenge("calories")}
                >
                  <Text style={styles.pillBtnText}>Calories</Text>
                </Pressable>
              </SafeLinearGradient>
            </View>

            <Pressable
              style={[
                styles.pillBtn,
                styles.pillBtnSecondary,
                { marginTop: 12 },
              ]}
              onPress={() => setChooseTypeVisible(false)}
            >
              <Text style={styles.pillBtnSecondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* INCOMING CHALLENGE "READ MORE" MODAL */}
      <Modal
        visible={incomingModalVisible && !!incomingChallenge}
        animationType="fade"
        transparent
        onRequestClose={() => setIncomingModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.challengeModalContent}>
            {incomingChallenge && (
              <>
                <Text style={styles.commentTitle}>Challenge invite</Text>
                <Text style={styles.modalSubtitle}>
                  You have been challenged by {incomingChallenge.createdBy} to
                  take part in the Weekly Leaderboard Challenge. Do you accept?
                </Text>

                <View style={styles.challengeTypeRow}>
                  <SafeLinearGradient style={styles.pillGrad}>
                    <Pressable
                      style={styles.pillBtn}
                      onPress={acceptIncomingChallenge}
                    >
                      <Text style={styles.pillBtnText}>Accept</Text>
                    </Pressable>
                  </SafeLinearGradient>
                  <Pressable
                    style={[styles.pillBtn, styles.pillBtnSecondary]}
                    onPress={declineIncomingChallenge}
                  >
                    <Text style={styles.pillBtnSecondaryText}>Decline</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ThemedScrollView>
  );
}

/* ---------- Styles ---------- */
function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    header: { paddingHorizontal: spacing.lg, paddingTop: 20 },
    headerTitle: { fontSize: 28, fontWeight: "900", color: colors.text },

    tabRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 999,
      marginTop: 12,
      justifyContent: "space-around",
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      borderRadius: 999,
      paddingVertical: 8,
    },
    tabGradient: {
      width: "100%",
      alignItems: "center",
      borderRadius: 999,
      paddingVertical: 8,
    },
    tabLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    activeTabText: { color: colors.bg, fontWeight: "800" },
    tabText: { color: colors.textMuted, fontWeight: "700" },
    redDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor: "#ef4444",
    },

    /* Composer */
    composer: {
      marginTop: 16,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    composerTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatar: { width: 40, height: 40, borderRadius: 999 },
    composerTitle: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    composerSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    inputWrapper: {
      marginTop: 2,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      minHeight: 60,
      maxHeight: 120,
      paddingVertical: 4,
    },
    composerBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    photoChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoChipText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
    },

    postGrad: { borderRadius: 999, overflow: "hidden" },
    postBtn: { paddingVertical: 8, paddingHorizontal: 18 },
    postText: { color: colors.bg, fontWeight: "800", fontSize: 13 },

    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      gap: 10,
    },
    previewImg: { width: 60, height: 60, borderRadius: 8 },
    removePreview: {
      backgroundColor: "#ef4444",
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },

    noPosts: {
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 40,
    },

    sectionCenter: {
      alignItems: "center",
      justifyContent: "flex-start",
      marginTop: 40,
      paddingHorizontal: spacing.lg,
      width: "100%",
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginVertical: 10,
      textAlign: "center",
    },
    sectionText: {
      color: colors.text,
      marginTop: 4,
      fontSize: 14,
      textAlign: "center",
    },

    challengeEmpty: {
      alignItems: "center",
      width: "100%",
      gap: 10,
    },
    challengeCtaGrad: {
      marginTop: 16,
      borderRadius: 999,
      overflow: "hidden",
    },
    challengeCtaBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    challengeCtaText: {
      color: colors.bg,
      fontWeight: "800",
      fontSize: 14,
    },

    incomingBox: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 18,
    },
    incomingTitle: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 16,
      marginBottom: 6,
    },
    incomingBody: {
      color: colors.text,
      fontSize: 13,
      marginBottom: 12,
    },
    readMoreGrad: {
      borderRadius: 999,
      overflow: "hidden",
      alignSelf: "flex-start",
    },
    readMoreBtn: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    readMoreText: {
      color: colors.bg,
      fontWeight: "800",
      fontSize: 13,
    },

    lbRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginVertical: 6,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    lbRank: { color: colors.primary, fontWeight: "800" },
    lbUser: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      marginLeft: 8,
    },
    lbAvatar: {
      width: 28,
      height: 28,
      borderRadius: 999,
      backgroundColor: colors.bg,
    },
    lbName: { color: colors.text, fontWeight: "600", fontSize: 13 },
    lbValue: {
      color: colors.accentGradient[1],
      fontWeight: "800",
      fontSize: 13,
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: "#00000088",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      backgroundColor: colors.bg,
      borderRadius: 20,
      paddingTop: 14,
      paddingHorizontal: spacing.lg,
      paddingBottom: 18,
      width: "92%",
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: colors.border,
    },

    commentHeader: {
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    commentTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    commentCloseBtn: {
      position: "absolute",
      right: 0,
      top: 0,
      padding: 6,
      borderRadius: 999,
    },

    commentPostPreview: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
    },
    commentPostAvatar: {
      width: 34,
      height: 34,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    commentPostName: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: 2,
    },
    commentPostCaption: {
      color: colors.textMuted,
      fontSize: 12,
    },

    commentListContainer: {
      flexGrow: 1,
      minHeight: 80,
      maxHeight: 260,
      marginTop: 4,
      marginBottom: 8,
    },
    noCommentsText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      marginTop: 20,
    },
    commentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 6,
    },
    commentAvatar: {
      width: 30,
      height: 30,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    commentNameRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
    },
    commentName: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    commentTime: {
      color: colors.textMuted,
      fontSize: 11,
      marginLeft: 8,
    },
    commentText: {
      color: colors.text,
      fontSize: 13,
      marginTop: 2,
    },
    commentMention: {
      color: colors.accentGradient[1],
      fontWeight: "700",
    },

    commentImage: {
      width: 120,
      height: 120,
      borderRadius: 8,
      marginTop: 6,
      backgroundColor: colors.card,
    },

    commentLikeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.card,
    },
    commentLikeCount: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "600",
    },

    commentPreviewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 6,
    },
    commentPreviewImg: {
      width: 48,
      height: 48,
      borderRadius: 8,
    },
    commentRemovePreview: {
      backgroundColor: "#ef4444",
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },

    commentInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
      paddingTop: 6,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    commentMediaBtn: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.accentGradient[1],
      alignItems: "center",
      justifyContent: "center",
    },
    commentInput: {
      flex: 1,
      maxHeight: 80,
      color: colors.text,
      fontSize: 14,
      paddingVertical: 6,
    },
    commentSendGrad: {
      borderRadius: 999,
      overflow: "hidden",
    },
    commentSendBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    commentSendText: {
      color: colors.bg,
      fontWeight: "800",
      fontSize: 13,
    },

    challengeModalContent: {
      backgroundColor: colors.bg,
      borderRadius: 20,
      paddingTop: 16,
      paddingHorizontal: spacing.lg,
      paddingBottom: 18,
      width: "90%",
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 6,
      marginBottom: 10,
    },
    friendList: {
      maxHeight: 260,
      marginTop: 4,
      marginBottom: 10,
    },
    friendRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 6,
      backgroundColor: colors.card,
    },
    friendRowSelected: {
      borderColor: colors.accentGradient[1],
    },
    friendAvatar: {
      width: 34,
      height: 34,
      borderRadius: 999,
      marginRight: 10,
    },
    friendName: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 13,
    },
    friendUsername: {
      color: colors.textMuted,
      fontSize: 11,
    },
    challengeModalButtonsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
    },
    pillGrad: {
      borderRadius: 999,
      overflow: "hidden",
    },
    pillBtn: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    pillBtnText: {
      color: colors.bg,
      fontWeight: "800",
      fontSize: 14,
    },
    pillBtnSecondary: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 18,
      paddingVertical: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    pillBtnSecondaryText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 14,
    },
    challengeTypeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
    },
  });
}
