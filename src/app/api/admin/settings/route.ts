import { NextRequest, NextResponse } from "next/server";
import { isAdminFromCookieStore } from "@/lib/auth";
import { updateBaseCurrency } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  if (!isAdminFromCookieStore()) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as { baseCurrency?: string };
  const baseCurrency = body.baseCurrency?.trim().toUpperCase();

  if (!baseCurrency) {
    return NextResponse.json(
      { ok: false, error: "Base currency is required." },
      { status: 400 }
    );
  }

  updateBaseCurrency(baseCurrency);
  return NextResponse.json({ ok: true });
}
