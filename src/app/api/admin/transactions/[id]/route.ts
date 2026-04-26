import { NextRequest, NextResponse } from "next/server";
import { isAdminFromCookieStore } from "@/lib/auth";
import { deleteTransaction, updateTransaction } from "@/lib/db";
import { normalizeTransactionInput } from "@/lib/transactions";
import { TransactionInput } from "@/types/portfolio";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!isAdminFromCookieStore()) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as TransactionInput;
  const updated = updateTransaction(params.id, normalizeTransactionInput(body));

  return NextResponse.json({ ok: true, data: updated });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  if (!isAdminFromCookieStore()) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  deleteTransaction(params.id);
  return NextResponse.json({ ok: true });
}
