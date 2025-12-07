// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// ✅ Expo will inject these at runtime from .env (EXPO_PUBLIC_*)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Throwing helps catch misconfig early in dev
  throw new Error(
    "[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
    "Make sure you created a .env in  project root and restarted `npx expo start`."
  );
}

// Create a single client for the app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// ---------- Types (kept light; extend as needed) ----------
export type DBPost = {
  id: string;
  author_id: string;           // optional if you add auth
  author_username: string;
  author_display_name?: string | null;
  author_avatar_url?: string | null;

  text?: string | null;
  media_urls?: string[] | null; // public URLs from Storage
  created_at: string;           // ISO

  likes_count: number;
  comments_count: number;
};

export type NewPostInput = {
  author_username: string;
  author_display_name?: string;
  author_avatar_url?: string;
  text?: string;
  media_urls?: string[];
};

// ---------- Storage helpers ----------
const MEDIA_BUCKET = 'media';

/**
 * Upload a single image file to Storage and return its public URL.
 * `uri` should be a local file path from ImagePicker (e.g. file:///...)
 */
export async function uploadImageToBucket(uri: string, userKey: string) {
  // Make a unique path per user/date
  const fileExt = uri.split('.').pop() ?? 'jpg';
  const fileName = `${userKey}/${Date.now()}.${fileExt}`;

  // Fetch the file as a blob (Expo compatible)
  const res = await fetch(uri);
  const blob = await res.blob();

  // Upload
  const { error: uploadErr } = await supabase.storage.from(MEDIA_BUCKET).upload(fileName, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: blob.type || 'image/jpeg',
  });
  if (uploadErr) throw uploadErr;

  // Get a public URL
  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(fileName);
  return pub.publicUrl;
}

/**
 * Upload multiple images and return their public URLs in the same order.
 */
export async function uploadManyImages(uris: string[], userKey: string) {
  const out: string[] = [];
  for (const u of uris) {
    const url = await uploadImageToBucket(u, userKey);
    out.push(url);
  }
  return out;
}

// ---------- Posts (Database) ----------
/**
 * Create a timeline post. Works for pure text, pure media, or both.
 * Ensure you’ve created the `posts` table in Supabase (SQL given earlier).
 */
export async function createPost(input: NewPostInput) {
  const row = {
    author_username: input.author_username,
    author_display_name: input.author_display_name ?? null,
    author_avatar_url: input.author_avatar_url ?? null,
    text: input.text ?? null,
    media_urls: input.media_urls ?? null,
    likes_count: 0,
    comments_count: 0,
  };

  const { data, error } = await supabase.from('posts').insert(row).select('*').single();
  if (error) throw error;
  return data as DBPost;
}

/**
 * Paginated feed. Newest first.
 */
export async function listFeed({ limit = 20, from = 0 } = {}) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw error;
  return (data ?? []) as DBPost[];
}

/**
 * Fetch all posts by a specific username (for Profile > Media).
 */
export async function listUserPosts(username: string, { limit = 40 } = {}) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('author_username', username)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DBPost[];
}

/**
 * Increment likes_count on a post (simple demo; replace with real “likes” table if needed).
 */
export async function incrementLike(postId: string) {
  const { data, error } = await supabase
    .rpc('increment_likes', { post_id_input: postId }); // optional: use SQL function
  // If you haven't created a RPC, fallback to: select -> update with likes_count + 1
  if (error) throw error;
  return data;
}

/**
 * Simple fallback (if you don’t want RPC yet):
 */
export async function bumpLike(postId: string) {
  // Get current
  const { data: cur, error: getErr } = await supabase
    .from('posts')
    .select('likes_count')
    .eq('id', postId)
    .single();
  if (getErr) throw getErr;

  const next = (cur?.likes_count ?? 0) + 1;
  const { error: updErr } = await supabase.from('posts').update({ likes_count: next }).eq('id', postId);
  if (updErr) throw updErr;
  return next;
}

/**
 * Add a very simple comment counter (you can model a comments table later).
 */
export async function bumpCommentCount(postId: string) {
  const { data: cur, error: getErr } = await supabase
    .from('posts')
    .select('comments_count')
    .eq('id', postId)
    .single();
  if (getErr) throw getErr;

  const next = (cur?.comments_count ?? 0) + 1;
  const { error: updErr } = await supabase.from('posts').update({ comments_count: next }).eq('id', postId);
  if (updErr) throw updErr;
  return next;
}
