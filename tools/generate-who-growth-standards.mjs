// Converts the WHO Child Growth Standards LMS tables (the same files the WHO's
// own `anthro` R package ships) into a compact TypeScript module.
//
// The source tables are daily from 0 to 1826 days. Storing every day for three
// indicators and two sexes would add roughly a quarter of a megabyte to the
// bundle, so the generator subsamples and the runtime interpolates.
// `verifyInterpolation` proves that costs far less accuracy than the scales
// parents weigh their babies on, and refuses to emit a file if it ever does.
//
// Usage: node tools/generate-who-growth-standards.mjs <source-dir> <output-file>
// The source .txt files come from the WHO `anthro` repository (see banner).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_DIR = process.argv[2];
const OUTPUT_FILE = process.argv[3];
// Weight climbs fastest in the first months, so a uniform step that is fine at
// age two is badly wrong at age two weeks. The step widens as the curves flatten.
const SAMPLING_STEPS = [
  { untilDay: 120, step: 1 },
  { untilDay: 730, step: 7 },
  { untilDay: 1826, step: 14 }
];
const MAX_AGE_DAYS = 1826;
const MAX_ALLOWED_Z_ERROR = 0.01;
// At day 731 WHO switches length-for-age (measured lying down) to height-for-age
// (standing). The median drops about 0.7 cm by definition, not by growth, so a
// sample interval must never span that step or the interpolation smears a real
// discontinuity across two months.
const BOUNDARY_ANCHOR_DAYS = [730, 731];

const INDICATORS = [
  { file: "weianthro.txt", key: "weight" },
  { file: "lenanthro.txt", key: "length" },
  { file: "hcanthro.txt", key: "headCircumference" }
];

function parseTable(file) {
  const text = readFileSync(join(SOURCE_DIR, file), "utf8").trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const header = headerLine.split("\t");
  const columns = {
    sex: header.indexOf("sex"),
    age: header.indexOf("age"),
    l: header.indexOf("l"),
    m: header.indexOf("m"),
    s: header.indexOf("s")
  };

  const bySex = { 1: new Map(), 2: new Map() };
  for (const line of lines) {
    const parts = line.split("\t");
    const sex = Number(parts[columns.sex]);
    const age = Number(parts[columns.age]);
    if (!bySex[sex]) continue;
    // lenanthro carries both recumbent length and standing height rows; the
    // first row for an age is the one WHO uses at that age.
    if (bySex[sex].has(age)) continue;
    bySex[sex].set(age, [
      Number(parts[columns.l]),
      Number(parts[columns.m]),
      Number(parts[columns.s])
    ]);
  }
  return bySex;
}

function sampleAdaptive(daily) {
  const ages = [];
  const values = [];

  function push(age) {
    if (ages[ages.length - 1] === age) return;
    const row = daily.get(age);
    if (!row) throw new Error(`Missing LMS row for age ${age}`);
    ages.push(age);
    values.push(row);
  }

  const anchors = new Set([...BOUNDARY_ANCHOR_DAYS, MAX_AGE_DAYS]);
  const sampledAges = new Set();

  let age = 0;
  for (const { untilDay, step } of SAMPLING_STEPS) {
    for (; age <= untilDay; age += step) {
      sampledAges.add(age);
    }
    // Always anchor the exact boundary so the next, wider step starts true.
    sampledAges.add(Math.min(untilDay, MAX_AGE_DAYS));
  }

  for (const anchor of anchors) {
    sampledAges.add(anchor);
  }

  for (const sampledAge of [...sampledAges].sort((left, right) => left - right)) {
    if (sampledAge > MAX_AGE_DAYS) continue;
    push(sampledAge);
  }

  return { ages, values };
}

