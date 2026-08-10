import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  CircleAlert,
  CreditCard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";

import {
  isAnalyticsAdmin,
  loadAnalyticsDashboard,
  type AnalyticsDashboardData,
  type AnalyticsRangeDays,
  type FunnelStep
} from "@/api/analyticsAdmin";
import { supabase } from "@/lib/supabase";
import { fonts } from "@/theme";

const adminColors = {
  accent: "#D97706",
  background: "#F8FAFC",
  border: "#DDE5F0",
  danger: "#B42318",
  heading: "#0F172A",
  muted: "#64748B",
  primary: "#1E40AF",
  primarySoft: "#DBEAFE",
  success: "#047857",
  successSoft: "#D1FAE5",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9"
} as const;

const rangeOptions: AnalyticsRangeDays[] = [7, 30, 90];
const funnelLabels: Record<string, string> = {
  account_created: "Hesap oluşturdu",
  activated: "İlk değeri aldı",
  first_open: "İlk açılış",
  onboarding_completed: "Onboarding tamamladı",
  paywall_presented: "Paywall gördü",
  premium_gate_hit: "Premium ihtiyacına ulaştı",
  purchase_started: "Satın almayı başlattı",
  verified_purchase: "Doğrulanmış satın alma"
};
const subscriptionEventLabels: Record<string, string> = {
  BILLING_ISSUE: "Ödeme sorunu",
  CANCELLATION: "İptal",
  CURRENT_ACTIVE: "Güncel aktif abone",
  EXPIRATION: "Süresi dolan",
  INITIAL_PURCHASE: "İlk satın alma",
  RENEWAL: "Yenileme"
};

