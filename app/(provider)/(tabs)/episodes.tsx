import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { api } from "../../../_lib/api";
import { fetchProviderMe, type ProviderMe } from "../../../_lib/provider";
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

type EpisodeRow = {
  id: number;
  title: string;
  status: string;
  created_at: string;
  patient_id: number;
  owner_provider_id: number;
};

type FilterMode = "all" | "owned" | "referred";

function fmt(iso: string) {
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

function statusMeta(status: string) {
  const s = String(status || "").toLowerCase();

  if (s === "open" || s === "active") {
    return {
      label: "Activ",
      bg: COLORS.softGreen,
      text: COLORS.success,
    };
  }

  if (s === "in_progress") {
    return {
      label: "În desfășurare",
      bg: COLORS.softBlue,
      text: COLORS.primary,
    };
  }

  if (s === "closed" || s === "completed" || s === "archived") {
    return {
      label: String(status || "").replaceAll("_", " "),
      bg: COLORS.softGray,
      text: COLORS.muted,
    };
  }

  if (s === "canceled") {
    return {
      label: "Anulat",
      bg: COLORS.softRed,
      text: COLORS.error,
    };
  }

  return {
    label: String(status || "Necunoscut").replaceAll("_", " "),
    bg: COLORS.softGray,
    text: COLORS.muted,
  };
}

function filterTitle(mode: FilterMode) {
  if (mode === "owned") return "Episoadele mele";
  if (mode === "referred") return "Episoade referral";
  return "Toate episoadele";
}

function filterDescription(mode: FilterMode) {
  if (mode === "owned") {
    return "Vezi episoadele în care clinica sau furnizorul tău este owner principal.";
  }
  if (mode === "referred") {
    return "Vezi episoadele venite prin referral sau accesibile indirect.";
  }
  return "Ai o privire completă asupra episoadelor disponibile pentru contul curent.";
}

function emptyMessage(mode: FilterMode) {
  if (mode === "owned") return "Nu există episoade proprii în acest moment.";
  if (mode === "referred")
    return "Nu există episoade referral în acest moment.";
  return "Nu există episoade disponibile.";
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
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        height: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? COLORS.primary : "#fff",
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
      }}
    >
      <Text
        style={{
          fontWeight: "900",
          color: active ? "#fff" : COLORS.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
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

function EpisodeCard({
  episode,
  isOwned,
  onOpen,
}: {
  episode: EpisodeRow;
  isOwned: boolean;
  onOpen: (id: number) => void;
}) {
  const badge = statusMeta(episode.status);

  return (
    <Pressable
      onPress={() => onOpen(episode.id)}
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
            {episode.title}
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            Episod #{episode.id}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: badge.bg,
          }}
        >
          <Text
            style={{
              color: badge.text,
              fontWeight: "900",
              fontSize: 12,
              textTransform: "capitalize",
            }}
          >
            {badge.label}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 14,
          borderRadius: 16,
          backgroundColor: COLORS.softGray,
          padding: 14,
        }}
      >
        <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 14 }}>
          Pacient #{episode.patient_id}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Owner provider #{episode.owner_provider_id}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Creat la: {fmt(episode.created_at)}
        </Text>
      </View>

      <View
        style={{
          marginTop: 12,
          borderRadius: 14,
          backgroundColor: isOwned ? COLORS.softBlue : COLORS.softAmber,
          padding: 12,
        }}
      >
        <Text
          style={{
            color: isOwned ? COLORS.primary : COLORS.warning,
            fontWeight: "800",
          }}
        >
          {isOwned
            ? "Episod propriu al clinicii / furnizorului tău"
            : "Episod accesibil prin referral sau altă relație de acces"}
        </Text>
      </View>

      <View
        style={{
          marginTop: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ color: COLORS.muted, fontSize: 12 }}>
          Apasă pentru timeline și detalii
        </Text>

        <Text style={{ color: COLORS.primary, fontWeight: "900" }}>
          Deschide episodul →
        </Text>
      </View>
    </Pressable>
  );
}

