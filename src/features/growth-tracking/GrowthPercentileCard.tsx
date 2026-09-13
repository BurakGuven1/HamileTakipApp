import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { useAppTheme } from "@/providers/AppThemeProvider";
import { colors, radii, spacing, typography } from "@/theme";

import { GrowthPercentileChart } from "./GrowthPercentileChart";
import {
  buildGrowthSeries,
  describeGrowthTrend,
  type GrowthMeasurementInput
} from "./growthSeries";
import {
  formatPercentile,
  GROWTH_INDICATOR_LABELS,
  GROWTH_INDICATOR_UNITS,
  toGrowthSex,
  type GrowthIndicator
} from "./percentile";
const INDICATORS: GrowthIndicator[] = ["weight", "length", "headCircumference"];

export function GrowthPercentileCard({
  baby,
  records
}: {
  baby: {
    birth_date: string;
    gender: "kiz" | "erkek" | "belirtilmemis" | null;
    name: string;
  };
  records: GrowthMeasurementInput[];
}) {
  const appTheme = useAppTheme();
  const [indicator, setIndicator] = useState<GrowthIndicator>("weight");
  const sex = toGrowthSex(baby.gender);

  const series = useMemo(() => {
    if (!sex) return null;
    return buildGrowthSeries({
      birthDate: baby.birth_date,
      indicator,
      records,
      sex
    });
  }, [baby.birth_date, indicator, records, sex]);

  // WHO publishes separate standards per sex and there is no neutral curve, so
  // guessing would put a wrong reference line under a real health number.
  if (!sex) {
    return (
      <Card style={{ gap: spacing.sm }}>
        <Text style={typography.heading2}>Persantil eğrisi</Text>
        <Text style={styles.muted}>
          Persantil, kız ve erkek bebekler için ayrı hesaplanır. {baby.name} için
          cinsiyeti profilden seçersen büyüme eğrisini burada gösterebiliriz.
        </Text>
      </Card>
    );
  }

  if (!series) {
    return (
      <Card style={{ gap: spacing.sm }}>
        <Text style={typography.heading2}>Persantil eğrisi</Text>
        <Text style={styles.muted}>
          {`${GROWTH_INDICATOR_LABELS[indicator]} ölçümü eklendiğinde ${baby.name}'in eğrisi Dünya Sağlık Örgütü standartlarıyla birlikte burada görünecek.`}
        </Text>
        <IndicatorTabs
          active={indicator}
          onChange={setIndicator}
          primary={appTheme.primary}
          tint={appTheme.tint}
        />
      </Card>
    );
  }

  const latest = series.points[series.points.length - 1]!;
  const trend = describeGrowthTrend(series.points);
  const unit = GROWTH_INDICATOR_UNITS[indicator];

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={typography.eyebrow}>Persantil eğrisi</Text>
        <Text style={typography.heading2}>
          {`${latest.value.toLocaleString("tr-TR")} ${unit} · ${formatPercentile(latest.percentile)}`}
        </Text>
        <Text style={styles.muted}>
          {`${formatAge(latest.ageDays)} ölçüm. Aynı yaştaki ${
            sex === "female" ? "kız" : "erkek"
          } bebeklerin ${formatPercentile(latest.percentile)} kadarı bu değerin altında.`}
        </Text>
      </View>

      <IndicatorTabs
        active={indicator}
        onChange={setIndicator}
        primary={appTheme.primary}
        tint={appTheme.tint}
      />

      <GrowthPercentileChart indicator={indicator} series={series} />

      {trend ? (
        <View style={[styles.trend, { backgroundColor: appTheme.tint }]}>
          <Text style={styles.trendText}>{describeTrendCopy(trend.tone)}</Text>
        </View>
      ) : null}

      <Text style={styles.disclaimer}>
        Persantil bir tanı değildir; tek bir ölçüm değil, eğrinin zaman içindeki
        seyri anlamlıdır. Değerlendirmeyi bebeğinin hekimi yapar.
      </Text>
    </Card>
  );
}

function IndicatorTabs({
  active,
  onChange,
  primary,
  tint
}: {
  active: GrowthIndicator;
  onChange: (indicator: GrowthIndicator) => void;
  primary: string;
  tint: string;
}) {
  return (
    <View style={styles.tabs}>
      {INDICATORS.map((indicator) => {
        const isActive = indicator === active;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            key={indicator}
            onPress={() => onChange(indicator)}
            style={[
              styles.tab,
              { backgroundColor: isActive ? tint : "transparent" },
              isActive ? { borderColor: primary } : null
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                isActive ? { color: primary, fontWeight: "700" } : null
              ]}
            >
              {GROWTH_INDICATOR_LABELS[indicator]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function describeTrendCopy(tone: "steady" | "rising" | "falling") {
  if (tone === "steady") {
    return "Bebeğin kendi eğrisini koruyor. Takip edilmesi gereken şey tam olarak bu.";
  }
  if (tone === "rising") {
    return "Son ölçümlerde eğri yukarı yönlü kaydı. Bir sonraki kontrolde hekimine söylemen yeterli.";
  }
  return "Son ölçümlerde eğri aşağı yönlü kaydı. Bir sonraki kontrolde hekimine mutlaka göster.";
}

function formatAge(ageDays: number) {
  if (ageDays < 31) return `${ageDays} günlük`;
  const months = Math.floor(ageDays / 30.4375);
  if (months < 24) return `${months} aylık`;
  return `${Math.floor(months / 12)} yaşındaki`;
}

const styles = StyleSheet.create({
  muted: {
    ...typography.body,
    color: colors.textMuted
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.xs
  },
  tab: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  tabLabel: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center"
  },
  trend: {
    borderRadius: radii.md,
    padding: spacing.md
  },
  trendText: {
    ...typography.body,
    color: colors.text
  },
  disclaimer: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17
  }
});
