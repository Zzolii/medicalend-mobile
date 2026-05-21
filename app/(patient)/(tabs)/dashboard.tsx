// Path: medicalend-mobile/app/(patient)/(tabs)/dashboard.tsx
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  softBlueStrong: "#E0ECFF",
  softGreen: "#ECFDF5",
};

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

function appointmentMainLabel(
  next: NonNullable<PatientDashboardOut["next_appointment"]>,
) {
  if (next.provider_name?.trim()) return next.provider_name.trim();
  return "Programare medicală";
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "scheduled":
      return "Programată";
    case "in_progress":
      return "În desfășurare";
    case "completed":
      return "Finalizată";
    case "canceled":
      return "Anulată";
    default:
      return status || "-";
  }
}

function episodeStatusLabel(status?: string | null) {
  switch (status) {
    case "open":
      return "Activ";
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

function buildMapsQuery(
  next: NonNullable<PatientDashboardOut["next_appointment"]>,
) {
  const parts = [next.provider_name?.trim() || "", "Romania"].filter(Boolean);
  return parts.join(", ");
}

function StatusPill({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.18)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 96,
        borderRadius: 18,
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: COLORS.softBlue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: COLORS.primary,
          }}
        />
      </View>

      <View>
        <Text
          style={{
            color: COLORS.text,
            fontWeight: "900",
            fontSize: 14,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 4,
            color: COLORS.muted,
            fontSize: 12,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}>
        {title}
      </Text>

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

function EmptyCard({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
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

      {actionLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={{
            marginTop: 16,
            height: 46,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.primary,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "900" }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PatientDashboard() {
  const [data, setData] = useState<PatientDashboardOut | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mapsBusy, setMapsBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const d = await fetchPatientDashboard();
      setData(d);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea panoului pacientului a eșuat.";
      setErr(String(detail));

      if (status === 401) {
        await clearToken();
        router.replace("/(auth)/login");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAppointments() {
    router.push("/(patient)/(tabs)/appointments");
  }

  function openSearch() {
    router.push("/(patient)/(tabs)/search");
  }

  function openEpisodes() {
    router.push("/(patient)/(tabs)/episodes");
  }

  function openProfile() {
    router.push("/(patient)/(tabs)/profile");
  }

  function openEpisode(id: number) {
    router.push({
      pathname: "/(patient)/episode/[id]",
      params: { id: String(id) },
    });
  }

  function openNextAppointment() {
    const next = data?.next_appointment;
    if (!next?.id) {
      openAppointments();
      return;
    }

    router.push({
      pathname: "/(patient)/appointment/[id]",
      params: { id: String(next.id) },
    });
  }

  async function openInMaps() {
    const next = data?.next_appointment ?? null;
    if (!next) return;

    const query = buildMapsQuery(next);

    if (!query.trim()) {
      Alert.alert(
        "Locație indisponibilă",
        "Nu există suficiente informații pentru a deschide locația în Google Maps.",
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    try {
      setMapsBusy(true);
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert(
          "Eroare",
          "Nu s-a putut deschide Google Maps pe acest dispozitiv.",
        );
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Eroare", "A apărut o problemă la deschiderea hărții.");
    } finally {
      setMapsBusy(false);
    }
  }

  const next = data?.next_appointment ?? null;

  const activeEpisodes = useMemo(
    () => data?.active_episodes ?? [],
    [data?.active_episodes],
  );

  const episodeSummary = useMemo(() => {
    if (activeEpisodes.length === 0) return "Niciun episod activ";
    if (activeEpisodes.length === 1) return "1 episod activ";
    return `${activeEpisodes.length} episoade active`;
  }, [activeEpisodes]);

  if (busy) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text
          style={{
            marginTop: 12,
            textAlign: "center",
            color: COLORS.muted,
            fontWeight: "700",
          }}
        >
          Se încarcă experiența ta MediCalend...
        </Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, padding: 16 }}>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            padding: 18,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Text
            style={{ fontSize: 18, fontWeight: "900", color: COLORS.error }}
          >
            A apărut o eroare
          </Text>
          <Text
            style={{
              marginTop: 8,
              color: COLORS.text,
              lineHeight: 22,
            }}
          >
            {err}
          </Text>

          <Pressable
            onPress={load}
            style={{
              marginTop: 16,
              height: 46,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: COLORS.primary,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>Reîncearcă</Text>
          </Pressable>
        </View>
      </View>
    );
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
              backgroundColor: "rgba(47,107,255,0.18)",
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
              MEDICALEND
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
              Îngrijirea ta,
              {"\n"}
              conectată și clară.
            </Text>

            <Text
              style={{
                marginTop: 12,
                color: "rgba(255,255,255,0.82)",
                lineHeight: 21,
                maxWidth: "88%",
              }}
            >
              Gestionează programările, urmărește episoadele active și găsește
              rapid următorul pas potrivit pentru tine.
            </Text>

            <View
              style={{
                marginTop: 16,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <StatusPill
                label={
                  next ? "Ai o programare viitoare" : "Fără programări viitoare"
                }
              />
              <StatusPill label={episodeSummary} />
            </View>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader title="Acțiuni rapide" />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <QuickAction
              title="Caută servicii"
              subtitle="Explorează clinici, medici și servicii la domiciliu"
              onPress={openSearch}
            />
            <QuickAction
              title="Programările mele"
              subtitle="Vezi toate programările și detaliile lor"
              onPress={openAppointments}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <QuickAction
              title="Episoade medicale"
              subtitle="Urmărește episoadele și istoricul tău medical"
              onPress={openEpisodes}
            />
            <QuickAction
              title="Profilul meu"
              subtitle="Actualizează datele și informațiile personale"
              onPress={openProfile}
            />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Următoarea programare"
            actionLabel="Vezi tot"
            onPress={openAppointments}
          />

          {next ? (
            <Pressable
              onPress={openNextAppointment}
              style={{
                backgroundColor: COLORS.primary,
                borderRadius: 24,
                padding: 18,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  right: -25,
                  bottom: -35,
                  width: 140,
                  height: 140,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              />

              <Text
                style={{
                  color: "rgba(255,255,255,0.78)",
                  fontWeight: "800",
                  fontSize: 12,
                }}
              >
                PROGRAMARE CONFIRMATĂ
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  color: "#fff",
                  fontSize: 21,
                  lineHeight: 27,
                  fontWeight: "900",
                }}
              >
                {appointmentMainLabel(next)}
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                {fmt(next.start_time)}
              </Text>

              <Text
                style={{
                  marginTop: 8,
                  color: "rgba(255,255,255,0.84)",
                }}
              >
                Status: {statusLabel(next.status)}
              </Text>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    openInMaps();
                  }}
                  disabled={mapsBusy}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: mapsBusy ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{ color: COLORS.primaryDark, fontWeight: "900" }}
                  >
                    {mapsBusy ? "Se deschide..." : "Deschide harta"}
                  </Text>
                </Pressable>

                <View
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.22)",
                    backgroundColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900" }}>
                    Vezi detalii
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <EmptyCard
              title="Nu ai încă o programare viitoare"
              subtitle="Poți începe prin a căuta o clinică, un medic sau un serviciu la domiciliu potrivit nevoilor tale."
              actionLabel="Caută acum"
              onPress={openSearch}
            />
          )}
        </View>

        <View style={{ gap: 10 }}>
          <SectionHeader
            title="Episoade active"
            actionLabel={activeEpisodes.length > 0 ? "Vezi tot" : undefined}
            onPress={activeEpisodes.length > 0 ? openEpisodes : undefined}
          />

          {activeEpisodes.length === 0 ? (
            <EmptyCard
              title="Niciun episod activ în acest moment"
              subtitle="Când va exista un episod medical activ, îl vei vedea aici împreună cu istoricul și evoluția lui."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {activeEpisodes.map((ep) => (
                <Pressable
                  key={ep.id}
                  onPress={() => openEpisode(ep.id)}
                  style={{
                    backgroundColor: COLORS.card,
                    borderRadius: 20,
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
                          fontSize: 15,
                          lineHeight: 22,
                        }}
                      >
                        {ep.title}
                      </Text>

                      <Text
                        style={{
                          marginTop: 8,
                          color: COLORS.muted,
                        }}
                      >
                        ID episod: {ep.id}
                      </Text>
                    </View>

                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: COLORS.softGreen,
                      }}
                    >
                      <Text
                        style={{
                          color: COLORS.success,
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {episodeStatusLabel(ep.status)}
                      </Text>
                    </View>
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
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
