import "expo-router/entry";

import { registerWidgetTaskHandler } from "react-native-android-widget";

import { androidWidgetTaskHandler } from "./src/widgets/androidWidgetTaskHandler";

registerWidgetTaskHandler(androidWidgetTaskHandler);
