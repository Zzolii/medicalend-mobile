// Path: medicalend-mobile/app/(provider)/(tabs)/staff.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  fetchProviderStructure,
  type ProviderDoctorOut,
} from "../../../_lib/providerStructure";
import {
  createClinicStaff,
  deleteClinicStaff,
  fetchClinicStaff,
  updateClinicStaff,
  type ClinicStaffRole,
  type ClinicStaffRow,
} from "../../../_lib/users";

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

const ROLE_OPTIONS: ClinicStaffRole[] = [
  "doctor",
  "reception",
  "assistant",
  "clinic_admin",
];

function roleLabel(role?: string | null) {
  switch (role) {
    case "clinic_admin":
      return "Administrator clinică";
    case "doctor":
      return "Medic";
    case "assistant":
      return "Asistent";
    case "reception":
      return "Recepție";
    default:
      return role || "-";
  }
}

function statusLabel(active?: boolean) {
  return active ? "Activ" : "Inactiv";
}

function statusMeta(active?: boolean) {
  return active
    ? {
        label: "Activ",
        bg: COLORS.softGreen,
        text: COLORS.success,
      }
    : {
        label: "Inactiv",
        bg: COLORS.softRed,
        text: COLORS.error,
      };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ro-RO");
  } catch {
    return value;
  }
}

function doctorDisplayName(doctor?: ProviderDoctorOut | null) {
  if (!doctor) return "-";
  const title = doctor.title?.trim() ? `${doctor.title.trim()} ` : "";
  return `${title}${doctor.name}`.trim();
}

function cleanDisplayName(value: string) {
  return value.trim();
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text style={{ marginTop: 12, marginBottom: 6, color: COLORS.muted }}>
      {children}
    </Text>
  );
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

