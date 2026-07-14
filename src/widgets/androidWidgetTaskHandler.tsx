import type { WidgetTaskHandlerProps } from "react-native-android-widget";

import { CareQuickAndroidWidget } from "@/widgets/CareQuickWidget.android";

export async function androidWidgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== "CareQuickWidget") return;

  if (
    props.widgetAction === "WIDGET_ADDED" ||
    props.widgetAction === "WIDGET_UPDATE" ||
    props.widgetAction === "WIDGET_RESIZED"
  ) {
    props.renderWidget(<CareQuickAndroidWidget />);
  }
}
