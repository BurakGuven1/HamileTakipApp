import { Link } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { spacing, typography } from "@/theme";

export default function SignInScreen() {
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={typography.heading1}>Tekrar hoş geldin</Text>
          <Text style={typography.body}>
            Bebeğin, gebelik haftan ve hatırlatmaların tek yerde.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <TextField label="E-posta" keyboardType="email-address" />
          <TextField label="Şifre" secureTextEntry />
          <Button label="Giriş yap" onPress={() => undefined} />
          <Button
            label="Apple ile devam et"
            variant="secondary"
            onPress={() => undefined}
          />
          <Button
            label="Google ile devam et"
            variant="secondary"
            onPress={() => undefined}
          />
        </View>

        <Link href="/onboarding" asChild>
          <Button label="Yeni hesap oluştur" variant="ghost" />
        </Link>
      </View>
    </Screen>
  );
}
