export async function uploadFile(
  bucket: string,
  path: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("path", path);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok) return { error: data.error ?? "Upload failed" };
  return { url: data.url };
}

export async function deleteFile(
  bucket: string,
  path: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path }),
  });
  const data = await res.json();

  if (!res.ok) return { success: false, error: data.error ?? "Delete failed" };
  return { success: true };
}

export function buildPublicUrl(supabaseUrl: string, bucket: string, path: string): string {
  if (!supabaseUrl) return "";
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
