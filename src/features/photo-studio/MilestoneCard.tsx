import { Image } from "expo-image";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { fonts } from "@/theme";

import { getMilestoneSlots } from "./milestone";
import {
  Butterfly,
  CloudPuff,
  GardenFlower,
  MountainRange,
  Mushroom,
  PineTree,
  SignBoard,
  SignPost,
  SunBurst,
  Tent
} from "./stickers";
import type { MilestoneConcept, MilestoneValues, StudioPalette } from "./types";

/** Dışa aktarılan kartın en-boy oranı; Instagram gönderisiyle aynı. */
export const MILESTONE_ASPECT_RATIO = 4 / 5;

type MilestoneCardProps = {
  concept: MilestoneConcept;
  photoUri: string;
  values: MilestoneValues;
  width: number;
};

const BADGE_LABELS = {
  age: "AY",
  date: "TARİH",
  height: "BOY",
  weight: "KİLO"
} as const;

/**
 * Fotoğraf hiç işlenmez: olduğu gibi altta durur, süslemeler üstüne ayrı bir
 * katman olarak biner. Bu yüzden bebeğin yüzü, rengi, kadrajı değişmez.
 * Süslemeler de kartın kenarlarında kalır; orta bölge fotoğrafa ayrılmıştır.
 */
export const MilestoneCard = forwardRef<View, MilestoneCardProps>(function MilestoneCard(
  { concept, photoUri, values, width },
  ref
) {
  const height = width / MILESTONE_ASPECT_RATIO;
  const slots = getMilestoneSlots(values);
  const palette = concept.palette;

  return (
    <View collapsable={false} ref={ref} style={[styles.card, { height, width }]}>
      <Image
        contentFit="cover"
        source={{ uri: photoUri }}
        style={StyleSheet.absoluteFill}
        transition={120}
      />

      <Decor concept={concept} height={height} width={width} />

      {slots.map((slot) => {
        const left = slot.align === "left" ? slot.position.x * width : undefined;
        const right =
          slot.align === "right" ? (1 - slot.position.x) * width : undefined;
        const top = slot.position.y * height;
        const maxWidth = slot.width * width;

        if (slot.id === "headline") {
          return (
            <View key={slot.id} style={[styles.absolute, { left, maxWidth, top }]}>
              {concept.headline.map((line, index) => (
                <Text
                  key={line}
                  style={[
                    styles.headline,
                    {
                      color: index % 2 === 0 ? palette.ink : palette.accent,
                      fontSize: width * 0.075,
                      lineHeight: width * 0.082
                    }
                  ]}
                >
                  {line}
                </Text>
              ))}
            </View>
          );
        }

        if (slot.id === "caption") {
          return (
            <View
              key={slot.id}
              style={[
                styles.absolute,
                styles.captionPlate,
                {
                  backgroundColor: palette.paper,
                  borderColor: palette.ink,
                  left,
                  maxWidth,
                  top
                }
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.caption, { color: palette.ink, fontSize: width * 0.036 }]}
              >
                {values.caption}
              </Text>
            </View>
          );
        }

        if (slot.id === "age") {
          return (
            <View key={slot.id} style={[styles.absolute, { right, top, width: maxWidth }]}>
              <AgePlaque label={values.ageLabel ?? ""} palette={palette} width={maxWidth} />
            </View>
          );
        }

        const value =
          slot.id === "weight"
            ? values.weightLabel
            : slot.id === "height"
              ? values.heightLabel
              : values.dateLabel;

        return (
          <View
            key={slot.id}
            style={[
              styles.absolute,
              styles.badge,
              {
                backgroundColor: palette.paper,
                borderColor: palette.ink,
                maxWidth,
                right,
                top
              }
            ]}
          >
            <View style={[styles.badgeTag, { backgroundColor: palette.accent }]}>
              <Text style={[styles.badgeTagText, { fontSize: width * 0.026 }]}>
                {BADGE_LABELS[slot.id]}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.badgeValue, { color: palette.ink, fontSize: width * 0.042 }]}
            >
              {value}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

/** Ay tabelası: kartın imzası. Örnekteki ahşap levhanın sade karşılığı. */
function AgePlaque({
  label,
  palette,
  width
}: {
  label: string;
  palette: StudioPalette;
  width: number;
}) {
  const [value, ...rest] = label.split(" ");
  const unit = rest.join(" ");

  return (
    <View style={styles.plaqueWrapper}>
      <View
        style={[
          styles.plaque,
          { backgroundColor: palette.paper, borderColor: palette.ink, width }
        ]}
      >
        <Text style={[styles.plaqueValue, { color: palette.ink, fontSize: width * 0.42 }]}>
          {value}
        </Text>
        {unit ? (
          <View style={[styles.plaqueUnit, { backgroundColor: palette.nature }]}>
            <Text style={[styles.plaqueUnitText, { fontSize: width * 0.1 }]}>{unit}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.plaquePost, { backgroundColor: palette.accentSoft, borderColor: palette.ink }]} />
    </View>
  );
}

/**
 * Konsept süslemeleri. Hepsi kartın kenarlarına yerleşir; bebeğin durduğu orta
 * bölgeye hiçbir öğe girmez.
 */
function Decor({
  concept,
  height,
  width
}: {
  concept: MilestoneConcept;
  height: number;
  width: number;
}) {
  const palette = concept.palette;
  const unit = width * 0.12;

  if (concept.decor === "campsite") {
    return (
      <>
        <View style={[styles.absolute, { left: width * 0.05, top: height * 0.34 }]}>
          <SignPost palette={palette} size={unit * 1.6} />
          <View style={[styles.absolute, { left: unit * 0.4, top: unit * 0.15 }]}>
            <SignBoard palette={palette} size={unit * 1.35} />
          </View>
          <View style={[styles.absolute, { left: unit * 0.1, top: unit * 0.75 }]}>
            <SignBoard palette={palette} pointing="left" size={unit * 1.35} />
          </View>
        </View>
        <View style={[styles.absolute, { left: width * 0.04, top: height * 0.72 }]}>
          <PineTree palette={palette} size={unit} />
        </View>
        <View style={[styles.absolute, { left: width * 0.13, top: height * 0.76 }]}>
          <PineTree palette={palette} size={unit * 0.72} />
        </View>
        <View style={[styles.absolute, { bottom: height * 0.04, left: width * 0.42 }]}>
          <Tent palette={palette} size={unit * 1.3} />
        </View>
        <View style={[styles.absolute, { right: width * 0.06, top: height * 0.03 }]}>
          <SunBurst palette={palette} size={unit * 0.8} />
        </View>
        <View style={[styles.absolute, { left: width * 0.3, top: height * 0.04 }]}>
          <MountainRange palette={palette} size={unit * 1.1} />
        </View>
      </>
    );
  }

  if (concept.decor === "forest") {
    return (
      <>
        <View style={[styles.absolute, { bottom: height * 0.03, left: width * 0.03 }]}>
          <PineTree palette={palette} size={unit * 1.2} />
        </View>
        <View style={[styles.absolute, { bottom: height * 0.03, left: width * 0.17 }]}>
          <PineTree palette={palette} size={unit * 0.85} />
        </View>
        <View style={[styles.absolute, { bottom: height * 0.04, right: width * 0.06 }]}>
          <Mushroom palette={palette} size={unit * 0.8} />
        </View>
        <View style={[styles.absolute, { bottom: height * 0.03, right: width * 0.18 }]}>
          <Mushroom palette={palette} size={unit * 0.55} />
        </View>
        <View style={[styles.absolute, { left: width * 0.06, top: height * 0.4 }]}>
          <GardenFlower palette={palette} size={unit * 0.75} />
        </View>
      </>
    );
  }

  if (concept.decor === "clouds") {
    return (
      <>
        <View style={[styles.absolute, { left: width * 0.04, top: height * 0.32 }]}>
          <CloudPuff palette={palette} size={unit * 1.5} />
        </View>
        <View style={[styles.absolute, { bottom: height * 0.06, left: width * 0.05 }]}>
          <CloudPuff palette={palette} size={unit * 1.1} />
        </View>
        <View style={[styles.absolute, { bottom: height * 0.1, right: width * 0.05 }]}>
          <CloudPuff palette={palette} size={unit * 0.9} />
        </View>
        <View style={[styles.absolute, { right: width * 0.08, top: height * 0.02 }]}>
          <SunBurst palette={palette} size={unit * 0.7} />
        </View>
      </>
    );
  }

  return (
    <>
      <View style={[styles.absolute, { bottom: height * 0.03, left: width * 0.04 }]}>
        <GardenFlower palette={palette} size={unit * 1.1} />
      </View>
      <View style={[styles.absolute, { bottom: height * 0.02, left: width * 0.2 }]}>
        <GardenFlower palette={palette} size={unit * 0.8} />
      </View>
      <View style={[styles.absolute, { bottom: height * 0.04, right: width * 0.07 }]}>
        <GardenFlower palette={palette} size={unit * 0.9} />
      </View>
      <View style={[styles.absolute, { left: width * 0.07, top: height * 0.36 }]}>
        <Butterfly palette={palette} size={unit * 0.75} />
      </View>
      <View style={[styles.absolute, { right: width * 0.1, top: height * 0.02 }]}>
        <Butterfly palette={palette} size={unit * 0.6} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#000000",
    overflow: "hidden"
  },
  absolute: {
    position: "absolute"
  },
  headline: {
    fontFamily: fonts.displayBold,
    letterSpacing: -0.5
  },
  captionPlate: {
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  caption: {
    fontFamily: fonts.bodyBold
  },
  badge: {
    alignItems: "center",
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 2,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  badgeTag: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3
  },
  badgeTagText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    letterSpacing: 0.6
  },
  badgeValue: {
    fontFamily: fonts.displayBold
  },
  plaqueWrapper: {
    alignItems: "center"
  },
  plaque: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 3,
    paddingBottom: 10,
    paddingTop: 6
  },
  plaqueValue: {
    fontFamily: fonts.displayBold,
    includeFontPadding: false
  },
  plaqueUnit: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  plaqueUnitText: {
    color: "#FFFFFF",
    fontFamily: fonts.bodyBold,
    letterSpacing: 1
  },
  plaquePost: {
    borderWidth: 2,
    height: 34,
    width: 12
  }
});
