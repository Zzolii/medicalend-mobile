// Path: medicalend-mobile/app/(patient)/(tabs)/episodes.tsx

import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  fetchPatientDashboard,
  type PatientDashboardOut,
} from "../../../_lib/patient";
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
  softGreen: "#ECFDF5",
  softAmber: "#FFFBEB",
  softGray: "#F8FAFC",
};

function isActiveEpisodeStatus(status?: string | null) {
  return status === "open" || status === "active" || status === "in_progress";
}

function episodeStatusLabel(status?: string | null) {
  switch (status) {
    case "open":
    case "active":
      return "Activ";
    case "in_progress":
      return "În desfășurare";
    case "completed":
      return "Finalizat";
    case "closed":
      return "Închis";
    case "canceled":
      return "Anulat";
    case "archived":
      return "Arhivat";
    default:
      return status || "-";
  }
}

function episodeStatusMeta(status?: string | null) {
  switch (status) {
    case "open":
    case "active":
      return { bg: COLORS.softGreen, text: COLORS.success };
    case "in_progress":
      return { bg: COLORS.softBlue, text: COLORS.primary };
    case "completed":
    case "closed":
    case "archived":
      return { bg: COLORS.softGray, text: COLORS.muted };
    default:
      return { bg: COLORS.softAmber, text: COLORS.warning };
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
  id,
  title,
  status,
  onPress,
}: {
  id: number;
  title: string;
  status: string;
  onPress: () => void;
}) {
  const meta = episodeStatusMeta(status);

  return (
    <Pressable
      onPress={onPress}
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
            {title || `Episod #${id}`}
          </Text>

          <Text style={{ marginTop: 8, color: COLORS.muted }}>
            ID episod: {id}
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
            {episodeStatusLabel(status)}
          </Text>
        </View>
      </View>

      <View
        style={{
          marginTop: 14,
          borderRadius: 16,
          backgroundColor: COLORS.softBlue,
          padding: 14,
        }}
      >
        <Text
          style={{
            color: COLORS.text,
            fontWeight: "800",
            lineHeight: 20,
          }}
        >
          Vezi programările, documentele PDF, notițele și evenimentele active
          din acest episod.
        </Text>
      </View>

      <Text
        style={{
          marginTop: 12,
          color: COLORS.primary,
          fontWeight: "900",
        }}
      >
        Deschide episodul →
      </Text>
    </Pressable>
  );
}

export default function PatientEpisodesTab() {
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<PatientDashboardOut | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setBusy(true);

    try {
      const d = await fetchPatientDashboard();
      setData(d ?? null);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea episoadelor a eșuat.";

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
      load();
    }, [load]),
  );

  const episodes = useMemo(() => {
    return (data?.active_episodes ?? []).filter((ep) =>
      isActiveEpisodeStatus(ep.status),
    );
  }, [data?.active_episodes]);

  const summary = useMemo(() => {
    if (episodes.length === 0) return "Nu ai episoade active în acest moment.";
    if (episodes.length === 1) return "Ai 1 episod activ.";
    return `Ai ${episodes.length} episoade active.`;
  }, [episodes.length]);

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
              right: -30,
              top: -10,
              width: 170,
              height: 170,
              borderRadius: 999,
              backgroundColor: "rgba(79,179,232,0.18)",
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -40,
              bottom: -50,
              width: 190,
              height: 190,
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
              EPISOADE ACTIVE
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
              Cazurile active,
              {"\n"}
              într-un singur loc.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
                maxWidth: "88%",
              }}
            >
              Aici apar doar episoadele active sau în desfășurare. Episoadele
              finalizate rămân în Journey, ca parte din istoricul tău.
            </Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Episoade active"
            subtitle={summary}
            actionLabel="Reîncarcă"
            onPress={load}
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
          ) : episodes.length === 0 ? (
            <EmptyCard
              title="Nu există episoade active"
              subtitle="Când va exista un episod activ sau în desfășurare, îl vei găsi aici. Episoadele finalizate sunt păstrate în Journey."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {episodes.map((ep) => (
                <EpisodeCard
                  key={ep.id}
                  id={ep.id}
                  title={ep.title}
                  status={ep.status}
                  onPress={() =>
                    router.push({
                      pathname: "/(patient)/episode/[id]",
                      params: { id: String(ep.id) },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
