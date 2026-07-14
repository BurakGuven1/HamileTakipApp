import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioStatus
} from "expo-audio";
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import type { Lullaby } from "@/api/lullabies";

type LullabyPlayerContextValue = {
  currentLullaby: Lullaby | null;
  pause: () => void;
  play: (lullaby: Lullaby, sourceUri: string) => Promise<void>;
  resume: () => void;
  status: AudioStatus;
  stop: () => void;
};

const LullabyPlayerContext = createContext<LullabyPlayerContextValue | null>(null);

export function LullabyPlayerProvider({ children }: PropsWithChildren) {
  const [player] = useState(() =>
    createAudioPlayer(null, { updateInterval: 500 })
  );
  const [currentLullaby, setCurrentLullaby] = useState<Lullaby | null>(null);
  const [status, setStatus] = useState<AudioStatus>(player.currentStatus);

  useEffect(() => {
    const subscription = player.addListener("playbackStatusUpdate", setStatus);

    setAudioModeAsync({
      interruptionMode: "doNotMix",
      playsInSilentMode: true,
      shouldPlayInBackground: true
    }).catch(() => undefined);

    return () => {
      subscription.remove();
      player.pause();
      player.clearLockScreenControls();
      player.remove();
    };
  }, [player]);

  const value = useMemo<LullabyPlayerContextValue>(
    () => ({
      currentLullaby,
      pause: () => player.pause(),
      play: async (lullaby, sourceUri) => {
        player.replace({ uri: sourceUri });
        player.setActiveForLockScreen(true, {
          albumTitle: "Anne+ Ninni Kütüphanesi",
          artist: "Anne+",
          title: lullaby.title
        });
        setCurrentLullaby(lullaby);
        player.play();
      },
      resume: () => player.play(),
      status,
      stop: () => {
        player.pause();
        player.seekTo(0).catch(() => undefined);
        player.clearLockScreenControls();
        setCurrentLullaby(null);
      }
    }),
    [currentLullaby, player, status]
  );

  return (
    <LullabyPlayerContext.Provider value={value}>
      {children}
    </LullabyPlayerContext.Provider>
  );
}

export function useLullabyPlayer() {
  const value = useContext(LullabyPlayerContext);
  if (!value) {
    throw new Error("useLullabyPlayer must be used within LullabyPlayerProvider.");
  }

  return value;
}
