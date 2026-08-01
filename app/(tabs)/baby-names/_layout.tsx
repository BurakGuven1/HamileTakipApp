import { Stack } from "expo-router";

export default function BabyNamesLayout() {
  return (
    <Stack
      screenOptions={{
        animation: "fade",
        headerShown: false
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="favorites" />
    </Stack>
  );
}
