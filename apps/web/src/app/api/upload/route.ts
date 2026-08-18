import { auth } from "@Batman/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { notifyUser } from "@/lib/notify";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const bucket = formData.get("bucket") as string | null;
  const path = formData.get("path") as string | null;

  if (!file || !bucket || !path) {
    return NextResponse.json({ error: "Missing file, bucket, or path" }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured. Add Supabase keys in Admin > Settings." }, { status: 500 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);

  if (bucket !== "attachments") {
    await notifyUser(session.user.id, {
      title: "File uploaded",
      description: `You uploaded "${file.name}" to ${bucket}.`,
      tag: "update",
      senderId: session.user.id,
    });
  }

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { bucket, path } = body;

  if (!bucket || !path) {
    return NextResponse.json({ error: "Missing bucket or path" }, { status: 400 });
  }

  const supabase = await getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Storage not configured. Add Supabase keys in Admin > Settings." }, { status: 500 });
  }

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await notifyUser(session.user.id, {
    title: "File deleted",
    description: `You deleted a file from ${bucket}.`,
    tag: "update",
    senderId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
