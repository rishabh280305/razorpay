import { createHash } from "crypto";

type MandatePayload = {
  id: string;
  merchantId: string;
  maxAmountPaise: number;
  categories: string[];
  maxQuantity: number;
  expiresAt: string;
  recurringAllowed: boolean;
  approvalThresholdPaise: number;
};

export function canonicalMandateHash(payload: MandatePayload) {
  const canonical = JSON.stringify({
    approvalThresholdPaise: payload.approvalThresholdPaise,
    categories: [...payload.categories].sort(),
    expiresAt: payload.expiresAt,
    id: payload.id,
    maxAmountPaise: payload.maxAmountPaise,
    maxQuantity: payload.maxQuantity,
    merchantId: payload.merchantId,
    recurringAllowed: payload.recurringAllowed
  });
  return createHash("sha256").update(canonical).digest("hex");
}