export default function AnalyticsAdminScreen() {
  const { width } = useWindowDimensions();
  const [authReady, setAuthReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [rangeDays, setRangeDays] = useState<AnalyticsRangeDays>(30);

  useEffect(() => {
    let active = true;

    async function refreshAuthorization() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const signedIn = Boolean(data.session);
      setHasSession(signedIn);
      setAuthorized(signedIn ? await isAnalyticsAdmin().catch(() => false) : false);
      if (active) setAuthReady(true);
    }

    void refreshAuthorization();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refreshAuthorization();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const dashboardQuery = useQuery({
    enabled: authorized,
    queryFn: () => loadAnalyticsDashboard(rangeDays),
    queryKey: ["analytics-admin-dashboard", rangeDays],
    staleTime: 60_000
  });

  if (Platform.OS !== "web") {
    return (
      <CenteredState
        icon={<BarChart3 color={adminColors.primary} size={30} />}
        title="Web paneli"
        description="Analitik paneli yalnızca güvenli web oturumunda kullanılabilir."
      />
    );
  }

  if (!authReady) {
    return <LoadingState label="Yetki kontrol ediliyor" />;
  }

  if (!hasSession) {
    return <AdminLogin />;
  }

  if (!authorized) {
    return (
      <CenteredState
        icon={<ShieldCheck color={adminColors.danger} size={30} />}
        title="Erişim yetkiniz yok"
        description="Bu hesap analytics_admins allowlist tablosunda bulunmuyor."
        action={
          <AdminButton label="Oturumu kapat" onPress={() => supabase.auth.signOut()} />
        }
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={dashboardQuery.isFetching}
          onRefresh={() => void dashboardQuery.refetch()}
        />
      }
    >
      <View style={[styles.shell, { maxWidth: Math.min(1440, width - 32) }]}>
        <DashboardHeader
          fetching={dashboardQuery.isFetching}
          rangeDays={rangeDays}
          setRangeDays={setRangeDays}
          onRefresh={() => void dashboardQuery.refetch()}
        />

        {dashboardQuery.isLoading ? (
          <LoadingState label="Funnel hazırlanıyor" contained />
        ) : dashboardQuery.error ? (
          <CenteredState
            contained
            icon={<CircleAlert color={adminColors.danger} size={30} />}
            title="Dashboard yüklenemedi"
            description={getErrorMessage(dashboardQuery.error)}
            action={<AdminButton label="Yeniden dene" onPress={() => dashboardQuery.refetch()} />}
          />
        ) : dashboardQuery.data ? (
          <DashboardContent data={dashboardQuery.data} width={width} />
        ) : null}
      </View>
    </ScrollView>
  );
}

function DashboardHeader({
  fetching,
  onRefresh,
  rangeDays,
  setRangeDays
}: {
  fetching: boolean;
  onRefresh: () => void;
  rangeDays: AnalyticsRangeDays;
  setRangeDays: (days: AnalyticsRangeDays) => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandMark}>
          <BarChart3 color="#FFFFFF" size={24} />
        </View>
        <View>
          <Text style={styles.eyebrow}>ANNE+ ANALYTICS</Text>
          <Text style={styles.pageTitle}>Büyüme ve abonelik funnel’ı</Text>
          <Text style={styles.subtitle}>
            RevenueCat doğrulamalı dönüşüm ve ürün aktivasyonu
          </Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        <View accessibilityRole="radiogroup" style={styles.rangeGroup}>
          {rangeOptions.map((days) => (
            <Pressable
              key={days}
              accessibilityRole="radio"
              accessibilityState={{ checked: rangeDays === days }}
              onPress={() => setRangeDays(days)}
              style={[styles.rangeButton, rangeDays === days && styles.rangeButtonActive]}
            >
              <Text style={[styles.rangeText, rangeDays === days && styles.rangeTextActive]}>
                {days} gün
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityLabel="Dashboard verilerini yenile"
          accessibilityRole="button"
          disabled={fetching}
          onPress={onRefresh}
          style={styles.iconButton}
        >
          {fetching ? (
            <ActivityIndicator color={adminColors.primary} />
          ) : (
            <RefreshCw color={adminColors.primary} size={20} />
          )}
        </Pressable>
        <Pressable
          accessibilityLabel="Admin oturumunu kapat"
          accessibilityRole="button"
          onPress={() => void supabase.auth.signOut()}
          style={styles.iconButton}
        >
          <LogOut color={adminColors.muted} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

function DashboardContent({ data, width }: { data: AnalyticsDashboardData; width: number }) {
  const compact = width < 900;
  const kpis = [
    { icon: <Users color={adminColors.primary} size={20} />, label: "Yeni hesap", value: formatCount(data.overview.accounts) },
    { icon: <Activity color={adminColors.success} size={20} />, label: "Aktive olan", value: formatCount(data.overview.activated) },
    { icon: <CreditCard color={adminColors.accent} size={20} />, label: "Paywall izleyicisi", value: formatCount(data.overview.paywall_viewers) },
    { icon: <BadgeCheck color={adminColors.success} size={20} />, label: "Dönemde satın alan", value: formatCount(data.overview.verified_customers) },
    { icon: <CreditCard color={adminColors.success} size={20} />, label: "Güncel aktif abone", value: formatCount(data.overview.active_subscribers) },
    { icon: <TrendingUp color={adminColors.primary} size={20} />, label: "7 günlük dönüşüm", value: `%${formatDecimal(data.overview.paywall_conversion_7d)}` },
    { icon: <BarChart3 color={adminColors.muted} size={20} />, label: "Medyan satın alma", value: data.overview.median_hours_to_purchase === null ? "—" : `${formatDecimal(data.overview.median_hours_to_purchase)} sa` }
  ];

  return (
    <View style={styles.dashboard}>
      {data.overview.first_opens === 0 && data.overview.accounts > 0 ? (
        <View style={styles.coverageNotice}>
          <CircleAlert color={adminColors.accent} size={20} />
          <View style={styles.coverageCopy}>
            <Text style={styles.coverageTitle}>Event takibi yeni başladı</Text>
            <Text style={styles.coverageText}>
              İlk açılış ve onboarding geçmişe dönük üretilemez. Aktif aboneler
              mevcut subscription kaydından, yeni satın almalar RevenueCat
              webhook’undan doğrulanır.
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.kpiGrid}>
        {kpis.map((item) => (
          <KpiCard key={item.label} {...item} compact={compact} />
        ))}
      </View>

      <View style={[styles.twoColumn, compact && styles.singleColumn]}>
        <Panel style={styles.primaryPanel} title="Ana dönüşüm funnel’ı" subtitle="Her adımda benzersiz kullanıcı">
          <FunnelChart steps={data.funnel} />
        </Panel>
        <Panel style={styles.secondaryPanel} title="Günlük sinyaller" subtitle="Aktif, paywall ve satın alma">
          <TrendChart points={data.timeseries} />
        </Panel>
      </View>

      <Panel title="Paywall kaynak performansı" subtitle="İlk gösterimden 7 gün içinde doğrulanmış satın alma">
        <SourceTable rows={data.paywallSources} />
      </Panel>

      <View style={[styles.twoColumn, compact && styles.singleColumn]}>
        <Panel style={styles.primaryPanel} title="RevenueCat Offering karşılaştırması" subtitle="Deney varyantları gerçek offering kimliğiyle">
          <OfferingTable rows={data.offerings} />
        </Panel>
        <Panel style={styles.secondaryPanel} title="Abonelik sağlığı" subtitle="Güncel aktif durum ve production webhook olayları">
          <SubscriptionTable rows={data.subscriptionHealth} />
        </Panel>
      </View>

      <View style={[styles.twoColumn, compact && styles.singleColumn]}>
        <Panel style={styles.primaryPanel} title="Retention kohortları" subtitle="Tam 1., 7. ve 30. takvim gününde geri dönenler · — henüz ölçülmedi">
          <RetentionTable rows={data.retention.slice(-10).reverse()} />
        </Panel>
        <Panel style={styles.secondaryPanel} title="Veri kalitesi" subtitle="Funnel güvenilirliği için operasyonel kontroller">
          <DataQuality data={data.dataQuality} />
        </Panel>
      </View>
    </View>
  );
}

function KpiCard({ compact, icon, label, value }: { compact: boolean; icon: ReactNode; label: string; value: string }) {
  return (
    <View style={[styles.kpiCard, { width: compact ? "48%" : "31.8%" }]}>
      <View style={styles.kpiIcon}>{icon}</View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text accessibilityLabel={`${label}: ${value}`} style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const maximum = Math.max(...steps.map((step) => step.users), 1);
  return (
    <View style={styles.funnelList}>
      {steps.map((step, index) => {
        const previous = steps[index - 1]?.users ?? step.users;
        const previousRate = previous > 0 ? (step.users / previous) * 100 : 0;
        const relativeWidth = (step.users / maximum) * 100;
        const comparableToPrevious = previous > 0 && step.users <= previous;
        return (
          <View key={step.step_key} style={styles.funnelRow}>
            <View style={styles.funnelMeta}>
              <Text style={styles.rowLabel}>{funnelLabels[step.step_key] ?? step.step_key}</Text>
              <Text style={styles.rowValue}>{formatCount(step.users)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.funnelFill, { width: `${Math.max(relativeWidth, step.users ? 3 : 0)}%` }]} />
            </View>
            <Text style={styles.helperText}>
              {index === 0
                ? "Seçili dönemde kaydedilen olay"
                : comparableToPrevious
                  ? `%${formatDecimal(previousRate)} önceki adımdan`
                  : "Event kapsamları farklı; oran hesaplanmadı"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function TrendChart({ points }: { points: AnalyticsDashboardData["timeseries"] }) {
  const visible = points.slice(-30);
  const maximum = Math.max(...visible.map((item) => item.active_users), 1);
  if (!visible.length) return <EmptyRows />;
  return (
    <View>
      <View style={styles.legend}>
        <Legend color={adminColors.primary} label="Aktif" />
        <Legend color={adminColors.accent} label="Paywall" />
        <Legend color={adminColors.success} label="Satın alma" />
      </View>
      <ScrollView horizontal contentContainerStyle={styles.trendContent}>
        {visible.map((point, index) => (
          <View
            key={point.metric_date}
            accessibilityLabel={`${point.metric_date}: ${point.active_users} aktif, ${point.paywall_viewers} paywall, ${point.verified_purchases} satın alma`}
            style={styles.trendColumn}
          >
            <View style={styles.trendBars}>
              <View style={[styles.trendBar, { backgroundColor: adminColors.primary, height: `${Math.max(4, point.active_users / maximum * 100)}%` }]} />
              <View style={[styles.trendBar, { backgroundColor: adminColors.accent, height: `${Math.max(4, point.paywall_viewers / maximum * 100)}%` }]} />
              <View style={[styles.trendBar, { backgroundColor: adminColors.success, height: `${Math.max(4, point.verified_purchases / maximum * 100)}%` }]} />
            </View>
            <Text style={styles.axisLabel}>{index % 5 === 0 ? point.metric_date.slice(5) : ""}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SourceTable({ rows }: { rows: AnalyticsDashboardData["paywallSources"] }) {
  if (!rows.length) return <EmptyRows />;
  return (
    <DataTable headers={["Kaynak", "Gösterim", "İzleyici", "Satın alma", "Dönüşüm"]}>
      {rows.map((row) => (
        <DataRow key={row.source} cells={[
          humanize(row.source),
          formatCount(row.impressions),
          formatCount(row.unique_viewers),
          formatCount(row.verified_conversions),
          `%${formatDecimal(row.conversion_rate)}`
        ]} />
      ))}
    </DataTable>
  );
}

function OfferingTable({ rows }: { rows: AnalyticsDashboardData["offerings"] }) {
  if (!rows.length) return <EmptyRows />;
  return (
    <DataTable headers={["Offering", "Gösterim", "Başlatma", "Doğrulanan"]}>
      {rows.map((row) => (
        <DataRow key={row.offering_id} cells={[
          row.offering_id,
          formatCount(row.impressions),
          formatCount(row.purchase_starts),
          formatCount(row.verified_purchases)
        ]} />
      ))}
    </DataTable>
  );
}

function SubscriptionTable({ rows }: { rows: AnalyticsDashboardData["subscriptionHealth"] }) {
  if (!rows.length) return <EmptyRows />;
  return (
    <View style={styles.healthList}>
      {rows.map((row) => (
        <View key={row.event_type} style={styles.healthRow}>
          <View style={styles.healthCopy}>
            <Text style={styles.rowLabel}>{subscriptionEventLabels[row.event_type] ?? humanize(row.event_type)}</Text>
            <Text style={styles.helperText}>{formatCount(row.customers)} müşteri</Text>
          </View>
          <Text style={styles.rowValue}>{formatCount(row.events)}</Text>
        </View>
      ))}
    </View>
  );
}

function RetentionTable({ rows }: { rows: AnalyticsDashboardData["retention"] }) {
  if (!rows.length) return <EmptyRows />;
  return (
    <DataTable headers={["Kohort", "Kullanıcı", "D1", "D7", "D30"]}>
      {rows.map((row) => (
        <DataRow key={row.cohort_date} cells={[
          row.cohort_date,
          formatCount(row.cohort_users),
          retentionRate(row.d1_users, row.cohort_users),
          retentionRate(row.d7_users, row.cohort_users),
          retentionRate(row.d30_users, row.cohort_users)
        ]} />
      ))}
    </DataTable>
  );
}

function DataQuality({ data }: { data: AnalyticsDashboardData["dataQuality"] }) {
  const rows = [
    ["İstemci satın alma tamamlaması", data.client_completions],
    ["Doğrulanmış ilk satın alma", data.verified_purchases],
    ["Eski event’ten tamamlanan paywall", data.legacy_paywall_fallbacks],
    ["Webhook öncesi subscription kaydı", data.subscription_cache_fallbacks],
    ["Kaynağı eksik paywall", data.missing_paywall_source],
    ["Offering kimliği eksik", data.missing_offering],
    ["Sandbox webhook", data.sandbox_webhooks]
  ] as const;
  return (
    <View style={styles.healthList}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.healthRow}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowValue, value > 0 && label.includes("eksik") && styles.warningValue]}>{formatCount(value)}</Text>
        </View>
      ))}
    </View>
  );
}

function DataTable({ children, headers }: { children: ReactNode; headers: string[] }) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.table}>
      <View style={styles.tableInner}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          {headers.map((header) => <Text key={header} style={styles.tableHeaderCell}>{header}</Text>)}
        </View>
        {children}
      </View>
    </ScrollView>
  );
}

function DataRow({ cells }: { cells: string[] }) {
  return <View style={styles.tableRow}>{cells.map((cell, index) => <Text key={`${index}-${cell}`} numberOfLines={1} style={[styles.tableCell, index === 0 && styles.tableFirstCell]}>{cell}</Text>)}</View>;
}

function Panel({ children, style, subtitle, title }: { children: ReactNode; style?: object; subtitle: string; title: string }) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.helperText}>{label}</Text></View>;
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const valid = email.includes("@") && password.length >= 8;

  async function signIn() {
    if (!valid || loading) return;
    setLoading(true);
    setError(undefined);
    const result = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (result.error) setError(result.error.message);
    setLoading(false);
  }

  return (
    <View style={styles.loginPage}>
      <View style={styles.loginCard}>
        <View style={styles.loginIcon}><ShieldCheck color={adminColors.primary} size={30} /></View>
        <Text style={styles.loginTitle}>Analytics yönetimi</Text>
        <Text style={styles.loginDescription}>Yalnız allowlist’te bulunan Supabase hesabınızla giriş yapın.</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>E-posta</Text>
          <TextInput accessibilityLabel="Admin e-posta" autoCapitalize="none" inputMode="email" onChangeText={setEmail} style={styles.input} value={email} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Şifre</Text>
          <TextInput accessibilityLabel="Admin şifre" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
        </View>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
        <AdminButton disabled={!valid || loading} label={loading ? "Giriş yapılıyor…" : "Güvenli giriş"} onPress={signIn} />
      </View>
    </View>
  );
}

function AdminButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void | Promise<unknown> }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void onPress()} style={[styles.adminButton, disabled && styles.disabled]}><Text style={styles.adminButtonText}>{label}</Text></Pressable>;
}

function LoadingState({ contained, label }: { contained?: boolean; label: string }) {
  return <View style={[styles.centered, contained && styles.contained]}><ActivityIndicator color={adminColors.primary} /><Text style={styles.loginDescription}>{label}</Text></View>;
}

function CenteredState({ action, contained, description, icon, title }: { action?: ReactNode; contained?: boolean; description: string; icon: ReactNode; title: string }) {
  return <View style={[styles.centered, contained && styles.contained]}>{icon}<Text style={styles.loginTitle}>{title}</Text><Text style={styles.loginDescription}>{description}</Text>{action}</View>;
}

function EmptyRows() {
  return <View style={styles.empty}><Text style={styles.helperText}>Seçili aralıkta veri bulunmuyor.</Text></View>;
}

function formatCount(value: number) { return new Intl.NumberFormat("tr-TR").format(value); }
function formatDecimal(value: number) { return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value); }
function humanize(value: string) { return value.toLocaleLowerCase("tr-TR").replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("tr-TR")); }
function retentionRate(users: number | null, cohort: number) { return users === null || !cohort ? "—" : `%${formatDecimal(users / cohort * 100)}`; }
function getErrorMessage(error: unknown) { return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu."; }

const styles = StyleSheet.create({
  page: { alignItems: "center", backgroundColor: adminColors.background, minHeight: "100%", padding: 16 },
  shell: { gap: 20, width: "100%" },
  header: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "space-between", paddingVertical: 12 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  brandMark: { alignItems: "center", backgroundColor: adminColors.primary, borderRadius: 14, height: 48, justifyContent: "center", width: 48 },
  eyebrow: { color: adminColors.primary, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.1 },
  pageTitle: { color: adminColors.heading, fontFamily: fonts.displayBold, fontSize: 25, lineHeight: 32 },
  subtitle: { color: adminColors.muted, fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 20 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: 8 },
  rangeGroup: { backgroundColor: adminColors.surfaceMuted, borderRadius: 10, flexDirection: "row", padding: 3 },
  rangeButton: { borderRadius: 8, minHeight: 42, justifyContent: "center", paddingHorizontal: 13 },
  rangeButtonActive: { backgroundColor: adminColors.surface },
  rangeText: { color: adminColors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  rangeTextActive: { color: adminColors.primary },
  iconButton: { alignItems: "center", backgroundColor: adminColors.surface, borderColor: adminColors.border, borderRadius: 10, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  dashboard: { gap: 20 },
  coverageNotice: { alignItems: "flex-start", backgroundColor: "#FFF7E6", borderColor: "#F5D08A", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 12, padding: 16 },
  coverageCopy: { flex: 1 },
  coverageTitle: { color: adminColors.heading, fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  coverageText: { color: adminColors.muted, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 20, marginTop: 2 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  kpiCard: { backgroundColor: adminColors.surface, borderColor: adminColors.border, borderRadius: 14, borderWidth: 1, minWidth: 210, padding: 18 },
  kpiIcon: { alignItems: "center", backgroundColor: adminColors.surfaceMuted, borderRadius: 10, height: 38, justifyContent: "center", marginBottom: 14, width: 38 },
  kpiLabel: { color: adminColors.muted, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  kpiValue: { color: adminColors.heading, fontFamily: fonts.dataBold, fontSize: 28, lineHeight: 36, marginTop: 4 },
  twoColumn: { alignItems: "stretch", flexDirection: "row", gap: 20 },
  singleColumn: { flexDirection: "column" },
  primaryPanel: { flex: 1.2 },
  secondaryPanel: { flex: 1 },
  panel: { backgroundColor: adminColors.surface, borderColor: adminColors.border, borderRadius: 14, borderWidth: 1, minWidth: 0, padding: 20 },
  panelHeader: { marginBottom: 18 },
  panelTitle: { color: adminColors.heading, fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24 },
  panelSubtitle: { color: adminColors.muted, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19, marginTop: 3 },
  funnelList: { gap: 14 },
  funnelRow: { gap: 6 },
  funnelMeta: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: adminColors.heading, flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  rowValue: { color: adminColors.heading, fontFamily: fonts.dataBold, fontSize: 14 },
  track: { backgroundColor: adminColors.surfaceMuted, borderRadius: 6, height: 9, overflow: "hidden" },
  funnelFill: { backgroundColor: adminColors.primary, borderRadius: 6, height: 9 },
  helperText: { color: adminColors.muted, fontFamily: fonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 12 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  trendContent: { alignItems: "flex-end", height: 210, minWidth: "100%", paddingTop: 10 },
  trendColumn: { alignItems: "center", height: "100%", justifyContent: "flex-end", width: 30 },
  trendBars: { alignItems: "flex-end", flexDirection: "row", gap: 2, height: 165 },
  trendBar: { borderTopLeftRadius: 2, borderTopRightRadius: 2, width: 6 },
  axisLabel: { color: adminColors.muted, fontFamily: fonts.dataRegular, fontSize: 9, height: 18, marginTop: 6 },
  table: { minWidth: "100%" },
  tableInner: { minWidth: 680, width: "100%" },
  tableRow: { borderBottomColor: adminColors.border, borderBottomWidth: 1, flexDirection: "row", minHeight: 48 },
  tableHeader: { backgroundColor: adminColors.surfaceMuted, borderBottomWidth: 0, borderRadius: 8 },
  tableHeaderCell: { color: adminColors.muted, flex: 1, fontFamily: fonts.bodyBold, fontSize: 12, padding: 14 },
  tableCell: { color: adminColors.heading, flex: 1, fontFamily: fonts.dataRegular, fontSize: 13, padding: 14 },
  tableFirstCell: { fontFamily: fonts.bodySemiBold },
  healthList: { gap: 0 },
  healthRow: { alignItems: "center", borderBottomColor: adminColors.border, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingVertical: 8 },
  healthCopy: { flex: 1 },
  warningValue: { color: adminColors.danger },
  centered: { alignItems: "center", backgroundColor: adminColors.background, gap: 14, justifyContent: "center", minHeight: "100%", padding: 24 },
  contained: { backgroundColor: adminColors.surface, borderColor: adminColors.border, borderRadius: 14, borderWidth: 1, minHeight: 320 },
  loginPage: { alignItems: "center", backgroundColor: adminColors.background, justifyContent: "center", minHeight: "100%", padding: 24 },
  loginCard: { backgroundColor: adminColors.surface, borderColor: adminColors.border, borderRadius: 18, borderWidth: 1, gap: 16, maxWidth: 440, padding: 32, width: "100%" },
  loginIcon: { alignItems: "center", backgroundColor: adminColors.primarySoft, borderRadius: 14, height: 54, justifyContent: "center", width: 54 },
  loginTitle: { color: adminColors.heading, fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 31, textAlign: "center" },
  loginDescription: { color: adminColors.muted, fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 23, maxWidth: 520, textAlign: "center" },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: adminColors.heading, fontFamily: fonts.bodySemiBold, fontSize: 14 },
  input: { backgroundColor: adminColors.surface, borderColor: adminColors.border, borderRadius: 10, borderWidth: 1, color: adminColors.heading, fontFamily: fonts.bodyRegular, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  errorText: { color: adminColors.danger, fontFamily: fonts.bodyRegular, fontSize: 13, lineHeight: 19 },
  adminButton: { alignItems: "center", backgroundColor: adminColors.primary, borderRadius: 10, justifyContent: "center", minHeight: 48, paddingHorizontal: 18 },
  adminButtonText: { color: "#FFFFFF", fontFamily: fonts.bodyBold, fontSize: 15 },
  disabled: { opacity: 0.45 },
  empty: { alignItems: "center", justifyContent: "center", minHeight: 120 }
});
