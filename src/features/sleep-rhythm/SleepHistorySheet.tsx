import { ArrowLeft, Moon, Sun } from "lucide-react-native";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { BabySleepEvent } from "@/api/sleepRhythm";
import { EmptyState } from "@/components/EmptyState";
import { radii, spacing, typography } from "@/theme";

import { sleepRhythmColors as palette } from "./palette";

export function SleepHistorySheet({
  events,
  onClose,
  onSelect,
  visible
}: {
  events: BabySleepEvent[];
  onClose: () => void;
  onSelect: (event: BabySleepEvent) => void;
  visible: boolean;
}) {
  const sorted = [...events].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  let lastDay = "";
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
          <Pressable accessibilityLabel="Geçmişi kapat" accessibilityRole="button" onPress={onClose} style={styles.iconButton}>
            <ArrowLeft color={palette.text} size={22} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={typography.eyebrow}>UYKU RİTMİ</Text>
            <Text style={typography.heading2}>Tüm kayıtlar</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {!sorted.length ? (
            <EmptyState title="Henüz uyku kaydı yok" description="İlk Uyudu veya Uyandı kaydını eklediğinde burada görünecek." />
          ) : sorted.map((event) => {
            const day = formatDay(event.occurred_at);
            const showDay = day !== lastDay;
            lastDay = day;
            const sleeping = event.event_type === "sleep";
            return (
              <View key={event.id}>
                {showDay ? <Text style={styles.day}>{day}</Text> : null}
                <Pressable
                  accessibilityLabel={`${formatClock(event.occurred_at)} ${sleeping ? "uyudu" : "uyandı"}, düzenle`}
                  accessibilityRole="button"
                  onPress={() => onSelect(event)}
                  style={styles.row}
                >
                  <View style={[styles.eventIcon, { backgroundColor: sleeping ? palette.sleepSoft : palette.awakeSoft }]}>
                    {sleeping ? <Moon color={palette.navy} size={22} /> : <Sun color={palette.awake} size={22} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.time}>{formatClock(event.occurred_at)}</Text>
                    <Text style={styles.meta}>{sleeping ? "Uyudu" : "Uyandı"} · {event.source === "quick" ? "Hızlı kayıt" : "Geçmiş kayıt"}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "full" }).format(new Date(value));
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", hour12: false, minute: "2-digit" }).format(new Date(value));
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: palette.background, flex: 1 },
  grabber: { alignSelf: "center", backgroundColor: "#C8C4C0", borderRadius: radii.pill, height: 5, marginTop: spacing.sm, width: 42 },
  header: { alignItems: "center", borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.md, padding: spacing.lg },
  iconButton: { alignItems: "center", backgroundColor: palette.ivory, borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  content: { gap: spacing.sm, padding: spacing.lg, paddingBottom: 44 },
  day: { ...typography.label, color: palette.mintText, marginBottom: spacing.xs, marginTop: spacing.md },
  row: { alignItems: "center", backgroundColor: palette.ivory, borderBottomColor: palette.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.md, minHeight: 72, paddingHorizontal: spacing.md },
  eventIcon: { alignItems: "center", borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  time: { ...typography.heading3, color: palette.text },
  meta: { ...typography.body, color: palette.muted, fontSize: 14, lineHeight: 20 }
});
