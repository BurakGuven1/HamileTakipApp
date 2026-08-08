import { StyleSheet, View } from "react-native";

import { vibrantColors } from "@/theme";

export function VibrantBackdrop() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <View style={[styles.blob, styles.blobPrimary]} />
      <View style={[styles.blob, styles.blobMint]} />
      <View style={[styles.blob, styles.blobPeach]} />
      <View style={styles.wave} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    borderRadius: 999,
    position: "absolute"
  },
  blobPrimary: {
    backgroundColor: vibrantColors.primaryLight,
    height: 210,
    right: -112,
    top: 44,
    transform: [{ rotate: "18deg" }],
    width: 250
  },
  blobMint: {
    backgroundColor: vibrantColors.mintSoft,
    height: 180,
    left: -118,
    top: 430,
    transform: [{ rotate: "-16deg" }],
    width: 232
  },
  blobPeach: {
    backgroundColor: vibrantColors.peachSoft,
    height: 150,
    right: -90,
    top: 890,
    width: 190
  },
  wave: {
    backgroundColor: vibrantColors.secondarySoft,
    borderRadius: 999,
    height: 54,
    left: "18%",
    opacity: 0.52,
    position: "absolute",
    right: -48,
    top: 720,
    transform: [{ rotate: "-8deg" }]
  }
});
