# Growth Tracking

App-side API is in `src/api/growthRecords.ts`.

## Percentiles

`whoGrowthStandards.ts` is generated, not written. It holds the WHO Child Growth
Standards LMS tables (weight-for-age, length/height-for-age and head
circumference-for-age, 0 to 5 years, per sex) taken from the WHO's own `anthro`
R package. To regenerate:

```powershell
# Download weianthro.txt, lenanthro.txt and hcanthro.txt from
# https://github.com/WorldHealthOrganization/anthro/tree/master/data-raw/growthstandards
node tools/generate-who-growth-standards.mjs <download-dir> src/features/growth-tracking/whoGrowthStandards.ts
```

The source tables are daily; the generator subsamples them (daily for the first
four months, then weekly, then fortnightly) and the runtime interpolates.
The generator refuses to emit a file if that costs more than 0.01 z anywhere —
the current worst case is 0.0018 z, far below what a home baby scale can
resolve.

Two details are easy to get wrong and are covered by tests:

- **The day 731 step.** WHO switches from recumbent length to standing height at
  two years and the median drops about 0.7 cm by definition, not by growth. The
  generator anchors samples at days 730 and 731 so no interpolation interval
  spans the discontinuity.
- **Sex.** There is no neutral WHO curve. A baby recorded as `belirtilmemis`
  gets an explanation instead of a guessed reference line.

`percentile.ts` converts a measurement to a z-score with the standard LMS
formula and to a percentile through the normal CDF. `growthSeries.ts` builds the
chart data — the child's points plus the -2/-1/0/+1/+2 SD reference curves —
and `describeGrowthTrend` reports whether the child is holding their own line,
which is what actually matters clinically rather than any single number.

`GrowthPercentileCard` renders all of it on the baby screen, with an explicit
note that a percentile is not a diagnosis.
