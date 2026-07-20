import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Clock3, Snowflake, ThermometerSnowflake } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";
import {
  consumeMilk,
  createMilkContainer,
  discardMilk,
  getMilkInventorySummary,
  listMilkContainers,
  subscribeToMilkInventory,
  thawMilk,
  type MilkContainer
} from "./milkInventory";
import { useEffect } from "react";

export function MilkInventoryCard({ actorName, babyId }: { actorName: string | null; babyId: string }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useFeedback();
  const [amount, setAmount] = useState("");
  const [useAmount, setUseAmount] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<"freezer" | "refrigerator">("refrigerator");
  const [pumpedAt, setPumpedAt] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);

  const containersQuery = useQuery({ queryKey: ["milk-containers", babyId], queryFn: () => listMilkContainers(babyId) });
  const summaryQuery = useQuery({ queryKey: ["milk-summary", babyId], queryFn: () => getMilkInventorySummary(babyId) });
  const containers = containersQuery.data ?? [];
  const available = containers.filter((item) => item.status === "available" && item.remaining_amount_ml > 0 && Date.parse(item.expires_at) > Date.now());

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["milk-containers", babyId] }),
      queryClient.invalidateQueries({ queryKey: ["milk-summary", babyId] })
    ]);
  }

  useEffect(() => subscribeToMilkInventory(babyId, () => { refresh().catch(() => undefined); }), [babyId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Miktarı ml olarak doğru gir.");
      return createMilkContainer({ actorName, amountMl: value, babyId, label: label.trim() || null, notes: notes.trim() || null, pumpedAt: pumpedAt.toISOString(), storageLocation: location });
    },
    onSuccess: async (result) => {
      setAmount(""); setLabel(""); setNotes(""); setPumpedAt(new Date());
      showSuccess(result.queued ? "Kap çevrimdışı kuyruğa alındı; bağlantı gelince eklenecek." : "Süt kabı stoğa eklendi.");
      await refresh();
    },
    onError: (error) => showError(error, "Süt stoğa eklenemedi")
  });

  const useStockMutation = useMutation({
    mutationFn: async (containerId?: string) => {
      const value = Number(useAmount.replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) throw new Error("Kullanılan miktarı ml olarak gir.");
      return consumeMilk({ actorName, amountMl: value, babyId, containerId });
    },
    onSuccess: async (result) => { setUseAmount(""); showSuccess(result.queued ? "Kullanım çevrimdışı kuyruğa alındı." : "Kullanılan miktar stoktan düşüldü."); await refresh(); },
    onError: (error) => showError(error, "Süt kullanımı kaydedilemedi")
  });

  const containerMutation = useMutation({
    mutationFn: ({ action, container }: { action: "discard" | "thaw"; container: MilkContainer }) => action === "thaw" ? thawMilk(container, actorName) : discardMilk(container, actorName),
    onSuccess: async (_result, input) => { showSuccess(input.action === "thaw" ? "Süt çözündürülüyor olarak işaretlendi; 24 saatlik sayaç başladı." : "Kap arşivde atıldı olarak işaretlendi."); await refresh(); },
    onError: (error) => showError(error, "Süt kabı güncellenemedi")
  });

  function onPickerChange(event: DateTimePickerEvent, value?: Date) {
    if (Platform.OS === "android") setPickerMode(null);
    if (event.type === "dismissed" || !value) return;
    const next = new Date(pumpedAt);
    if (pickerMode === "date") next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
    else next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    setPumpedAt(next);
  }

  const summary = summaryQuery.data;
  return (
    <Card>
      <View style={{ gap: spacing.lg }}>
        <View style={styles.titleRow}>
          <View style={styles.icon}><Archive color={colors.sageGreen} size={22} /></View>
          <View style={{ flex: 1, gap: 2 }}><Text style={typography.eyebrow}>Premium · kalıcı stok</Text><Text style={typography.heading2}>Anne sütü stoğu</Text></View>
        </View>
        <View style={styles.summaryRow}>
          <Metric label="Toplam" value={`${summary?.total_ml ?? 0} ml`} />
          <Metric label="Dolap" value={`${summary?.refrigerator_ml ?? 0} ml`} />
          <Metric label="Dondurucu" value={`${summary?.freezer_ml ?? 0} ml`} />
        </View>
        {summary?.use_next ? <View style={styles.fifo}><Text style={typography.label}>Önce bunu kullan: {summary.use_next.label}</Text><Text style={styles.meta}>{summary.use_next.remaining_amount_ml} ml · {locationLabel(summary.use_next.storage_location)} · {expiryText(summary.use_next.expires_at)}</Text></View> : null}
        <Text style={styles.meta}>{summary?.estimated_days ? `Son 7 günlük tüketime göre stok yaklaşık ${summary.estimated_days} gün yeter.` : "Tahmin için en az birkaç günlük tüketim kaydı gerekir."}</Text>

        <View style={styles.section}>
          <Text style={typography.label}>Yeni poşet / kap</Text>
          <View style={styles.chips}><MiniChoice active={location === "refrigerator"} label="Buzdolabı" onPress={() => setLocation("refrigerator")} /><MiniChoice active={location === "freezer"} label="Dondurucu" onPress={() => setLocation("freezer")} /></View>
          <TextField keyboardType="decimal-pad" label="Miktar (ml)" value={amount} onChangeText={setAmount} />
          <TextField label="Etiket (boşsa otomatik)" value={label} onChangeText={setLabel} />
          <View style={styles.timeRow}><Pressable style={styles.timeButton} onPress={() => setPickerMode("date")}><Text style={typography.label}>{pumpedAt.toLocaleDateString("tr-TR")}</Text></Pressable><Pressable style={styles.timeButton} onPress={() => setPickerMode("time")}><Clock3 color={colors.textMuted} size={17} /><Text style={typography.label}>{pumpedAt.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</Text></Pressable></View>
          {pickerMode ? <DateTimePicker display={Platform.OS === "ios" ? "compact" : "default"} mode={pickerMode} maximumDate={new Date()} value={pumpedAt} onChange={onPickerChange} /> : null}
          <TextField label="Not (isteğe bağlı)" maxLength={500} value={notes} onChangeText={setNotes} />
          <Button disabled={createMutation.isPending} label="Stoğa kap ekle" onPress={() => createMutation.mutate()} />
        </View>

        <View style={styles.section}>
          <Text style={typography.label}>Tüketimi hızlı düş</Text>
          <TextField keyboardType="decimal-pad" label="Kullanılan (ml)" value={useAmount} onChangeText={setUseAmount} />
          <Button variant="secondary" disabled={useStockMutation.isPending} label="En eski sütten kullan" onPress={() => useStockMutation.mutate(undefined)} />
        </View>

        <View style={{ gap: spacing.sm }}>
          {available.slice(0, 8).map((container) => (
            <View key={container.id} style={styles.containerRow}>
              {container.storage_location === "freezer" ? <Snowflake color={colors.nightPlum} size={19} /> : <ThermometerSnowflake color={colors.sageGreen} size={19} />}
              <View style={{ flex: 1 }}><Text style={typography.label}>{container.label} · {container.remaining_amount_ml}/{container.initial_amount_ml} ml</Text><Text style={styles.meta}>{locationLabel(container.storage_location)} · {expiryText(container.expires_at)}</Text></View>
              {container.storage_location === "freezer" ? <Pressable onPress={() => containerMutation.mutate({ action: "thaw", container })}><Text style={styles.action}>Çözdür</Text></Pressable> : null}
              <Pressable onPress={() => containerMutation.mutate({ action: "discard", container })}><Text style={styles.actionMuted}>At</Text></Pressable>
            </View>
          ))}
        </View>
        <Text style={styles.safety}>Varsayılan süreler CDC saklama rehberine dayanır: buzdolabı 4 gün, dondurucu için en iyi kalite 6 ay, tamamen çözündükten sonra 24 saat. Koşullar değişebilir; şüphede sağlık profesyoneline danış.</Text>
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.meta}>{label}</Text><Text style={typography.label}>{value}</Text></View>; }
function MiniChoice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[typography.label, active && { color: colors.onPrimary }]}>{label}</Text></Pressable>; }
function locationLabel(value: MilkContainer["storage_location"]) { return value === "freezer" ? "Dondurucu" : value === "thawed" ? "Çözündü" : "Buzdolabı"; }
function expiryText(value: string) { const hours = Math.round((Date.parse(value) - Date.now()) / 3_600_000); return hours <= 0 ? "süresi doldu" : hours < 48 ? `${hours} saat kaldı` : `${Math.ceil(hours / 24)} gün kaldı`; }

const styles = StyleSheet.create({
  titleRow: { alignItems: "center", flexDirection: "row", gap: spacing.md }, icon: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  summaryRow: { flexDirection: "row", gap: spacing.sm }, metric: { backgroundColor: colors.background, borderRadius: radii.md, flex: 1, gap: 3, padding: spacing.sm },
  meta: { ...typography.body, color: colors.textMuted, fontSize: 12, lineHeight: 17 }, fifo: { backgroundColor: colors.primarySoft, borderRadius: radii.md, gap: 3, padding: spacing.md },
  section: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.md, paddingTop: spacing.md }, chips: { flexDirection: "row", gap: spacing.sm }, choice: { borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, choiceActive: { backgroundColor: colors.sageGreen, borderColor: colors.sageGreen },
  timeRow: { flexDirection: "row", gap: spacing.sm }, timeButton: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flex: 1, flexDirection: "row", gap: spacing.xs, minHeight: 48, paddingHorizontal: spacing.sm },
  containerRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm }, action: { ...typography.label, color: colors.sageGreen }, actionMuted: { ...typography.label, color: colors.textMuted }, safety: { ...typography.body, color: colors.textMuted, fontSize: 11, lineHeight: 16 }
});
