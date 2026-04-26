import { NextResponse } from "next/server";
import { isAdminFromCookieStore } from "@/lib/auth";
import { buildPortfolioPayload } from "@/lib/portfolioService";

export const dynamic = "force-dynamic";

export async function GET() {
  const payload = await buildPortfolioPayload(isAdminFromCookieStore());
  return NextResponse.json(payload);
}