export default function ProviderEpisodes() {
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [providerMe, setProviderMe] = useState<ProviderMe | null>(null);
  const [mode, setMode] = useState<FilterMode>("all");

  const loadProviderMe = useCallback(async () => {
    try {
      const p = await fetchProviderMe();
      setProviderMe(p);
    } catch (e: any) {
      const status = e?.response?.status;

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      console.log(
        "[EPISODES] fetchProviderMe failed:",
        e?.message,
        e?.response?.data,
      );
    }
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setBusy(true);

    try {
      const res = await api.get("/care-episodes/");
      setEpisodes((res.data ?? []) as EpisodeRow[]);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.message || "Load failed";
      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProviderMe();
      load();
    }, [load, loadProviderMe]),
  );

  const myProviderId = providerMe?.id ?? null;

  const filtered = useMemo(() => {
    const list = episodes ?? [];

    if (mode === "all") return list;

    if (!myProviderId) return list;

    if (mode === "owned") {
      return list.filter((ep) => ep.owner_provider_id === myProviderId);
    }

    return list.filter((ep) => ep.owner_provider_id !== myProviderId);
  }, [episodes, mode, myProviderId]);

  const ownedCount = useMemo(() => {
    if (!myProviderId) return 0;
    return (episodes ?? []).filter(
      (ep) => ep.owner_provider_id === myProviderId,
    ).length;
  }, [episodes, myProviderId]);

  const referredCount = useMemo(() => {
    if (!myProviderId) return 0;
    return (episodes ?? []).filter(
      (ep) => ep.owner_provider_id !== myProviderId,
    ).length;
  }, [episodes, myProviderId]);

  const openCount = useMemo(() => {
    return (episodes ?? []).filter((ep) => {
      const s = String(ep.status || "").toLowerCase();
      return s === "open" || s === "active" || s === "in_progress";
    }).length;
  }, [episodes]);

  const summaryText = useMemo(() => {
    if (filtered.length === 0) return emptyMessage(mode);
    if (filtered.length === 1) return "Ai 1 episod în filtrul selectat.";
    return `Ai ${filtered.length} episoade în filtrul selectat.`;
  }, [filtered.length, mode]);

  function openEpisode(id: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: { id: String(id) },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 28,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
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
              EPISOADE
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
              Timeline-ul medical,
              {"\n"}
              clar și accesibil.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
                maxWidth: "88%",
              }}
            >
              Intră rapid în episoadele active, proprii sau accesibile prin
              referral, și urmărește evoluția fiecărui caz.
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
          <SummaryCard label="Total episoade" value={episodes.length} />
          <SummaryCard label="Episoade active" value={openCount} />
          <SummaryCard label="Owned" value={ownedCount} />
          <SummaryCard label="Referred" value={referredCount} />
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
            title="Filtrare episoade"
            subtitle={filterDescription(mode)}
            actionLabel="Reîncarcă"
            onPress={load}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <FilterChip
              label="Toate"
              active={mode === "all"}
              onPress={() => setMode("all")}
            />
            <FilterChip
              label="Owned"
              active={mode === "owned"}
              onPress={() => setMode("owned")}
            />
            <FilterChip
              label="Referred"
              active={mode === "referred"}
              onPress={() => setMode("referred")}
            />
          </View>
        </View>

        <SectionHeader title={filterTitle(mode)} subtitle={summaryText} />

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
              Se încarcă episoadele...
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
        ) : filtered.length === 0 ? (
          <EmptyCard
            title={emptyMessage(mode)}
            subtitle="Când vor exista episoade în această categorie, le vei vedea aici într-o listă clară și ușor de urmărit."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((ep) => (
              <EpisodeCard
                key={ep.id}
                episode={ep}
                isOwned={
                  !!myProviderId && ep.owner_provider_id === myProviderId
                }
                onOpen={openEpisode}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
