import { TransactionInput, TransactionType } from "@/types/portfolio";

const CASH_FLOW_TYPES: TransactionType[] = ["CASH_IN", "CASH_OUT", "DIVIDEND"];

export function normalizeTransactionInput(input: TransactionInput): TransactionInput {
  return {
    ...input,
    asset: input.asset.trim().toUpperCase(),
    currency: input.currency.trim().toUpperCase(),
    note: input.note?.trim() ? input.note.trim() : null
  };
}

export function transactionCashAmount(input: TransactionInput) {
  const gross = input.quantity * input.price;

  switch (input.type) {
    case "BUY":
      return -(gross + input.fees);
    case "SELL":
      return gross - input.fees;
    case "DIVIDEND":
      return gross - input.fees;
    case "CASH_IN":
      return gross - input.fees;
    case "CASH_OUT":
      return -(gross + input.fees);
    default:
      return 0;
  }
}

export function isCashFlowType(type: TransactionType) {
  return CASH_FLOW_TYPES.includes(type);
}
