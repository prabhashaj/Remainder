import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { requireUserId } from "@/lib/db";

type Tables = Database["public"]["Tables"];
export type StudyResource = Tables["study_resources"]["Row"];
export type ResourceHighlight = Tables["resource_highlights"]["Row"];
export type VideoNote = Tables["video_notes"]["Row"];

export const MATERIALS_BUCKET = "materials";

function unwrap<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}

/* ---------- resources ---------- */

export async function fetchStudyResources(roadmapId?: string | null): Promise<StudyResource[]> {
  let q = supabase.from("study_resources").select("*").order("created_at", { ascending: false });
  if (roadmapId) q = q.eq("roadmap_id", roadmapId);
  return unwrap(await q);
}

export async function fetchStudyResource(id: string): Promise<StudyResource | null> {
  const { data, error } = await supabase
    .from("study_resources")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createStudyResource(input: {
  title: string;
  kind: string;
  url?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  roadmap_id?: string | null;
  extracted_text?: string | null;
  page_count?: number | null;
}): Promise<StudyResource> {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("study_resources")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function updateStudyResource(id: string, patch: Tables["study_resources"]["Update"]) {
  return unwrap(
    await supabase.from("study_resources").update(patch).eq("id", id).select("*").single(),
  );
}

export async function deleteStudyResource(resource: StudyResource) {
  if (resource.storage_path) {
    await supabase.storage.from(MATERIALS_BUCKET).remove([resource.storage_path]);
  }
  const { error } = await supabase.from("study_resources").delete().eq("id", resource.id);
  if (error) throw new Error(error.message);
}

/** Uploads a document to the private materials bucket under the user's folder. */
export async function uploadMaterial(file: File): Promise<string> {
  const userId = await requireUserId();
  const safe = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;

  const { error } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: true });

  if (
    error &&
    (error.message.includes("not found") ||
      error.message.includes("Bucket") ||
      error.message.includes("does not exist"))
  ) {
    // Attempt auto-creation if bucket doesn't exist
    await supabase.storage.createBucket(MATERIALS_BUCKET, { public: true });
    const retry = await supabase.storage
      .from(MATERIALS_BUCKET)
      .upload(path, file, { contentType: file.type || "application/pdf", upsert: true });
    if (retry.error) throw new Error(retry.error.message);
  } else if (error) {
    throw new Error(error.message);
  }
  return path;
}

export async function signedMaterialUrl(path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* fallback below */
  }
  const { data } = supabase.storage.from(MATERIALS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* ---------- highlights ---------- */

export async function fetchHighlights(resourceId: string): Promise<ResourceHighlight[]> {
  return unwrap(
    await supabase
      .from("resource_highlights")
      .select("*")
      .eq("resource_id", resourceId)
      .order("page")
      .order("created_at"),
  );
}

export async function fetchAllHighlights(): Promise<ResourceHighlight[]> {
  return unwrap(
    await supabase
      .from("resource_highlights")
      .select("*")
      .order("created_at", { ascending: false }),
  );
}

export async function createHighlight(input: {
  resource_id: string;
  page: number;
  quote: string;
  note?: string | null;
  color?: string;
}): Promise<ResourceHighlight> {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("resource_highlights")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function updateHighlight(id: string, patch: Tables["resource_highlights"]["Update"]) {
  return unwrap(
    await supabase.from("resource_highlights").update(patch).eq("id", id).select("*").single(),
  );
}

export async function deleteHighlight(id: string) {
  const { error } = await supabase.from("resource_highlights").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- video notes ---------- */

export async function fetchVideoNotes(resourceId: string): Promise<VideoNote[]> {
  return unwrap(
    await supabase.from("video_notes").select("*").eq("resource_id", resourceId).order("seconds"),
  );
}

export async function createVideoNote(input: {
  resource_id: string;
  seconds: number;
  note: string;
}): Promise<VideoNote> {
  const user_id = await requireUserId();
  return unwrap(
    await supabase
      .from("video_notes")
      .insert({ ...input, user_id })
      .select("*")
      .single(),
  );
}

export async function deleteVideoNote(id: string) {
  const { error } = await supabase.from("video_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------- helpers ---------- */

export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
  );
  return m ? (m[1] ?? null) : null;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
