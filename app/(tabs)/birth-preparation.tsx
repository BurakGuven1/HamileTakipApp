import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
  PackageCheck,
  Plus,
  Trash2,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";

import {
  addCustomBirthPreparationItem,
  deleteCustomBirthPreparationItem,
  listBirthPreparationItems,
  setBirthPreparationItemCompleted,
  subscribeToBirthPreparation,
  type BirthPreparationItem,
  type BirthPreparationKind
} from "@/api/birthPreparation";
import { getCurrentProfile } from "@/api/profiles";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { useFeedback } from "@/providers/FeedbackProvider";
import { colors, radii, spacing, typography } from "@/theme";

const QUERY_KEY = ["birth-preparation-items"] as const;

export default function BirthPreparationScreen() {
  const queryClient = useQueryClient();
  const accentColor = useAppTheme();
  const appTheme = accentColor.theme;
  const { showError, showSuccess } = useFeedback();
  const [activeKind, setActiveKind] = useState<BirthPreparationKind>("bag");
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [hideCompleted, setHideCompleted] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  const profileQuery = useQuery({
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });
  const enabled = Boolean(profileQuery.data?.is_pregnant);
  const itemsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listBirthPreparationItems,
    enabled
  });

  useEffect(() => {
    const profileId = profileQuery.data?.id;
    if (!profileId || !enabled || !itemsQuery.isSuccess) {
      return;
    }

    return subscribeToBirthPreparation(profileId, () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY }).catch(() => undefined);
    });
  }, [enabled, itemsQuery.isSuccess, profileQuery.data?.id, queryClient]);

  const items = itemsQuery.data ?? [];
  const sectionItems = useMemo(
    () => items.filter((item) => item.kind === activeKind),
    [activeKind, items]
  );
  const categories = useMemo(
    () => Array.from(new Set(sectionItems.map((item) => item.category))),
    [sectionItems]
  );

  useEffect(() => {
    if (!selectedCategory || !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const categoryItems = sectionItems.filter(
    (item) =>
      item.category === selectedCategory && (!hideCompleted || !item.is_completed)
  );
  const completedCount = sectionItems.filter((item) => item.is_completed).length;
  const progress = sectionItems.length > 0 ? completedCount / sectionItems.length : 0;

  const toggleMutation = useMutation({
    mutationFn: ({ completed, id }: { completed: boolean; id: string }) =>
      setBirthPreparationItemCompleted(id, completed),
    onMutate: async ({ completed, id }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<BirthPreparationItem[]>(QUERY_KEY);
      queryClient.setQueryData<BirthPreparationItem[]>(QUERY_KEY, (current = []) =>
        current.map((item) =>
          item.id === id ? { ...item, is_completed: completed } : item
        )
      );
      Haptics.selectionAsync().catch(() => undefined);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      showError(error, "Liste güncellenemedi");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  });

  const addMutation = useMutation({
    mutationFn: () =>
      addCustomBirthPreparationItem({
        category: selectedCategory ?? categories[0] ?? "Diğer",
        kind: activeKind,
        title: customTitle
      }),
    onSuccess: async () => {
      setCustomTitle("");
      setComposerOpen(false);
      showSuccess("Ortak listeye eklendi.");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => showError(error, "Madde eklenemedi")
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomBirthPreparationItem,
    onSuccess: async () => {
      showSuccess("Özel madde silindi.");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => showError(error, "Madde silinemedi")
  });

  function selectKind(kind: BirthPreparationKind) {
    setActiveKind(kind);
    setSelectedCategory(undefined);
    setComposerOpen(false);
    setCustomTitle("");
  }

  function confirmDelete(item: BirthPreparationItem) {
    Alert.alert(
      "Madde silinsin mi?",
      `“${item.title}” ortak listeden kaldırılacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => deleteMutation.mutate(item.id)
        }
      ]
    );
  }

  if (profileQuery.isPending) {
    return (
      <Screen scroll={false}>
        <View style={styles.loading}>
          <ActivityIndicator color={appTheme.primary} />
        </View>
      </Screen>
    );
  }

  if (profileQuery.data && !profileQuery.data.is_pregnant) {
    return (
      <Screen>
        <View style={styles.container}>
          <BackButton color={appTheme.primary} />
          <EmptyState
            title="Doğuma hazırlık hamilelik profiline özel"
            description="Profilde Hamileyim seçildiğinde ortak çanta ve doğum planı burada görünür."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.container}>
        <BackButton color={appTheme.primary} />

        <View style={[styles.hero, { backgroundColor: appTheme.primarySoft }]}>
          <View style={styles.heroHeader}>
            <View style={[styles.heroIcon, { backgroundColor: appTheme.accentSoft }]}>
              <ClipboardCheck color={appTheme.primary} size={28} />
            </View>
            <View style={styles.sharedPill}>
              <Users color={appTheme.primary} size={15} />
              <Text style={[styles.sharedPillText, { color: appTheme.primary }]}>Ortak liste</Text>
            </View>
          </View>
          <Text style={typography.eyebrow}>Doğuma hazırlık</Text>
          <Text style={typography.heading1}>Aklında tutma, birlikte tamamla</Text>
          <Text style={styles.heroText}>
            Anne ve baba aynı listeyi görür. Yapılan her işaretleme iki hesapta da
            güncellenir.
          </Text>
        </View>

        <View style={styles.segment}>
          <SegmentButton
            active={activeKind === "bag"}
            color={appTheme.primary}
            icon={<PackageCheck color={activeKind === "bag" ? colors.surface : colors.textMuted} size={18} />}
            label="Doğum çantası"
            onPress={() => selectKind("bag")}
          />
          <SegmentButton
            active={activeKind === "plan"}
            color={appTheme.primary}
            icon={<ClipboardCheck color={activeKind === "plan" ? colors.surface : colors.textMuted} size={18} />}
            label="Doğum planı"
            onPress={() => selectKind("plan")}
          />
        </View>

        <Card>
          <View style={styles.progressContent}>
            <View style={styles.progressCopy}>
              <Text style={typography.heading2}>
                {completedCount}/{sectionItems.length} tamamlandı
              </Text>
              <Text style={typography.body}>
                {progress === 1 && sectionItems.length > 0
                  ? "Hazırlık tamamlandı. Son bir kez birlikte kontrol edin."
                  : activeKind === "bag"
                    ? "Çantayı küçük adımlarla birlikte hazırlayın."
                    : "Tercihleri sağlık ekibiyle birlikte netleştirin."}
              </Text>
            </View>
            <Text style={[styles.progressPercent, { color: appTheme.primary }]}>
              %{Math.round(progress * 100)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: appTheme.primary, width: `${progress * 100}%` }
              ]}
            />
          </View>
        </Card>

        {itemsQuery.isPending ? (
          <ActivityIndicator color={appTheme.primary} />
        ) : itemsQuery.isError ? (
          <EmptyState
            title="Hazırlık listesi yüklenemedi"
            description="Bağlantını kontrol edip ekranı yeniden açmayı dene."
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRail}
            >
              {categories.map((category) => {
                const categoryAll = sectionItems.filter((item) => item.category === category);
                const categoryDone = categoryAll.filter((item) => item.is_completed).length;
                const selected = category === selectedCategory;
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    onPress={() => setSelectedCategory(category)}
                    style={[
                      styles.categoryChip,
                      selected && {
                        backgroundColor: appTheme.primarySoft,
                        borderColor: appTheme.primary
                      }
                    ]}
                  >
                    <Text style={[styles.categoryText, selected && { color: appTheme.primary }]}>
                      {category}
                    </Text>
                    <Text style={[styles.categoryCount, selected && { color: appTheme.primary }]}>
                      {categoryDone}/{categoryAll.length}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.listHeader}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text style={typography.heading2}>{selectedCategory}</Text>
                <Text style={typography.body}>Bir maddeye dokunarak işaretle.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setHideCompleted((value) => !value)}
                style={styles.visibilityButton}
              >
                {hideCompleted ? (
                  <Eye color={appTheme.primary} size={17} />
                ) : (
                  <EyeOff color={appTheme.primary} size={17} />
                )}
                <Text style={[styles.visibilityText, { color: appTheme.primary }]}>
                  {hideCompleted ? "Tümünü göster" : "Bitenleri gizle"}
                </Text>
              </Pressable>
            </View>

            <Card style={styles.checklistCard}>
              {categoryItems.length === 0 ? (
                <View style={styles.compactEmpty}>
                  <Check color={appTheme.primary} size={24} />
                  <Text style={typography.heading3}>Bu kategoride açık madde kalmadı</Text>
                  <Text style={styles.centerText}>Tüm maddeleri görmek için filtreyi kaldır.</Text>
                </View>
              ) : (
                categoryItems.map((item, index) => (
                  <ChecklistRow
                    key={item.id}
                    color={appTheme.primary}
                    disabled={toggleMutation.isPending && toggleMutation.variables?.id === item.id}
                    item={item}
                    last={index === categoryItems.length - 1}
                    onDelete={() => confirmDelete(item)}
                    onToggle={() =>
                      toggleMutation.mutate({
                        completed: !item.is_completed,
                        id: item.id
                      })
                    }
                  />
                ))
              )}
            </Card>

            {composerOpen ? (
              <Card style={[styles.composer, { borderColor: appTheme.primary }]}>
                <View style={{ gap: spacing.md }}>
                  <View style={styles.composerTitleRow}>
                    <Plus color={appTheme.primary} size={21} />
                    <Text style={typography.heading3}>{selectedCategory} listesine ekle</Text>
                  </View>
                  <TextField
                    autoFocus
                    label="Yeni madde"
                    maxLength={140}
                    placeholder={activeKind === "bag" ? "Örn. Rahat yastık" : "Örn. Ziyaretçi sınırlarını konuş"}
                    value={customTitle}
                    onChangeText={setCustomTitle}
                  />
                  <View style={styles.formActions}>
                    <Button
                      label="Vazgeç"
                      variant="ghost"
                      style={styles.formButton}
                      onPress={() => {
                        setComposerOpen(false);
                        setCustomTitle("");
                      }}
                    />
                    <Button
                      disabled={addMutation.isPending || customTitle.trim().length < 2}
                      label={addMutation.isPending ? "Ekleniyor..." : "Ortak listeye ekle"}
                      style={styles.formButton}
                      onPress={() => addMutation.mutate()}
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <Button
                label="Bu kategoriye madde ekle"
                variant="secondary"
                onPress={() => setComposerOpen(true)}
              />
            )}

            {activeKind === "plan" ? (
              <View style={styles.safetyNote}>
                <Text style={styles.safetyTitle}>Plan, tıbbi talimat değildir</Text>
                <Text style={styles.safetyText}>
                  Bu liste konuşulacak tercihleri hatırlatır. Doğumun güvenli akışı ve
                  uygulanabilecek seçenekler sağlık ekibinin değerlendirmesiyle değişebilir.
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

function ChecklistRow({
  color,
  disabled,
  item,
  last,
  onDelete,
  onToggle
}: {
  color: string;
  disabled: boolean;
  item: BirthPreparationItem;
  last: boolean;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.checklistRow, !last && styles.checklistDivider]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_completed, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={styles.checklistMain}
      >
        <View
          style={[
            styles.checkbox,
            { borderColor: item.is_completed ? color : colors.border },
            item.is_completed && { backgroundColor: color }
          ]}
        >
          {item.is_completed ? <Check color={colors.surface} size={18} strokeWidth={3} /> : null}
        </View>
        <View style={styles.itemCopy}>
          <Text style={[styles.itemTitle, item.is_completed && styles.itemTitleDone]}>
            {item.title}
          </Text>
          {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
          {item.is_completed && item.completed_by_name ? (
            <Text style={[styles.completedBy, { color }]}>
              {item.completed_by_name} tamamladı
            </Text>
          ) : null}
        </View>
      </Pressable>
      {item.is_custom ? (
        <Pressable
          accessibilityLabel={`${item.title} maddesini sil`}
          accessibilityRole="button"
          onPress={onDelete}
          style={styles.deleteButton}
        >
          <Trash2 color={colors.danger} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SegmentButton({
  active,
  color,
  icon,
  label,
  onPress
}: {
  active: boolean;
  color: string;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.segmentButton, active && { backgroundColor: color }]}
    >
      {icon}
      <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ color }: { color: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.back()}>
      <View style={styles.backRow}>
        <ArrowLeft color={color} size={20} />
        <Text style={[styles.backText, { color }]}>Geri dön</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  loading: { alignItems: "center", flex: 1, justifyContent: "center" },
  backRow: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing.sm },
  backText: { ...typography.label },
  hero: { ...radii.cardLarge, gap: spacing.sm, padding: spacing.lg },
  heroHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  heroIcon: { alignItems: "center", borderRadius: radii.pill, height: 52, justifyContent: "center", width: 52 },
  sharedPill: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sharedPillText: { ...typography.label, fontSize: 13 },
  heroText: { ...typography.body, color: colors.text },
  segment: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, padding: spacing.xs },
  segmentButton: { alignItems: "center", borderRadius: radii.pill, flex: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.sm },
  segmentLabel: { ...typography.label, color: colors.textMuted },
  segmentLabelActive: { color: colors.surface },
  progressContent: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  progressCopy: { flex: 1, gap: spacing.xs },
  progressPercent: { ...typography.dataStrong, fontSize: 27, lineHeight: 34 },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, height: 8, marginTop: spacing.md, overflow: "hidden" },
  progressFill: { borderRadius: radii.pill, height: "100%" },
  categoryRail: { gap: spacing.sm, paddingRight: spacing.lg },
  categoryChip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 42, paddingHorizontal: spacing.md },
  categoryText: { ...typography.label, color: colors.text },
  categoryCount: { ...typography.label, color: colors.textMuted, fontSize: 12 },
  listHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  visibilityButton: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: radii.pill, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  visibilityText: { ...typography.label, fontSize: 12 },
  checklistCard: { paddingBottom: 0, paddingTop: 0 },
  checklistRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 76 },
  checklistDivider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  checklistMain: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md },
  checkbox: { alignItems: "center", borderRadius: 8, borderWidth: 2, height: 28, justifyContent: "center", width: 28 },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { ...typography.label, color: colors.text, fontSize: 15, lineHeight: 21 },
  itemTitleDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  itemDescription: { ...typography.body, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  completedBy: { ...typography.label, fontSize: 12 },
  deleteButton: { alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: radii.pill, height: 38, justifyContent: "center", width: 38 },
  compactEmpty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  centerText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
  composer: { borderWidth: 1 },
  composerTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  formActions: { flexDirection: "row", gap: spacing.sm },
  formButton: { flex: 1 },
  safetyNote: { backgroundColor: colors.highlightSoft, ...radii.card, gap: spacing.xs, padding: spacing.md },
  safetyTitle: { ...typography.label, color: colors.text },
  safetyText: { ...typography.body, color: colors.textMuted, fontSize: 13, lineHeight: 19 }
});
