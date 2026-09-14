import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Kilit ekranı sayacı (Live Activity / Dynamic Island) kullanıcı tercihi.
 *
 * Live Activity teknik olarak bildirim izninden bağımsızdır: izin verilmemiş
 * olsa da kilit ekranında görünür. Bu yüzden kapatma yolu sistem ayarlarında
 * her zaman bulunmaz ve uygulama kendi anahtarını sunmak zorundadır —
 * "kullanıcının kapatabildiği" olmak App Review'ın beklediği davranıştır.
 *
 * Varsayılan AÇIK: sayaç kullanıcının kendi başlattığı bir işlemin durumunu
 * gösterir, pazarlama değildir.
 */
const ENABLED_KEY = "live-activity-enabled-v1";

/** Senkron okuma gereken yollar (sayaç başlatma) için bellek önbelleği. */
let cached: boolean | null = null;

export async function getLiveActivityEnabled(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  if (cached !== null) return cached;

  try {
    const stored = await AsyncStorage.getItem(ENABLED_KEY);
    // Hiç yazılmamışsa varsayılan açık.
    cached = stored === null ? true : stored === "true";
  } catch {
    cached = true;
  }

  return cached;
}

export async function setLiveActivityEnabled(enabled: boolean): Promise<boolean> {
  cached = enabled;
  try {
    await AsyncStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    // Tercih diske yazılamadıysa bile oturum içinde geçerli olsun.
  }
  return enabled;
}
