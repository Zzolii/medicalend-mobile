// Path: medicalend-mobile/app/(admin)/dashboard.tsx

import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  approveAdminProvider,
  deleteAdminProvider,
  fetchAdminPendingProviders,
  fetchAdminProviders,
  fetchAdminRecentReferrals,
  fetchAdminStats,
  rejectAdminProvider,
  type AdminProviderRow,
  type AdminReferralRow,
  type AdminStats,
} from "../../_lib/admin";
import { clearToken } from "../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#EF4444",
  success: "#16A34A",
  warning: "#D97706",

  softBlue: "#EEF4FF",
  softGreen: "#ECFDF5",
  softRed: "#FEF2F2",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

function safeText(value?: string | null) {
  return value?.trim() ? value : "-";
}

function safeNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("ro-RO");
  } catch {
    return value;
  }
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function isDeletedProvider(item: AdminProviderRow) {
  const reason = normalizeText(item.rejection_reason);

  return (
    item.is_active === false &&
    item.status === "rejected" &&
    reason.includes("deleted/deactivated by platform admin")
  );
}

function visibleProviders(items: AdminProviderRow[]) {
  return items.filter((item) => !isDeletedProvider(item));
}

function statusColor(status?: string | null) {
  if (status === "approved") return COLORS.success;
  if (status === "rejected") return COLORS.error;
  return COLORS.warning;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ color: COLORS.muted, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          marginTop: 6,
          color: COLORS.text,
          fontSize: 24,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.softGray,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ color: COLORS.text, fontWeight: "900" }}>{title}</Text>
      <Text style={{ marginTop: 6, color: COLORS.muted, lineHeight: 20 }}>
        {subtitle}
      </Text>
    </View>
  );
}

