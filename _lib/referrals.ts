// Path: medicalend-mobile/_lib/referrals.ts
import { api } from "./api";

export type ReferralStatus = "pending" | "accepted" | "rejected" | "completed";

export type ReferralOut = {
  id: number;
  episode_id: number;
  from_provider_id: number;
  to_provider_id: number;
  reason: string;
  status: ReferralStatus;
  rejection_reason?: string | null;
  created_at: string;
};

export type ReferralCreatePayload = {
  to_provider_id: number;
  reason: string;
};

export async function fetchReferralInbox(): Promise<ReferralOut[]> {
  const res = await api.get("/referrals/inbox");
  return res.data as ReferralOut[];
}

export async function acceptReferral(referralId: number): Promise<ReferralOut> {
  const res = await api.post(`/referrals/${referralId}/accept`);
  return res.data as ReferralOut;
}

export async function rejectReferral(
  referralId: number,
  rejectionReason: string,
): Promise<ReferralOut> {
  const res = await api.post(`/referrals/${referralId}/reject`, {
    rejection_reason: rejectionReason,
  });
  return res.data as ReferralOut;
}

export async function completeReferral(
  referralId: number,
): Promise<ReferralOut> {
  const res = await api.post(`/referrals/${referralId}/complete`);
  return res.data as ReferralOut;
}

/**
 * Owner provider (vagy admin) küld referral-t egy episode-ra
 * Backend: POST /referrals/care-episodes/{episode_id}
 */
export async function createReferralForEpisode(
  episodeId: number,
  payload: ReferralCreatePayload,
): Promise<ReferralOut> {
  const res = await api.post(`/referrals/care-episodes/${episodeId}`, payload);
  return res.data as ReferralOut;
}
