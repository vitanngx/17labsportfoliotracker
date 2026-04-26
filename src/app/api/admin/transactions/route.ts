import { NextRequest, NextResponse } from "next/server";
import { isAdminFromCookieStore } from "@/lib/auth";
import { insertTransaction, replaceTransactions } from "@/lib/db";
import { normalizeTransactionInput } from "@/lib/transactions";
import { CsvImportRow, TransactionInput } from "@/types/portfolio";

export async function POST(request: NextRequest) {
  if (!isAdminFromCookieStore()) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as TransactionInput | { rows: CsvImportRow[] };

  if ("rows" in body) {
    replaceTransactions(body.rows);
    return NextResponse.json({ ok: true });
  }

  const created = insertTransaction(normalizeTransactionInput(body));
  return NextResponse.json({ ok: true, data: created });
}
