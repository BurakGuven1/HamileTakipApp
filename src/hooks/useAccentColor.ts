import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { listBabies, type Baby } from "@/api/babies";
import { getCurrentProfile, type Profile } from "@/api/profiles";
import { getAppTheme } from "@/theme";

type AccentInput = {
  babies?: Baby[] | null;
  profile?: Profile | null;
};

function getLatestBabyGender(babies: Baby[]) {
  if (babies.length === 0) return null;

  return [...babies].sort((first, second) => {
    const firstDate = Date.parse(first.created_at);
    const secondDate = Date.parse(second.created_at);
    return secondDate - firstDate;
  })[0]?.gender;
}

export function resolveAccentColor({ babies, profile }: AccentInput) {
  const babyGender = getLatestBabyGender(babies ?? []);
  const theme = getAppTheme(
    profile?.theme_preference,
    babyGender ?? (profile?.is_pregnant ? "belirtilmemis" : null)
  );

  return {
    accent: theme.accent,
    accentSoft: theme.accentSoft,
    primary: theme.primary,
    theme,
    tint: theme.primarySoft
  };
}

export function useAccentColor(input: AccentInput = {}) {
  const shouldFetchProfile = input.profile === undefined;
  const shouldFetchBabies = input.babies === undefined;

  const profileQuery = useQuery({
    enabled: shouldFetchProfile,
    queryKey: ["current-profile"],
    queryFn: getCurrentProfile
  });

  const babiesQuery = useQuery({
    enabled: shouldFetchBabies,
    queryKey: ["babies"],
    queryFn: listBabies
  });

  const profile = shouldFetchProfile ? profileQuery.data : input.profile;
  const babies = shouldFetchBabies ? babiesQuery.data : input.babies;

  return useMemo(
    () => resolveAccentColor({ babies, profile }),
    [babies, profile]
  );
}