function ProviderCard({
  item,
  onApprove,
  onReject,
  onDelete,
  busy,
}: {
  item: AdminProviderRow;
  onApprove: (item: AdminProviderRow) => void;
  onReject: (item: AdminProviderRow) => void;
  onDelete: (item: AdminProviderRow) => void;
  busy: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "900", color: COLORS.text }}>
        {safeText(item.name)}
      </Text>

      <Text style={{ marginTop: 6, color: COLORS.muted }}>
        Status:{" "}
        <Text style={{ fontWeight: "900", color: statusColor(item.status) }}>
          {safeText(item.status)}
        </Text>
      </Text>

      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Tip: {safeText(item.provider_type)}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Email: {safeText(item.email || item.contact_email)}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Telefon: {safeText(item.phone || item.contact_phone)}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Oraș / județ: {safeText(item.city)} / {safeText(item.county)}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        CUI: {safeText(item.cui)}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Reg. comerț: {safeText(item.trade_register_number)}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Conformitate: {item.healthcare_compliance_confirmed ? "Da" : "Nu"}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Acord provider: {item.provider_agreement_accepted ? "Da" : "Nu"}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Activ: {item.is_active === false ? "Nu" : "Da"}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Creat la: {formatDate(item.created_at)}
      </Text>

      {item.rejection_reason ? (
        <Text style={{ marginTop: 8, color: COLORS.error }}>
          Motiv respingere: {item.rejection_reason}
        </Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Pressable
          onPress={() => onApprove(item)}
          disabled={busy || item.status === "approved"}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            backgroundColor: COLORS.success,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || item.status === "approved" ? 0.55 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Aprobă</Text>
        </Pressable>

        <Pressable
          onPress={() => onReject(item)}
          disabled={busy || item.status === "rejected"}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            backgroundColor: COLORS.warning,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy || item.status === "rejected" ? 0.55 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Respinge</Text>
        </Pressable>

        <Pressable
          onPress={() => onDelete(item)}
          disabled={busy}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            backgroundColor: COLORS.error,
            alignItems: "center",
            justifyContent: "center",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>Șterge</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReferralCard({ item }: { item: AdminReferralRow }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <Text style={{ fontWeight: "900", color: COLORS.text }}>
        Referral #{item.id}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Episode: {item.episode_id}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        From provider: {item.from_provider_id}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        To provider: {item.to_provider_id}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Status: {item.status}
      </Text>
      <Text style={{ marginTop: 4, color: COLORS.muted }}>
        Creat la: {formatDate(item.created_at)}
      </Text>
    </View>
  );
}

export default function AdminDashboard() {
  const [busy, setBusy] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingProviders, setPendingProviders] = useState<AdminProviderRow[]>(
    [],
  );
  const [allProviders, setAllProviders] = useState<AdminProviderRow[]>([]);
  const [recentReferrals, setRecentReferrals] = useState<AdminReferralRow[]>(
    [],
  );

  const pendingCount = useMemo(
    () => pendingProviders.filter((x) => x.status === "pending").length,
    [pendingProviders],
  );

  const loadOptionalAdminLists = useCallback(async () => {
    try {
      const pendingRes = await fetchAdminPendingProviders();
      setPendingProviders(visibleProviders(pendingRes ?? []));
    } catch {
      setPendingProviders([]);
    }

    try {
      const allRes = await fetchAdminProviders();
      setAllProviders(visibleProviders(allRes ?? []));
    } catch {
      setAllProviders([]);
    }

    try {
      const referralsRes = await fetchAdminRecentReferrals();
      setRecentReferrals(referralsRes ?? []);
    } catch {
      setRecentReferrals([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setBusy(true);

      const statsRes = await fetchAdminStats();
      setStats(statsRes);

      await loadOptionalAdminLists();
    } catch {
      setStats(null);
      setPendingProviders([]);
      setAllProviders([]);
      setRecentReferrals([]);
    } finally {
      setBusy(false);
    }
  }, [loadOptionalAdminLists]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await clearToken();
    router.replace("/(auth)/login");
  }

  function removeProviderFromLocalLists(providerId: number) {
    setPendingProviders((current) =>
      current.filter((item) => item.id !== providerId),
    );
    setAllProviders((current) =>
      current.filter((item) => item.id !== providerId),
    );
  }

  async function handleApprove(item: AdminProviderRow) {
    try {
      setActionBusy(true);
      await approveAdminProvider(item.id);
      await load();
      Alert.alert("Succes", "Providerul a fost aprobat.");
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "Aprobarea a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setActionBusy(false);
    }
  }

  function handleReject(item: AdminProviderRow) {
    Alert.alert(
      "Respinge provider",
      `Respingi providerul "${safeText(item.name)}"?`,
      [
        { text: "Renunță", style: "cancel" },
        {
          text: "Respinge",
          style: "destructive",
          onPress: async () => {
            try {
              setActionBusy(true);
              await rejectAdminProvider(
                item.id,
                "Respins din dashboard-ul mobil admin.",
              );
              await load();
              Alert.alert("Succes", "Providerul a fost respins.");
            } catch (e: any) {
              const detail =
                e?.response?.data?.detail ||
                e?.message ||
                "Respingerea a eșuat.";
              Alert.alert("Eroare", String(detail));
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  }

  function handleDelete(item: AdminProviderRow) {
    Alert.alert(
      "Ștergere provider",
      `Sigur vrei să ștergi "${safeText(item.name)}"? Providerul, clinica, abonamentele și membership-urile asociate vor fi dezactivate.`,
      [
        { text: "Renunță", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              setActionBusy(true);
              await deleteAdminProvider(item.id);

              removeProviderFromLocalLists(item.id);
              await load();

              Alert.alert("Succes", "Providerul a fost șters.");
            } catch (e: any) {
              const detail =
                e?.response?.data?.detail || e?.message || "Ștergerea a eșuat.";
              Alert.alert("Eroare", String(detail));
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View
        style={{
          paddingTop: 14,
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          backgroundColor: "#fff",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "900", color: COLORS.text }}>
          Admin platformă
        </Text>

        <Pressable
          onPress={load}
          style={{
            height: 36,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Reîncarcă
          </Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10, color: COLORS.muted }}>
            Se încarcă...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <View
            style={{
              backgroundColor: COLORS.primaryDark,
              borderRadius: 24,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: "rgba(255,255,255,0.78)",
                fontWeight: "800",
                fontSize: 13,
              }}
            >
              ADMIN PLATFORMĂ
            </Text>

            <Text
              style={{
                marginTop: 8,
                color: "#fff",
                fontSize: 28,
                lineHeight: 34,
                fontWeight: "900",
              }}
            >
              Platform overview
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
              }}
            >
              Vedere rapidă asupra utilizatorilor, pacienților, providerilor,
              clinicilor, programărilor, documentelor și abonamentelor.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionTitle
              title="Platform overview"
              subtitle="Date încărcate din endpoint-ul /admin/stats."
            />

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <StatCard
                label="Total users"
                value={safeNumber(stats?.total_users)}
              />
              <StatCard
                label="Total patients"
                value={safeNumber(stats?.total_patients)}
              />
              <StatCard
                label="Total providers"
                value={safeNumber(stats?.total_providers)}
              />
              <StatCard
                label="Pending providers"
                value={safeNumber(stats?.pending_providers)}
              />
              <StatCard
                label="Approved providers"
                value={safeNumber(stats?.approved_providers)}
              />
              <StatCard
                label="Rejected providers"
                value={safeNumber(stats?.rejected_providers)}
              />
              <StatCard
                label="Total clinics"
                value={safeNumber(stats?.total_clinics)}
              />
              <StatCard
                label="Active clinics"
                value={safeNumber(stats?.active_clinics)}
              />
              <StatCard
                label="Referrals"
                value={safeNumber(stats?.total_referrals)}
              />
              <StatCard
                label="Appointments total"
                value={safeNumber(stats?.appointments_total)}
              />
              <StatCard
                label="Appointments 7d"
                value={safeNumber(stats?.appointments_7d)}
              />
              <StatCard
                label="Documents"
                value={safeNumber(stats?.documents_total)}
              />
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionTitle
              title="Abonamente"
              subtitle="Indicatori comerciali pentru clinici și planuri."
            />

            <View
              style={{
                marginTop: 12,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <StatCard
                label="Plans"
                value={safeNumber(stats?.total_subscription_plans)}
              />
              <StatCard
                label="Active plans"
                value={safeNumber(stats?.active_subscription_plans)}
              />
              <StatCard
                label="Subscriptions"
                value={safeNumber(stats?.total_clinic_subscriptions)}
              />
              <StatCard
                label="Active"
                value={safeNumber(stats?.active_subscriptions)}
              />
              <StatCard
                label="Trialing"
                value={safeNumber(stats?.trialing_subscriptions)}
              />
              <StatCard
                label="Expired"
                value={safeNumber(stats?.expired_subscriptions)}
              />
              <StatCard
                label="Canceled"
                value={safeNumber(stats?.canceled_subscriptions)}
              />
              <StatCard
                label="Expiring soon"
                value={safeNumber(stats?.subscriptions_expiring_soon)}
              />
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionTitle
              title="Provider approvals"
              subtitle={`Provideri în așteptare: ${pendingCount}`}
            />

            <View style={{ marginTop: 12, gap: 10 }}>
              {pendingProviders.length === 0 ? (
                <EmptyCard
                  title="Nu există provideri în așteptare"
                  subtitle="Când un provider nou cere aprobare, va apărea aici."
                />
              ) : (
                pendingProviders.map((item) => (
                  <ProviderCard
                    key={item.id}
                    item={item}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onDelete={handleDelete}
                    busy={actionBusy}
                  />
                ))
              )}
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionTitle
              title="Toți providerii"
              subtitle="Listă administrativă scurtă pentru verificări rapide."
            />

            <View style={{ marginTop: 12, gap: 10 }}>
              {allProviders.length === 0 ? (
                <EmptyCard
                  title="Nu există provideri disponibili"
                  subtitle="Sau endpoint-ul listei nu este disponibil pe mobil. Overview-ul rămâne funcțional din /admin/stats."
                />
              ) : (
                allProviders.map((item) => (
                  <ProviderCard
                    key={`all-${item.id}`}
                    item={item}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onDelete={handleDelete}
                    busy={actionBusy}
                  />
                ))
              )}
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionTitle
              title="Referraluri recente"
              subtitle="Ultimele trimiteri disponibile pentru admin."
            />

            <View style={{ marginTop: 12, gap: 10 }}>
              {recentReferrals.length === 0 ? (
                <EmptyCard
                  title="Nu există referraluri recente"
                  subtitle="Sau endpoint-ul pentru referraluri recente nu este disponibil pe mobil."
                />
              ) : (
                recentReferrals.map((item) => (
                  <ReferralCard key={item.id} item={item} />
                ))
              )}
            </View>
          </View>

          <View
            style={{
              backgroundColor: COLORS.card,
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <SectionTitle
              title="Acțiuni cont"
              subtitle="Ieșire din contul de administrator."
            />

            <Pressable
              onPress={logout}
              style={{
                marginTop: 14,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: COLORS.primary,
              }}
            >
              <Text style={{ fontWeight: "900", color: "#fff" }}>Ieșire</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
