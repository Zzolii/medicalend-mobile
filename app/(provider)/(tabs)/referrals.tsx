import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  acceptReferral,
  completeReferral,
  fetchReferralInbox,
  ReferralOut,
  ReferralStatus,
  rejectReferral,
} from "../../../_lib/referrals";
import { clearToken } from "../../../_lib/session";

const COLORS = {
  primary: "#2F6BFF",
  primaryLight: "#4FB3E8",
  primaryDark: "#0F2F6B",

  bg: "#F7F9FC",
  card: "#FFFFFF",
  border: "#E6EAF2",

  text: "#0F172A",
  muted: "#64748B",

  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",

  softBlue: "#EEF4FF",
  softBlueStrong: "#E0ECFF",
  softGreen: "#ECFDF5",
  softRed: "#FEF2F2",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusMeta(status: ReferralStatus) {
  switch (status) {
    case "pending":
      return {
        label: "În așteptare",
        bg: COLORS.softAmber,
        text: COLORS.warning,
      };
    case "accepted":
      return {
        label: "Acceptat",
        bg: COLORS.softBlue,
        text: COLORS.primary,
      };
    case "rejected":
      return {
        label: "Respins",
        bg: COLORS.softRed,
        text: COLORS.error,
      };
    case "completed":
      return {
        label: "Finalizat",
        bg: COLORS.softGreen,
        text: COLORS.success,
      };
    default:
      return {
        label: String(status),
        bg: COLORS.softGray,
        text: COLORS.muted,
      };
  }
}

function filterLabel(value: ReferralStatus | "all") {
  switch (value) {
    case "pending":
      return "În așteptare";
    case "accepted":
      return "Acceptate";
    case "rejected":
      return "Respinse";
    case "completed":
      return "Finalizate";
    case "all":
      return "Toate";
    default:
      return String(value);
  }
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 6,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actionLabel && onPress ? (
        <Pressable onPress={onPress}>
          <Text
            style={{
              color: COLORS.primary,
              fontWeight: "900",
              fontSize: 13,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: "30%",
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? COLORS.primary : "#fff",
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
        paddingHorizontal: 10,
      }}
    >
      <Text
        style={{
          fontWeight: "900",
          color: active ? "#fff" : COLORS.text,
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: "47%",
        backgroundColor: COLORS.card,
        borderRadius: 20,
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

function EmptyCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: COLORS.softBlue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            backgroundColor: COLORS.primary,
          }}
        />
      </View>

      <Text
        style={{
          marginTop: 14,
          fontSize: 16,
          fontWeight: "900",
          color: COLORS.text,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 8,
          color: COLORS.muted,
          lineHeight: 21,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function ReferralCard({
  item,
  actionBusyId,
  onAccept,
  onReject,
  onComplete,
  onOpenEpisode,
}: {
  item: ReferralOut;
  actionBusyId: number | null;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onComplete: (id: number) => void;
  onOpenEpisode: (episodeId: number) => void;
}) {
  const meta = statusMeta(item.status);
  const isBusy = actionBusyId === item.id;

  const canAct = item.status === "pending";
  const canOpen = item.status === "accepted" || item.status === "completed";
  const canComplete = item.status === "accepted";

  return (
    <View
      style={{
        backgroundColor: COLORS.card,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 16,
              lineHeight: 22,
            }}
          >
            Referral #{item.id}
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            Episod #{item.episode_id}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: meta.bg,
          }}
        >
          <Text
            style={{
              color: meta.text,
              fontWeight: "900",
              fontSize: 12,
            }}
          >
            {meta.label}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 14,
          borderRadius: 16,
          backgroundColor: COLORS.softGray,
          padding: 14,
          gap: 8,
        }}
      >
        <Text style={{ color: COLORS.text, lineHeight: 20 }}>
          <Text style={{ fontWeight: "900" }}>Motiv:</Text> {item.reason}
        </Text>

        <Text style={{ color: COLORS.muted }}>
          Creat la: {formatDate(item.created_at)}
        </Text>
      </View>

      {item.status === "rejected" && item.rejection_reason ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: COLORS.softRed,
            padding: 12,
          }}
        >
          <Text style={{ color: COLORS.error, lineHeight: 20 }}>
            <Text style={{ fontWeight: "900" }}>Motiv respingere:</Text>{" "}
            {item.rejection_reason}
          </Text>
        </View>
      ) : null}

      {canOpen ? (
        <Pressable
          onPress={() => onOpenEpisode(item.episode_id)}
          style={{
            marginTop: 14,
            height: 46,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            Deschide episodul
          </Text>
        </Pressable>
      ) : null}

      {canComplete ? (
        <Pressable
          onPress={() => onComplete(item.id)}
          disabled={isBusy}
          style={{
            marginTop: 10,
            height: 46,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.success,
            opacity: isBusy ? 0.65 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {isBusy ? "Se procesează..." : "Marchează ca finalizat"}
          </Text>
        </Pressable>
      ) : null}

      {canAct ? (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={() => onAccept(item.id)}
            disabled={isBusy}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLORS.success,
              opacity: isBusy ? 0.65 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {isBusy ? "..." : "Acceptă"}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onReject(item.id)}
            disabled={isBusy}
            style={{
              flex: 1,
              height: 46,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLORS.error,
              opacity: isBusy ? 0.65 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Respinge</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function ProviderReferralsScreen() {
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<ReferralOut[]>([]);
  const [filter, setFilter] = useState<ReferralStatus | "all">("pending");
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectText, setRejectText] = useState("");

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, rejected: 0, completed: 0 };
    for (const r of items) {
      c[r.status] += 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((r) => r.status === filter);
  }, [items, filter]);

  const summaryText = useMemo(() => {
    if (filter === "all") {
      if (items.length === 0) return "Nu există referraluri în inbox.";
      if (items.length === 1) return "Ai 1 referral în inbox.";
      return `Ai ${items.length} referraluri în inbox.`;
    }

    const count = filtered.length;
    const label = filterLabel(filter).toLowerCase();

    if (count === 0) return `Nu există referraluri ${label}.`;
    if (count === 1) return `Ai 1 referral ${label}.`;
    return `Ai ${count} referraluri ${label}.`;
  }, [filter, filtered.length, items.length]);

  const load = useCallback(async () => {
    setErr(null);
    setBusy(true);

    try {
      const list = await fetchReferralInbox();
      setItems(list ?? []);

      const hasPending = (list ?? []).some((r) => r.status === "pending");
      const hasAccepted = (list ?? []).some((r) => r.status === "accepted");
      const hasCompleted = (list ?? []).some((r) => r.status === "completed");
      const hasRejected = (list ?? []).some((r) => r.status === "rejected");

      const currentEmpty =
        filter !== "all" && !(list ?? []).some((r) => r.status === filter);

      if (currentEmpty) {
        if (hasPending) setFilter("pending");
        else if (hasAccepted) setFilter("accepted");
        else if (hasCompleted) setFilter("completed");
        else if (hasRejected) setFilter("rejected");
        else setFilter("all");
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea referralurilor a eșuat.";
      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onAccept(id: number) {
    try {
      setActionBusyId(id);
      await acceptReferral(id);
      await load();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "Acceptarea a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setActionBusyId(null);
    }
  }

  async function onComplete(id: number) {
    try {
      setActionBusyId(id);
      await completeReferral(id);
      await load();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "Finalizarea a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setActionBusyId(null);
    }
  }

  function openReject(id: number) {
    setRejectId(id);
    setRejectText("");
    setRejectOpen(true);
  }

  async function confirmReject() {
    const id = rejectId;
    const reason = rejectText.trim();

    if (!id) return;

    if (reason.length < 3) {
      Alert.alert(
        "Date lipsă",
        "Te rog introdu cel puțin 3 caractere pentru motivul respingerii.",
      );
      return;
    }

    try {
      setActionBusyId(id);
      await rejectReferral(id, reason);
      setRejectOpen(false);
      setRejectId(null);
      setRejectText("");
      await load();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail || e?.message || "Respingerea a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setActionBusyId(null);
    }
  }

  function openEpisode(episodeId: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: { id: String(episodeId) },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ReferralCard
            item={item}
            actionBusyId={actionBusyId}
            onAccept={onAccept}
            onReject={openReject}
            onComplete={onComplete}
            onOpenEpisode={openEpisode}
          />
        )}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 28,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16 }}>
            <View
              style={{
                backgroundColor: COLORS.primaryDark,
                borderRadius: 28,
                padding: 20,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  right: -40,
                  top: -10,
                  width: 180,
                  height: 180,
                  borderRadius: 999,
                  backgroundColor: "rgba(79,179,232,0.18)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: -30,
                  bottom: -40,
                  width: 180,
                  height: 180,
                  borderRadius: 999,
                  backgroundColor: "rgba(47,107,255,0.16)",
                }}
              />

              <View style={{ zIndex: 2 }}>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.78)",
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  REFERRALS
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
                  Inboxul tău de
                  {"\n"}
                  referraluri.
                </Text>

                <Text
                  style={{
                    marginTop: 12,
                    color: "rgba(255,255,255,0.82)",
                    lineHeight: 21,
                    maxWidth: "88%",
                  }}
                >
                  Acceptă, respinge sau finalizează referralurile primite și
                  intră rapid în episodul asociat.
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <SummaryCard label="În așteptare" value={counts.pending} />
              <SummaryCard label="Acceptate" value={counts.accepted} />
              <SummaryCard label="Finalizate" value={counts.completed} />
              <SummaryCard label="Respinse" value={counts.rejected} />
            </View>

            <View
              style={{
                backgroundColor: COLORS.card,
                borderRadius: 20,
                padding: 16,
                borderWidth: 1,
                borderColor: COLORS.border,
                gap: 12,
              }}
            >
              <SectionHeader
                title="Filtrare inbox"
                subtitle="Selectează rapid categoria pe care vrei să o verifici."
                actionLabel="Reîncarcă"
                onPress={load}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <FilterChip
                  active={filter === "pending"}
                  label="În așteptare"
                  onPress={() => setFilter("pending")}
                />
                <FilterChip
                  active={filter === "accepted"}
                  label="Acceptate"
                  onPress={() => setFilter("accepted")}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <FilterChip
                  active={filter === "completed"}
                  label="Finalizate"
                  onPress={() => setFilter("completed")}
                />
                <FilterChip
                  active={filter === "rejected"}
                  label="Respinse"
                  onPress={() => setFilter("rejected")}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <FilterChip
                  active={filter === "all"}
                  label="Toate"
                  onPress={() => setFilter("all")}
                />
              </View>
            </View>

            <SectionHeader
              title={
                filter === "all" ? "Toate referralurile" : filterLabel(filter)
              }
              subtitle={summaryText}
            />

            {busy ? (
              <View
                style={{
                  backgroundColor: COLORS.card,
                  borderRadius: 20,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text
                  style={{
                    marginTop: 12,
                    color: COLORS.muted,
                    fontWeight: "700",
                  }}
                >
                  Se încarcă referralurile...
                </Text>
              </View>
            ) : err ? (
              <View
                style={{
                  backgroundColor: COLORS.card,
                  borderRadius: 20,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                }}
              >
                <Text
                  style={{
                    color: COLORS.error,
                    fontWeight: "900",
                    fontSize: 16,
                  }}
                >
                  A apărut o eroare
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    color: COLORS.text,
                    lineHeight: 21,
                  }}
                >
                  {err}
                </Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !busy && !err ? (
            <EmptyCard
              title="Nu există elemente în această categorie"
              subtitle="Când vei primi referraluri sau se vor schimba statusurile lor, le vei vedea aici într-o listă clară și ușor de urmărit."
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      <Modal
        visible={rejectOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: COLORS.text,
              }}
            >
              Respinge referralul
            </Text>

            <Text style={{ marginTop: 6, color: COLORS.muted }}>
              Introdu motivul respingerii. Acesta trebuie să aibă minimum 3
              caractere.
            </Text>

            <TextInput
              value={rejectText}
              onChangeText={setRejectText}
              placeholder="Ex.: Nu există capacitate disponibilă în această perioadă"
              multiline
              style={{
                marginTop: 12,
                minHeight: 100,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 12,
                textAlignVertical: "top",
                color: COLORS.text,
                backgroundColor: "#fff",
              }}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={() => setRejectOpen(false)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: "#fff",
                }}
              >
                <Text style={{ fontWeight: "900", color: COLORS.text }}>
                  Renunță
                </Text>
              </Pressable>

              <Pressable
                onPress={confirmReject}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.error,
                }}
              >
                <Text style={{ fontWeight: "900", color: "#fff" }}>
                  Respinge
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
