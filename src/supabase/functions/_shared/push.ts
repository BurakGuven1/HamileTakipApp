const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";

export type PushCandidate = {
  dedupeKey: string;
  kind: string;
  tokenId: string;
  token: string;
  userId: string;
  message: Record<string, unknown>;
};

type DeliveryRow = {
  id: string;
  attempts: number;
  status: "pending" | "ticketed" | "delivered" | "failed";
  updated_at: string;
};

type ExpoTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

export async function dispatchPushes(
  supabase: any,
  candidates: PushCandidate[],
) {
  await reconcileExpoReceipts(supabase);

  const uniqueCandidates = new Map<string, PushCandidate>();
  for (const candidate of candidates) {
    uniqueCandidates.set(
      `${candidate.dedupeKey}:${candidate.tokenId}`,
      candidate,
    );
  }

  const claimed = (
    await Promise.all(
      [...uniqueCandidates.values()].map(async (candidate) => {
        const delivery = await claimDelivery(supabase, candidate);
        return delivery ? { candidate, delivery } : null;
      }),
    )
  ).filter(Boolean) as { candidate: PushCandidate; delivery: DeliveryRow }[];

  let ticketed = 0;
  let failed = 0;

  for (let index = 0; index < claimed.length; index += 100) {
    const batch = claimed.slice(index, index + 100);
    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify(
          batch.map(({ candidate }) => ({
            ...candidate.message,
            to: candidate.token,
          })),
        ),
      });

      if (!response.ok) {
        const reason = `expo_http_${response.status}:${await response.text()}`;
        await markBatchFailed(supabase, batch, reason);
        failed += batch.length;
        continue;
      }

      const payload = await response.json();
      const tickets = (Array.isArray(payload?.data)
        ? payload.data
        : [payload?.data]) as ExpoTicket[];

      await Promise.all(
        batch.map(async ({ candidate, delivery }, batchIndex) => {
          const ticket = tickets[batchIndex];
          if (ticket?.status === "ok" && ticket.id) {
            ticketed += 1;
            await supabase
              .from("notification_deliveries")
              .update({
                status: "ticketed",
                expo_ticket_id: ticket.id,
                error: null,
              })
              .eq("id", delivery.id);
            return;
          }

          failed += 1;
          const errorCode = ticket?.details?.error ?? "ExpoTicketError";
          const reason = `${errorCode}:${ticket?.message ?? "Push kabul edilmedi"}`;
          await markDeliveryFailed(supabase, delivery.id, reason, errorCode);
          if (errorCode === "DeviceNotRegistered") {
            await disableToken(supabase, candidate.tokenId, reason);
          }
        }),
      );
    } catch (error) {
      await markBatchFailed(supabase, batch, String(error));
      failed += batch.length;
    }
  }

  return {
    candidates: uniqueCandidates.size,
    claimed: claimed.length,
    ticketed,
    failed,
  };
}

async function claimDelivery(supabase: any, candidate: PushCandidate) {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert({
      dedupe_key: candidate.dedupeKey,
      user_id: candidate.userId,
      push_token_id: candidate.tokenId,
      kind: candidate.kind,
    })
    .select("id,status,attempts,updated_at")
    .maybeSingle();

  if (!error && data) return data as DeliveryRow;
  if (error?.code !== "23505") {
    console.error("notification delivery claim failed", error);
    return null;
  }

  const { data: existing } = await supabase
    .from("notification_deliveries")
    .select("id,status,attempts,updated_at")
    .eq("dedupe_key", candidate.dedupeKey)
    .eq("push_token_id", candidate.tokenId)
    .maybeSingle();

  if (!existing || existing.attempts >= 3) return null;

  const stalePending =
    existing.status === "pending" &&
    Date.parse(existing.updated_at) < Date.now() - 10 * 60_000;
  if (existing.status !== "failed" && !stalePending) return null;

  const { data: retried } = await supabase
    .from("notification_deliveries")
    .update({
      status: "pending",
      attempts: existing.attempts + 1,
      expo_ticket_id: null,
      error: null,
    })
    .eq("id", existing.id)
    .in("status", ["failed", "pending"])
    .select("id,status,attempts,updated_at")
    .maybeSingle();

  return (retried ?? null) as DeliveryRow | null;
}

async function reconcileExpoReceipts(supabase: any) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: rows, error } = await supabase
    .from("notification_deliveries")
    .select("id,push_token_id,expo_ticket_id")
    .eq("status", "ticketed")
    .not("expo_ticket_id", "is", null)
    .lt("updated_at", cutoff)
    .limit(500);

  if (error || !rows?.length) return;

  for (let index = 0; index < rows.length; index += 300) {
    const batch = rows.slice(index, index + 300);
    try {
      const response = await fetch(EXPO_RECEIPTS_ENDPOINT, {
        method: "POST",
        headers: expoHeaders(),
        body: JSON.stringify({ ids: batch.map((row: any) => row.expo_ticket_id) }),
      });
      if (!response.ok) continue;

      const payload = await response.json();
      const receipts = payload?.data ?? {};
      await Promise.all(
        batch.map(async (row: any) => {
          const receipt = receipts[row.expo_ticket_id] as ExpoTicket | undefined;
          if (!receipt) return;

          if (receipt.status === "ok") {
            await supabase
              .from("notification_deliveries")
              .update({ status: "delivered", delivered_at: new Date().toISOString() })
              .eq("id", row.id);
            return;
          }

          const errorCode = receipt.details?.error ?? "ExpoReceiptError";
          const reason = `${errorCode}:${receipt.message ?? "Teslim edilemedi"}`;
          await markDeliveryFailed(supabase, row.id, reason, errorCode);
          if (errorCode === "DeviceNotRegistered") {
            await disableToken(supabase, row.push_token_id, reason);
          }
        }),
      );
    } catch (error) {
      console.error("Expo receipt reconciliation failed", error);
    }
  }
}

async function markBatchFailed(
  supabase: any,
  batch: { delivery: DeliveryRow }[],
  reason: string,
) {
  await Promise.all(
    batch.map(({ delivery }) =>
      markDeliveryFailed(supabase, delivery.id, reason, "TransportError")
    ),
  );
}

async function markDeliveryFailed(
  supabase: any,
  deliveryId: string,
  reason: string,
  errorCode: string,
) {
  const permanent = [
    "DeviceNotRegistered",
    "MessageTooBig",
    "MessageRateExceeded",
    "MismatchSenderId",
    "InvalidCredentials",
  ].includes(errorCode);

  await supabase
    .from("notification_deliveries")
    .update({
      status: "failed",
      error: reason.slice(0, 1000),
      ...(permanent ? { attempts: 3 } : {}),
    })
    .eq("id", deliveryId);
}

async function disableToken(supabase: any, tokenId: string, reason: string) {
  await supabase
    .from("push_tokens")
    .update({
      enabled: false,
      disabled_at: new Date().toISOString(),
      last_error: reason.slice(0, 1000),
    })
    .eq("id", tokenId);
}

function expoHeaders() {
  const accessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}
