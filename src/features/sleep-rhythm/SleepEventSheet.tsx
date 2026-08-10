import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarDays, Moon, Sun, Trash2, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import type { BabySleepEvent } from "@/api/sleepRhythm";
import { Button } from "@/components/Button";
import { radii, spacing, typography } from "@/theme";

import {
  combineLocalDateAndTime,
  validateSleepEventCandidate,
  type SleepEventType
} from "./model";
import { sleepRhythmColors as palette } from "./palette";

type DayChoice = "today" | "yesterday" | "custom";

export function SleepEventSheet({
  deleting,
  editingEvent,
  events,
  onClose,
  onDelete,
  onSave,
  serverError,
  saving,
  visible
}: {
  deleting: boolean;
  editingEvent: BabySleepEvent | null;
  events: BabySleepEvent[];
  onClose: () => void;
  onDelete: (event: BabySleepEvent) => void;
  onSave: (input: {
    eventId: string | null;
    eventType: SleepEventType;
    occurredAt: string;
    timezoneOffsetMinutes: number;
  }) => void;
  serverError?: string | null;
  saving: boolean;
  visible: boolean;
}) {
  const [eventType, setEventType] = useState<SleepEventType>("wake");
  const [dayChoice, setDayChoice] = useState<DayChoice>("today");
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()));
  const [selectedTime, setSelectedTime] = useState(() => new Date());
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const base = editingEvent ? new Date(editingEvent.occurred_at) : new Date();
    setEventType(editingEvent?.event_type ?? suggestedEventType(events));
    setSelectedDay(startOfLocalDay(base));
    setSelectedTime(base);
    setDayChoice(dayChoiceFor(base));
    setSubmitted(false);
  }, [editingEvent, events, visible]);

  const occurredAt = useMemo(
    () => combineLocalDateAndTime(selectedDay, selectedTime),
    [selectedDay, selectedTime]
  );
  const validationError = validateSleepEventCandidate(
    events,
    { event_type: eventType, occurred_at: occurredAt.toISOString() },
    editingEvent?.id
  );

  function changeDay(choice: DayChoice) {
    setDayChoice(choice);
    if (choice === "today") setSelectedDay(startOfLocalDay(new Date()));
    if (choice === "yesterday") {
      setSelectedDay(startOfLocalDay(new Date(Date.now() - 86_400_000)));
    }
  }

  function submit() {
    setSubmitted(true);
    if (validationError) return;
    onSave({
      eventId: editingEvent?.id ?? null,
      eventType,
      occurredAt: occurredAt.toISOString(),
      timezoneOffsetMinutes: occurredAt.getTimezoneOffset()
    });
  }

  function confirmDelete() {
    if (!editingEvent) return;
    Alert.alert(
      "Uyku kaydını sil",
      "Bu geçiş silinecek ve uyku seansları kalan kayıtlardan yeniden hesaplanacak.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Sil", style: "destructive", onPress: () => onDelete(editingEvent) }
      ]
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      visible={visible}
    >
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={typography.eyebrow}>{editingEvent ? "KAYDI DÜZENLE" : "GEÇMİŞ KAYIT"}</Text>
            <Text style={typography.heading2}>Uyku kaydı ekle</Text>
          </View>
          <Pressable accessibilityLabel="Kapat" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <X color={palette.text} size={22} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Durum</Text>
          <View style={styles.segmented}>
            <Segment
              active={eventType === "wake"}
              color={palette.awake}
              icon={<Sun color={eventType === "wake" ? "#FFFFFF" : palette.awake} size={19} />}
              label="Uyandı"
              onPress={() => setEventType("wake")}
            />
            <Segment
              active={eventType === "sleep"}
              color={palette.navy}
              icon={<Moon color={eventType === "sleep" ? "#FFFFFF" : palette.navy} size={19} />}
              label="Uyudu"
              onPress={() => setEventType("sleep")}
            />
          </View>

          <Text style={styles.fieldLabel}>Tarih</Text>
          <View style={styles.chips}>
            <Chip active={dayChoice === "today"} label="Bugün" onPress={() => changeDay("today")} />
            <Chip active={dayChoice === "yesterday"} label="Dün" onPress={() => changeDay("yesterday")} />
            <Chip active={dayChoice === "custom"} label="Tarih seç" onPress={() => changeDay("custom")} />
          </View>

          {dayChoice === "custom" ? (
            <View style={styles.pickerCard}>
              <CalendarDays color={palette.mintText} size={21} />
              <DateTimePicker
                display={Platform.OS === "ios" ? "inline" : "default"}
                maximumDate={new Date()}
                mode="date"
                onChange={(_, value) => value && setSelectedDay(startOfLocalDay(value))}
                value={selectedDay}
              />
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>Saat</Text>
          <View style={styles.timePicker}>
            <DateTimePicker
              display={Platform.OS === "ios" ? "spinner" : "default"}
              is24Hour
              locale="tr-TR"
              mode="time"
              onChange={(_, value) => value && setSelectedTime(value)}
              value={selectedTime}
            />
          </View>

          <View accessibilityLiveRegion="polite" style={styles.summary}>
            {eventType === "sleep" ? <Moon color={palette.navy} size={24} /> : <Sun color={palette.awake} size={24} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{eventType === "sleep" ? "Uyudu" : "Uyandı"}</Text>
              <Text style={styles.summaryValue}>{formatReadable(occurredAt)}</Text>
            </View>
          </View>

          {submitted && validationError ? (
            <Text accessibilityLiveRegion="assertive" role="alert" style={styles.errorText}>
              {validationError}
            </Text>
          ) : null}
          {!validationError && serverError ? (
            <Text accessibilityLiveRegion="assertive" role="alert" style={styles.errorText}>
              {serverError}
            </Text>
          ) : null}

          <Button
            disabled={saving}
            label={saving ? "Kaydediliyor…" : editingEvent ? "Değişiklikleri kaydet" : "Kaydı ekle"}
            onPress={submit}
          />
          <Button label="Vazgeç" onPress={onClose} variant="ghost" />
          {editingEvent ? (
            <Pressable
              accessibilityLabel="Uyku kaydını sil"
              accessibilityRole="button"
              disabled={deleting}
              onPress={confirmDelete}
              style={styles.deleteButton}
            >
              <Trash2 color="#B42318" size={20} />
              <Text style={styles.deleteText}>{deleting ? "Siliniyor…" : "Kaydı sil"}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Segment({ active, color, icon, label, onPress }: { active: boolean; color: string; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[styles.segment, active && { backgroundColor: color }]}
    >
      {icon}
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function suggestedEventType(events: BabySleepEvent[]): SleepEventType {
  return [...events].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)).at(-1)?.event_type === "sleep"
    ? "wake"
    : "sleep";
}

function dayChoiceFor(value: Date): DayChoice {
  if (sameLocalDay(value, new Date())) return "today";
  if (sameLocalDay(value, new Date(Date.now() - 86_400_000))) return "yesterday";
  return "custom";
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function sameLocalDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function formatReadable(value: Date) {
  const day = sameLocalDay(value, new Date())
    ? "Bugün"
    : sameLocalDay(value, new Date(Date.now() - 86_400_000))
      ? "Dün"
      : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(value);
  const time = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", hour12: false, minute: "2-digit" }).format(value);
  return `${day}, ${time}`;
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: palette.background, flex: 1 },
  grabber: { alignSelf: "center", backgroundColor: "#C8C4C0", borderRadius: radii.pill, height: 5, marginTop: spacing.sm, width: 42 },
  header: { alignItems: "center", borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  iconButton: { alignItems: "center", backgroundColor: palette.ivory, borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: 44 },
  fieldLabel: { ...typography.label, marginTop: spacing.sm },
  segmented: { backgroundColor: "#F0ECE8", borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, padding: spacing.xs },
  segment: { alignItems: "center", borderRadius: radii.pill, flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 50 },
  segmentText: { ...typography.label, color: palette.muted },
  segmentTextActive: { color: "#FFFFFF" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { alignItems: "center", backgroundColor: palette.ivory, borderColor: palette.border, borderRadius: radii.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md },
  chipActive: { backgroundColor: palette.mint, borderColor: palette.mintBorder },
  chipText: { ...typography.label, color: palette.muted },
  chipTextActive: { color: palette.mintText },
  pickerCard: { alignItems: "center", backgroundColor: palette.ivory, borderRadius: radii.lg, gap: spacing.sm, padding: spacing.sm },
  timePicker: { alignItems: "center", backgroundColor: palette.ivory, borderRadius: radii.lg, minHeight: 150, overflow: "hidden" },
  summary: { alignItems: "center", backgroundColor: palette.mint, borderColor: palette.mintBorder, borderRadius: radii.lg, borderWidth: 1, flexDirection: "row", gap: spacing.md, padding: spacing.md },
  summaryLabel: { ...typography.body, color: palette.mintText },
  summaryValue: { ...typography.heading3, color: palette.text },
  errorText: { ...typography.bodyStrong, color: "#B42318" },
  deleteButton: { alignItems: "center", borderColor: "#E8B4AE", borderRadius: radii.pill, borderWidth: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48 },
  deleteText: { ...typography.label, color: "#B42318" }
});