function RolePicker({
  value,
  onChange,
}: {
  value: ClinicStaffRole;
  onChange: (next: ClinicStaffRole) => void;
}) {
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {ROLE_OPTIONS.map((role) => {
        const active = value === role;
        return (
          <Pressable
            key={role}
            onPress={() => onChange(role)}
            style={{
              minHeight: 46,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: active ? COLORS.softBlue : "#fff",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontWeight: "900", color: COLORS.text }}>
              {roleLabel(role)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DoctorPicker({
  doctors,
  value,
  onChange,
}: {
  doctors: ProviderDoctorOut[];
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <View style={{ marginTop: 10, gap: 8 }}>
      {doctors.length === 0 ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            padding: 12,
          }}
        >
          <Text style={{ color: COLORS.muted }}>
            Nu există încă medici definiți în structura clinicii.
          </Text>
        </View>
      ) : (
        doctors.map((doctor) => {
          const active = value === doctor.id;
          return (
            <Pressable
              key={doctor.id}
              onPress={() => onChange(doctor.id)}
              style={{
                minHeight: 48,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: active ? COLORS.softBlue : "#fff",
                justifyContent: "center",
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontWeight: "900", color: COLORS.text }}>
                {doctorDisplayName(doctor)}
              </Text>
              <Text style={{ marginTop: 4, color: COLORS.muted }}>
                {doctor.specialty_name ||
                  `Specializare #${doctor.specialty_id}`}
              </Text>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

function StaffCard({
  item,
  onEdit,
  onDelete,
}: {
  item: ClinicStaffRow;
  onEdit: (item: ClinicStaffRow) => void;
  onDelete: (item: ClinicStaffRow) => void;
}) {
  const userStatus = statusMeta(item.user_is_active);
  const membershipStatus = statusMeta(item.membership_is_active);
  const visibleName = item.display_name?.trim();

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
          {visibleName ? (
            <Text
              style={{
                color: COLORS.text,
                fontWeight: "900",
                fontSize: 16,
                lineHeight: 22,
              }}
            >
              {visibleName}
            </Text>
          ) : null}

          <Text
            style={{
              marginTop: visibleName ? 4 : 0,
              color: visibleName ? COLORS.muted : COLORS.text,
              fontWeight: visibleName ? "700" : "900",
              fontSize: visibleName ? 13 : 16,
              lineHeight: 22,
            }}
          >
            {item.email}
          </Text>

          <Text
            style={{
              marginTop: 6,
              color: COLORS.muted,
              lineHeight: 20,
            }}
          >
            Rol clinică: {roleLabel(item.clinic_role)}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: userStatus.bg,
          }}
        >
          <Text
            style={{
              color: userStatus.text,
              fontWeight: "900",
              fontSize: 12,
            }}
          >
            {userStatus.label}
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
        {visibleName ? (
          <Text style={{ color: COLORS.text, fontWeight: "900", fontSize: 14 }}>
            Nume afișat pacientului: {visibleName}
          </Text>
        ) : (
          <Text
            style={{ color: COLORS.warning, fontWeight: "900", fontSize: 14 }}
          >
            Nume afișat pacientului: necompletat
          </Text>
        )}

        {item.clinic_role === "doctor" ? (
          <Text
            style={{
              marginTop: 6,
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 14,
            }}
          >
            Medic asociat: {item.provider_doctor_name || "-"}
          </Text>
        ) : (
          <Text
            style={{
              marginTop: 6,
              color: COLORS.text,
              fontWeight: "900",
              fontSize: 14,
            }}
          >
            Rol operațional: {roleLabel(item.clinic_role)}
          </Text>
        )}

        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Rol global: {item.global_role}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Status user: {statusLabel(item.user_is_active)}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Status membership: {membershipStatus.label}
        </Text>

        <Text style={{ marginTop: 6, color: COLORS.muted }}>
          Creat la: {formatDate(item.created_at)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Pressable
          onPress={() => onEdit(item)}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.text }}>
            Editează
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onDelete(item)}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#FECACA",
            backgroundColor: "#FFF5F5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontWeight: "900", color: COLORS.error }}>Șterge</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProviderStaffScreen() {
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ClinicStaffRow[]>([]);
  const [doctors, setDoctors] = useState<ProviderDoctorOut[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<ClinicStaffRole>("doctor");
  const [createDoctorId, setCreateDoctorId] = useState<number | null>(null);
  const [createDisplayName, setCreateDisplayName] = useState("");
  const [createActive, setCreateActive] = useState(true);

  const [editingItem, setEditingItem] = useState<ClinicStaffRow | null>(null);
  const [editRole, setEditRole] = useState<ClinicStaffRole>("doctor");
  const [editDoctorId, setEditDoctorId] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editActive, setEditActive] = useState(true);

  const load = useCallback(async () => {
    try {
      setBusy(true);
      setError(null);

      const [rows, structure] = await Promise.all([
        fetchClinicStaff(),
        fetchProviderStructure(),
      ]);

      setItems(rows ?? []);
      setDoctors(structure?.doctors ?? []);
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Încărcarea personalului a eșuat.";
      setError(String(detail));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.email.localeCompare(b.email));
  }, [items]);

  const activeCount = useMemo(
    () => items.filter((item) => !!item.user_is_active).length,
    [items],
  );

  const doctorCount = useMemo(
    () => items.filter((item) => item.clinic_role === "doctor").length,
    [items],
  );

  const adminCount = useMemo(
    () => items.filter((item) => item.clinic_role === "clinic_admin").length,
    [items],
  );

  function openCreate() {
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("doctor");
    setCreateDoctorId(doctors.length > 0 ? doctors[0].id : null);
    setCreateDisplayName("");
    setCreateActive(true);
    setCreateOpen(true);
  }

  function openEdit(item: ClinicStaffRow) {
    setEditingItem(item);
    setEditRole((item.clinic_role as ClinicStaffRole) || "doctor");
    setEditDoctorId(item.provider_doctor_id ?? null);
    setEditDisplayName(item.display_name ?? "");
    setEditPassword("");
    setEditActive(!!item.user_is_active);
    setEditOpen(true);
  }

  function handleCreateRoleChange(next: ClinicStaffRole) {
    setCreateRole(next);

    if (next !== "doctor") {
      setCreateDoctorId(null);
      return;
    }

    setCreateDoctorId(
      (prev) => prev ?? (doctors.length > 0 ? doctors[0].id : null),
    );
  }

  function handleEditRoleChange(next: ClinicStaffRole) {
    setEditRole(next);

    if (next !== "doctor") {
      setEditDoctorId(null);
      return;
    }

    setEditDoctorId(
      (prev) => prev ?? (doctors.length > 0 ? doctors[0].id : null),
    );
  }

  async function handleCreate() {
    if (submitBusy) return;

    const nextDisplayName = cleanDisplayName(createDisplayName);

    if (!createEmail.trim()) {
      Alert.alert("Date lipsă", "Introdu adresa de e-mail.");
      return;
    }

    if (createPassword.trim().length < 8) {
      Alert.alert(
        "Parolă invalidă",
        "Parola trebuie să aibă minimum 8 caractere.",
      );
      return;
    }

    if (createRole === "assistant" && !nextDisplayName) {
      Alert.alert(
        "Date lipsă",
        "Pentru asistent trebuie să introduci numele afișat pacientului.",
      );
      return;
    }

    if (createRole === "doctor" && !createDoctorId) {
      Alert.alert(
        "Date lipsă",
        "Pentru rolul de medic trebuie să selectezi un medic din structura clinicii.",
      );
      return;
    }

    try {
      setSubmitBusy(true);

      const created = await createClinicStaff({
        email: createEmail.trim(),
        password: createPassword,
        clinic_role: createRole,
        provider_doctor_id: createRole === "doctor" ? createDoctorId : null,
        display_name: nextDisplayName || null,
        is_active: createActive,
      });

      setItems((prev) => [...prev, created]);
      setCreateOpen(false);
      Alert.alert("Succes", "Utilizatorul a fost creat.");
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Crearea utilizatorului a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setSubmitBusy(false);
    }
  }

  async function handleEdit() {
    if (!editingItem || submitBusy) return;

    const nextDisplayName = cleanDisplayName(editDisplayName);

    if (editPassword.trim().length > 0 && editPassword.trim().length < 8) {
      Alert.alert(
        "Parolă invalidă",
        "Parola trebuie să aibă minimum 8 caractere.",
      );
      return;
    }

    if (editRole === "assistant" && !nextDisplayName) {
      Alert.alert(
        "Date lipsă",
        "Pentru asistent trebuie să introduci numele afișat pacientului.",
      );
      return;
    }

    if (editRole === "doctor" && !editDoctorId) {
      Alert.alert(
        "Date lipsă",
        "Pentru rolul de medic trebuie să selectezi un medic din structura clinicii.",
      );
      return;
    }

    try {
      setSubmitBusy(true);

      const updated = await updateClinicStaff(editingItem.user_id, {
        clinic_role: editRole,
        provider_doctor_id: editRole === "doctor" ? editDoctorId : null,
        display_name: nextDisplayName || null,
        is_active: editActive,
        password: editPassword.trim() ? editPassword : undefined,
      });

      setItems((prev) =>
        prev.map((row) => (row.user_id === updated.user_id ? updated : row)),
      );

      setEditOpen(false);
      setEditingItem(null);
      Alert.alert("Succes", "Utilizatorul a fost actualizat.");
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Actualizarea utilizatorului a eșuat.";
      Alert.alert("Eroare", String(detail));
    } finally {
      setSubmitBusy(false);
    }
  }

  function handleDelete(item: ClinicStaffRow) {
    Alert.alert(
      "Ștergere utilizator",
      `Sigur vrei să ștergi utilizatorul ${item.email}?`,
      [
        { text: "Renunță", style: "cancel" },
        {
          text: "Șterge",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteClinicStaff(item.user_id);
              setItems((prev) =>
                prev.filter((row) => row.user_id !== item.user_id),
              );
            } catch (e: any) {
              const detail =
                e?.response?.data?.detail ||
                e?.message ||
                "Ștergerea utilizatorului a eșuat.";
              Alert.alert("Eroare", String(detail));
            }
          },
        },
      ],
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
              PERSONAL
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
              Echipa clinicii,
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
              Administrează utilizatorii clinicii, rolurile operaționale și
              legătura cu medicii definiți în structură.
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
          <SummaryCard label="Total utilizatori" value={items.length} />
          <SummaryCard label="Utilizatori activi" value={activeCount} />
          <SummaryCard label="Medici" value={doctorCount} />
          <SummaryCard label="Administratori" value={adminCount} />
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
            title="Administrare personal"
            subtitle="Poți adăuga utilizatori noi, edita rolurile existente și șterge conturile care nu mai sunt necesare."
            actionLabel="Reîncarcă"
            onPress={load}
          />

          <Pressable
            onPress={openCreate}
            style={{
              height: 48,
              borderRadius: 14,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              + Adaugă utilizator
            </Text>
          </Pressable>
        </View>

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
              Se încarcă personalul clinicii...
            </Text>
          </View>
        ) : error ? (
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
              {error}
            </Text>
          </View>
        ) : sortedItems.length === 0 ? (
          <EmptyCard
            title="Nu există încă utilizatori în clinică"
            subtitle="Când vei adăuga membri noi în echipă, aceștia vor apărea aici într-o listă clară și ușor de gestionat."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {sortedItems.map((item) => (
              <StaffCard
                key={item.membership_id}
                item={item}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={createOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submitBusy && setCreateOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              maxHeight: "92%",
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text
                style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
              >
                Adaugă utilizator
              </Text>

              <FieldLabel>E-mail</FieldLabel>
              <TextInput
                value={createEmail}
                onChangeText={setCreateEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="utilizator@clinica.ro"
                editable={!submitBusy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />

              <FieldLabel>Nume afișat pacientului</FieldLabel>
              <TextInput
                value={createDisplayName}
                onChangeText={setCreateDisplayName}
                placeholder="Ex.: As. med. Maria Popescu"
                editable={!submitBusy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />
              <Text
                style={{ marginTop: 6, color: COLORS.muted, lineHeight: 19 }}
              >
                Acest nume va fi afișat pacientului în programările Home Care.
                Pentru asistenți este obligatoriu.
              </Text>

              <FieldLabel>Parolă</FieldLabel>
              <TextInput
                value={createPassword}
                onChangeText={setCreatePassword}
                secureTextEntry
                placeholder="Minimum 8 caractere"
                editable={!submitBusy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />

              <FieldLabel>Rol clinică</FieldLabel>
              <RolePicker
                value={createRole}
                onChange={handleCreateRoleChange}
              />

              {createRole === "doctor" ? (
                <>
                  <FieldLabel>Medic asociat</FieldLabel>
                  <DoctorPicker
                    doctors={doctors}
                    value={createDoctorId}
                    onChange={setCreateDoctorId}
                  />
                </>
              ) : null}

              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                  Utilizator activ
                </Text>
                <Switch value={createActive} onValueChange={setCreateActive} />
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <Pressable
                  onPress={() => setCreateOpen(false)}
                  disabled={submitBusy}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: submitBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>
                    Anulează
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleCreate}
                  disabled={submitBusy}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: COLORS.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: submitBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#fff" }}>
                    {submitBusy ? "Se salvează..." : "Creează"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !submitBusy && setEditOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              maxHeight: "92%",
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text
                style={{ fontSize: 18, fontWeight: "900", color: COLORS.text }}
              >
                Editează utilizator
              </Text>

              <Text style={{ marginTop: 10, color: COLORS.muted }}>
                {editingItem?.email || "-"}
              </Text>

              <FieldLabel>Nume afișat pacientului</FieldLabel>
              <TextInput
                value={editDisplayName}
                onChangeText={setEditDisplayName}
                placeholder="Ex.: As. med. Maria Popescu"
                editable={!submitBusy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />
              <Text
                style={{ marginTop: 6, color: COLORS.muted, lineHeight: 19 }}
              >
                Acest nume va fi afișat pacientului în programările Home Care.
                Pentru asistenți este obligatoriu.
              </Text>

              <FieldLabel>Rol clinică</FieldLabel>
              <RolePicker value={editRole} onChange={handleEditRoleChange} />

              {editRole === "doctor" ? (
                <>
                  <FieldLabel>Medic asociat</FieldLabel>
                  <DoctorPicker
                    doctors={doctors}
                    value={editDoctorId}
                    onChange={setEditDoctorId}
                  />
                </>
              ) : null}

              <FieldLabel>Parolă nouă (opțional)</FieldLabel>
              <TextInput
                value={editPassword}
                onChangeText={setEditPassword}
                secureTextEntry
                placeholder="Lasă gol dacă nu vrei resetare"
                editable={!submitBusy}
                style={{
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  paddingHorizontal: 12,
                  backgroundColor: "#fff",
                  color: COLORS.text,
                }}
              />

              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                  Utilizator activ
                </Text>
                <Switch value={editActive} onValueChange={setEditActive} />
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                <Pressable
                  onPress={() => setEditOpen(false)}
                  disabled={submitBusy}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                    backgroundColor: "#fff",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: submitBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: COLORS.text }}>
                    Anulează
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleEdit}
                  disabled={submitBusy}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: COLORS.primary,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: submitBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#fff" }}>
                    {submitBusy ? "Se salvează..." : "Salvează"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
