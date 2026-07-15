// Path: medicalend-mobile/app/(provider)/(tabs)/episodes.tsx

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
  patient_name?: string | null;
  owner_provider_name?: string | null;
};

type FilterMode = "all" | "owned" | "referred";

function fmt(iso?: string | null) {
  if (!iso) return "Dată nespecificată";

  try {
    const parsed = new Date(iso);

    if (Number.isNaN(parsed.getTime())) {
      return iso;
    }

    return parsed.toLocaleString("ro-RO", {
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

function cleanText(value?: string | null) {
  return String(value ?? "").trim();
}

function episodePatientName(episode: EpisodeRow) {
  const name = cleanText(episode.patient_name);

  if (name) {
    return name;
  }

  return `Pacient #${episode.patient_id}`;
}

function episodeProviderName(episode: EpisodeRow) {
  const name = cleanText(episode.owner_provider_name);

  if (name) {
    return name;
  }

  return `Furnizor #${episode.owner_provider_id}`;
}

function episodeTitle(episode: EpisodeRow) {
  const title = cleanText(episode.title);

  if (title) {
    return title;
  }

  return `Episod medical pentru ${episodePatientName(episode)}`;
}

function statusMeta(status: string) {
  const normalizedStatus = String(status || "").toLowerCase();

  if (normalizedStatus === "open" || normalizedStatus === "active") {
    return {
      label: "Activ",
      bg: COLORS.softGreen,
      text: COLORS.success,
    };
  }

  if (normalizedStatus === "in_progress") {
    return {
      label: "În desfășurare",
      bg: COLORS.softBlue,
      text: COLORS.primary,
    };
  }

  if (normalizedStatus === "completed") {
    return {
      label: "Finalizat",
      bg: COLORS.softGray,
      text: COLORS.muted,
    };
  }

  if (normalizedStatus === "closed") {
    return {
      label: "Închis",
      bg: COLORS.softGray,
      text: COLORS.muted,
    };
  }

  if (normalizedStatus === "archived") {
    return {
      label: "Arhivat",
      bg: COLORS.softGray,
      text: COLORS.muted,
    };
  }

  if (normalizedStatus === "canceled") {
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
  if (mode === "owned") return "Episoadele clinicii";
  if (mode === "referred") return "Episoade primite prin trimitere";
  return "Toate episoadele";
}

function filterDescription(mode: FilterMode) {
  if (mode === "owned") {
    return "Vezi episoadele în care clinica sau furnizorul tău este responsabilul principal.";
  }

  if (mode === "referred") {
    return "Vezi episoadele accesibile printr-o trimitere sau printr-o altă relație de îngrijire.";
  }

  return "Ai o imagine completă asupra episoadelor disponibile pentru contul curent.";
}

function emptyMessage(mode: FilterMode) {
  if (mode === "owned") {
    return "Nu există episoade proprii în acest moment.";
  }

  if (mode === "referred") {
    return "Nu există episoade primite prin trimitere în acest moment.";
  }

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
        <Text
          style={{
            fontSize: 18,
            fontWeight: "900",
            color: COLORS.text,
          }}
        >
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
        minHeight: 42,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? COLORS.primary : "#fff",
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          fontWeight: "900",
          color: active ? "#fff" : COLORS.text,
          textAlign: "center",
          fontSize: 13,
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
  const patientName = episodePatientName(episode);
  const providerName = episodeProviderName(episode);

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
              fontSize: 17,
              lineHeight: 23,
            }}
          >
            {episodeTitle(episode)}
          </Text>

          <Text
            style={{
              marginTop: 7,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            {patientName}
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
        <Text
          style={{
            color: COLORS.muted,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Pacient
        </Text>

        <Text
          style={{
            marginTop: 5,
            color: COLORS.text,
            fontWeight: "900",
            fontSize: 15,
            lineHeight: 21,
          }}
        >
          {patientName}
        </Text>

        <View
          style={{
            height: 1,
            backgroundColor: COLORS.border,
            marginVertical: 12,
          }}
        />

        <Text
          style={{
            color: COLORS.muted,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Furnizor responsabil
        </Text>

        <Text
          style={{
            marginTop: 5,
            color: COLORS.text,
            fontWeight: "800",
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {providerName}
        </Text>

        <Text
          style={{
            marginTop: 10,
            color: COLORS.muted,
            lineHeight: 20,
          }}
        >
          Creat la {fmt(episode.created_at)}
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
            lineHeight: 20,
          }}
        >
          {isOwned
            ? "Episod coordonat de clinica sau furnizorul tău."
            : "Episod accesibil prin trimitere sau printr-o altă relație de îngrijire."}
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
        <Text
          style={{
            flex: 1,
            color: COLORS.muted,
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          Vezi timeline-ul, programările și documentele asociate.
        </Text>

        <Text
          style={{
            color: COLORS.primary,
            fontWeight: "900",
          }}
        >
          Deschide →
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
      const provider = await fetchProviderMe();
      setProviderMe(provider);
    } catch (error: any) {
      const responseStatus = error?.response?.status;

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
        return;
      }

      console.log(
        "[EPISODES] fetchProviderMe failed:",
        error?.message,
        error?.response?.data,
      );
    }
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setBusy(true);

    try {
      const response = await api.get("/care-episodes/");
      setEpisodes((response.data ?? []) as EpisodeRow[]);
    } catch (error: any) {
      const responseStatus = error?.response?.status;
      const detail =
        error?.response?.data?.detail ||
        error?.message ||
        "Încărcarea episoadelor a eșuat.";

      setErr(String(detail));

      if (responseStatus === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProviderMe();
      void load();
    }, [load, loadProviderMe]),
  );

  const myProviderId = providerMe?.id ?? null;

  const filtered = useMemo(() => {
    const list = episodes ?? [];

    if (mode === "all") {
      return list;
    }

    if (!myProviderId) {
      return list;
    }

    if (mode === "owned") {
      return list.filter(
        (episode) => episode.owner_provider_id === myProviderId,
      );
    }

    return list.filter((episode) => episode.owner_provider_id !== myProviderId);
  }, [episodes, mode, myProviderId]);

  const ownedCount = useMemo(() => {
    if (!myProviderId) return 0;

    return episodes.filter(
      (episode) => episode.owner_provider_id === myProviderId,
    ).length;
  }, [episodes, myProviderId]);

  const referredCount = useMemo(() => {
    if (!myProviderId) return 0;

    return episodes.filter(
      (episode) => episode.owner_provider_id !== myProviderId,
    ).length;
  }, [episodes, myProviderId]);

  const openCount = useMemo(() => {
    return episodes.filter((episode) => {
      const episodeStatus = String(episode.status || "").toLowerCase();

      return (
        episodeStatus === "open" ||
        episodeStatus === "active" ||
        episodeStatus === "in_progress"
      );
    }).length;
  }, [episodes]);

  const summaryText = useMemo(() => {
    if (filtered.length === 0) {
      return emptyMessage(mode);
    }

    if (filtered.length === 1) {
      return "Ai un episod în filtrul selectat.";
    }

    return `Ai ${filtered.length} episoade în filtrul selectat.`;
  }, [filtered.length, mode]);

  function openEpisode(id: number) {
    router.push({
      pathname: "/(provider)/episode/[id]",
      params: {
        id: String(id),
      },
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
              Povestea medicală,
              {"\n"}
              clar organizată.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
                maxWidth: "88%",
              }}
            >
              Găsești pacientul, furnizorul responsabil și întregul parcurs al
              episodului într-un singur loc.
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
          <SummaryCard label="Coordonate de noi" value={ownedCount} />
          <SummaryCard label="Primite prin trimitere" value={referredCount} />
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
              label="Coordonate"
              active={mode === "owned"}
              onPress={() => setMode("owned")}
            />

            <FilterChip
              label="Primite"
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

            <Pressable
              onPress={load}
              style={{
                marginTop: 14,
                height: 44,
                borderRadius: 14,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                }}
              >
                Încearcă din nou
              </Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <EmptyCard
            title={emptyMessage(mode)}
            subtitle="Când vor exista episoade în această categorie, le vei vedea aici cu numele pacientului și furnizorul responsabil."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                isOwned={
                  Boolean(myProviderId) &&
                  episode.owner_provider_id === myProviderId
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
