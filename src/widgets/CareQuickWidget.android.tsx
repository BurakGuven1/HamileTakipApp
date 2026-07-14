"use no memo";

import { FlexWidget, TextWidget, type TextWidgetStyle } from "react-native-android-widget";

const actionStyle: TextWidgetStyle = {
  backgroundColor: "#FFFFFF",
  borderRadius: 12,
  color: "#372F3D",
  fontSize: 12,
  fontWeight: "600",
  padding: 9
};

export function CareQuickAndroidWidget() {
  return (
    <FlexWidget
      accessibilityLabel="Anne artı hızlı bakım günlüğü"
      clickAction="OPEN_URI"
      clickActionData={{ uri: "hamiletakip://care-journal" }}
      style={{
        backgroundColor: "#EAF0EC",
        borderRadius: 22,
        flexDirection: "column",
        height: "match_parent",
        justifyContent: "space-between",
        padding: 16,
        width: "match_parent"
      }}
    >
      <TextWidget text="Anne+ · Bakım Günlüğü" style={{ color: "#6E8F7C", fontSize: 17, fontWeight: "700" }} />
      <TextWidget text="Emzirme, uyku ve bez kaydına hızlı ulaş." style={{ color: "#6F6673", fontSize: 12 }} />
      <FlexWidget style={{ flexDirection: "row", flexGap: 8 }}>
        <TextWidget text="Emzirme" clickAction="OPEN_URI" clickActionData={{ uri: "hamiletakip://care-journal?entry=breastfeeding" }} style={actionStyle} />
        <TextWidget text="Uyku" clickAction="OPEN_URI" clickActionData={{ uri: "hamiletakip://care-journal?entry=sleep" }} style={actionStyle} />
        <TextWidget text="Bez" clickAction="OPEN_URI" clickActionData={{ uri: "hamiletakip://care-journal?entry=diaper" }} style={actionStyle} />
      </FlexWidget>
    </FlexWidget>
  );
}
