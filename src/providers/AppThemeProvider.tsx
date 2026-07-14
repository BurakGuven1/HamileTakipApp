import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";

import { resolveAccentColor, useAccentColor } from "@/hooks/useAccentColor";

type AppThemeContextValue = ReturnType<typeof resolveAccentColor>;

const fallbackTheme = resolveAccentColor({ babies: [], profile: null });
const AppThemeContext = createContext<AppThemeContextValue>(fallbackTheme);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const accentColor = useAccentColor();

  return (
    <AppThemeContext.Provider value={accentColor}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
