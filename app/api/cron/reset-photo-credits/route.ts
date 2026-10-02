import { NextResponse } from "next/server";

/**
 * not currently in use — free tier is now one-time, not monthly.
 * Das Freikontingent (5 Credits) ist seit Umstellung auf Claid.ai lebenslang,
 * daher gibt es keinen Monats-Reset mehr. Die Route bleibt als No-Op erhalten,
 * damit der Cron in cron-job.org (falls er noch feuert) keinen 404 wirft.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, deprecated: true, reset_count: 0 });
}