function interpolate(sampled, age) {
  const { ages, values } = sampled;
  if (age <= ages[0]) return values[0];
  if (age >= ages[ages.length - 1]) return values[values.length - 1];

  let high = 1;
  while (ages[high] < age) high += 1;
  const low = high - 1;
  const span = ages[high] - ages[low];
  const ratio = (age - ages[low]) / span;

  return values[low].map(
    (value, index) => value + (values[high][index] - value) * ratio
  );
}

function zScore([l, m, s], value) {
  if (l === 0) return Math.log(value / m) / s;
  return (Math.pow(value / m, l) - 1) / (l * s);
}

// The check that matters is not "are the LMS parameters close" but "does a real
// measurement land on the same z-score", so the error is measured in z units at
// the median and at the extremes of the normal range.
function verifyInterpolation(daily, sampled) {
  let worst = 0;
  for (const [age, exact] of daily) {
    if (age > MAX_AGE_DAYS) continue;
    const approx = interpolate(sampled, age);
    for (const target of [-3, -2, 0, 2, 3]) {
      const [l, m, s] = exact;
      const measurement =
        l === 0 ? m * Math.exp(s * target) : m * Math.pow(1 + l * s * target, 1 / l);
      worst = Math.max(worst, Math.abs(zScore(approx, measurement) - target));
    }
  }
  return worst;
}

const output = {};
let worstError = 0;

for (const indicator of INDICATORS) {
  const table = parseTable(indicator.file);
  output[indicator.key] = {};
  for (const sex of [1, 2]) {
    const sampled = sampleAdaptive(table[sex]);
    worstError = Math.max(worstError, verifyInterpolation(table[sex], sampled));
    output[indicator.key][sex === 1 ? "male" : "female"] = sampled;
  }
}

if (worstError > MAX_ALLOWED_Z_ERROR) {
  throw new Error(`Sampling loses too much accuracy: ${worstError} z`);
}

const round = (value) => Number(value.toFixed(6));

function renderTable(sampled, indent) {
  const pad = " ".repeat(indent);
  const rows = sampled.values
    .map((row) => `${pad}  [${row.map(round).join(", ")}]`)
    .join(",\n");
  return [
    `${pad}ages: [${sampled.ages.join(", ")}],`,
    `${pad}values: [`,
    rows,
    `${pad}]`
  ].join("\n");
}

const banner = `// GENERATED FILE - do not edit by hand.
//
// Source: WHO Child Growth Standards LMS tables (weianthro.txt, lenanthro.txt,
// hcanthro.txt) as published in the WHO's own \`anthro\` R package:
// https://github.com/WorldHealthOrganization/anthro/tree/master/data-raw/growthstandards
//
// The daily tables are sampled at ${SAMPLING_STEPS.map((entry) => `${entry.step}d up to day ${entry.untilDay}`).join(", ")}
// and interpolated at runtime.
// Worst-case z-score error introduced by that sampling: ${worstError.toFixed(5)}.
// For context, a z of 0.01 is under 20 grams at a three month old, well below
// the resolution of a home baby scale.

/** Box-Cox skewness, median and coefficient of variation for one age. */
export type WhoLms = readonly [number, number, number];

export type WhoLmsTable = {
  ages: readonly number[];
  values: readonly WhoLms[];
};

export const WHO_MAX_AGE_DAYS = ${MAX_AGE_DAYS};

export const WHO_GROWTH_STANDARDS = {
`;

const body = Object.entries(output)
  .map(([indicatorKey, bySex]) => {
    const sexes = Object.entries(bySex)
      .map(
        ([sexKey, sampled]) =>
          `    ${sexKey}: {\n${renderTable(sampled, 6)}\n    }`
      )
      .join(",\n");
    return `  ${indicatorKey}: {\n${sexes}\n  }`;
  })
  .join(",\n");

writeFileSync(
  OUTPUT_FILE,
  `${banner}${body}\n} satisfies Record<string, Record<string, WhoLmsTable>>;\n`,
  "utf8"
);

console.log(`Wrote ${OUTPUT_FILE}; worst interpolation error ${worstError.toFixed(5)} z`);
