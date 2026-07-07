import { db } from "@/lib/db";
import type { WalletOwnerType, WalletTxnType } from "@/lib/prisma/enums";

export type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export interface LedgerEntryInput {
  ownerType: WalletOwnerType;
  ownerId: string;
  type: WalletTxnType;
  amountEur: number; // signed: +credit / -debit
  description: string;
  refType?: string;
  refId?: string;
  createdById?: string;
}

/** Read a wallet's balance (0 if it does not exist yet). */
export async function getWalletBalance(ownerType: WalletOwnerType, ownerId: string): Promise<number> {
  const w = await db.wallet.findUnique({ where: { ownerType_ownerId: { ownerType, ownerId } } });
  return w ? Number(w.balanceEur) : 0;
}

/** Apply one ledger entry inside an existing transaction; upserts the wallet, updates cached balance, writes the txn row. */
export async function applyLedgerEntry(tx: TxClient, input: LedgerEntryInput) {
  const wallet = await tx.wallet.upsert({
    where: { ownerType_ownerId: { ownerType: input.ownerType, ownerId: input.ownerId } },
    create: { ownerType: input.ownerType, ownerId: input.ownerId },
    update: {},
  });
  const balanceAfter = Number(wallet.balanceEur) + input.amountEur;
  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceEur: balanceAfter },
  });
  const txn = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: input.type,
      amountEur: input.amountEur,
      balanceAfter,
      description: input.description,
      refType: input.refType,
      refId: input.refId,
      createdById: input.createdById,
    },
  });
  return { walletId: wallet.id, txnId: txn.id, balanceAfter, lowBalanceEur: wallet.lowBalanceEur ? Number(wallet.lowBalanceEur) : null };
}

/** Convenience: credit a wallet in its own transaction (top-up, allowance, manual adjustment). */
export async function creditWallet(input: LedgerEntryInput) {
  return db.$transaction((tx) => applyLedgerEntry(tx as TxClient, input));
}
