import { useMutation } from "@tanstack/react-query";

import { isSupabaseConfigured, supabase } from "../supabase/client";

export type ClaimBookEntryInput = {
  claimCode: string;
  consumerName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  assetType: "producto" | "servicio";
  complaintType: "reclamo" | "queja";
  orderReference?: string;
  amountClaimed?: number | null;
  currencyCode?: string | null;
  description: string;
  requestedResolution: string;
  truthConfirmation: boolean;
  dataProcessingConfirmation: boolean;
};

export type ClaimBookEntryResult = {
  claimCode: string;
  submittedAt: string;
};

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanRequiredText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function createClaimCode() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomChunk =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);

  return `DM-LR-${stamp}-${randomChunk.toUpperCase()}`;
}

async function submitClaimBookEntry(
  input: ClaimBookEntryInput,
): Promise<ClaimBookEntryResult> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "DarkMoney aun no tiene Supabase publico configurado para recibir reclamos.",
    );
  }

  const submittedAt = new Date().toISOString();
  const normalizedAmount =
    typeof input.amountClaimed === "number" && Number.isFinite(input.amountClaimed)
      ? Number(input.amountClaimed.toFixed(2))
      : null;

  const { error } = await supabase.from("claim_book_entries").insert({
    claim_code: input.claimCode,
    consumer_name: cleanRequiredText(input.consumerName),
    document_type: cleanRequiredText(input.documentType),
    document_number: cleanRequiredText(input.documentNumber),
    email: cleanRequiredText(input.email).toLowerCase(),
    phone: cleanRequiredText(input.phone),
    address: cleanRequiredText(input.address),
    city: cleanRequiredText(input.city),
    asset_type: input.assetType,
    complaint_type: input.complaintType,
    order_reference: cleanOptionalText(input.orderReference),
    amount_claimed: normalizedAmount,
    currency_code: cleanOptionalText(input.currencyCode)?.toUpperCase() ?? null,
    description: cleanRequiredText(input.description),
    requested_resolution: cleanRequiredText(input.requestedResolution),
    truth_confirmation: input.truthConfirmation,
    data_processing_confirmation: input.dataProcessingConfirmation,
    metadata: {
      source: "public_claim_book",
      submitted_at_client: submittedAt,
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      path:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : null,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    claimCode: input.claimCode,
    submittedAt,
  };
}

export function useSubmitClaimBookEntryMutation() {
  return useMutation({
    mutationFn: submitClaimBookEntry,
  });
}
