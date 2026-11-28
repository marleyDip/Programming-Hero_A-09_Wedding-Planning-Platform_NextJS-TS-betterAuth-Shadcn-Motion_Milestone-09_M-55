// app/api/health/route.ts
import { db } from "@/lib/mongodb";

export async function GET() {
  try {
    await db.command({ ping: 1 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { ok: false, error: String(e) },
      { status: 500 },
    );
  }
}