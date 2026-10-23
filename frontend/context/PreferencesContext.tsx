"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";

export interface AccessibilityPreferences {
  theme: ThemeMode;
  largerText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

interface PreferencesContextValue extends AccessibilityPreferences {
  hydrated: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLargerText: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
}

const STORAGE_KEY = "maatru-care-preferences";

const defaults: AccessibilityPreferences = {
  theme: "light",
  largerText: false,
  highContrast: false,
  reducedMotion: false,
};

const PreferencesContext =
  createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preferences, setPreferences] =
    useState<AccessibilityPreferences>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed: unknown = JSON.parse(stored);

        if (parsed && typeof parsed === "object") {
          const value = parsed as Partial<AccessibilityPreferences>;

          setPreferences({
            theme: value.theme === "dark" ? "dark" : "light",
            largerText:
              typeof value.largerText === "boolean"
                ? value.largerText
                : defaults.largerText,
            highContrast:
              typeof value.highContrast === "boolean"
                ? value.highContrast
                : defaults.highContrast,
            reducedMotion:
              typeof value.reducedMotion === "boolean"
                ? value.reducedMotion
                : defaults.reducedMotion,
          });
        }
      }
    } catch {
      // Continue with defaults if stored preferences are unavailable.
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const root = document.documentElement;

    root.dataset.theme = preferences.theme;
    root.dataset.largerText = String(preferences.largerText);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reducedMotion = String(preferences.reducedMotion);
    root.style.colorScheme = preferences.theme;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // Preferences still work for the current session if storage is unavailable.
    }
  }, [preferences, hydrated]);

  const updatePreference = useCallback(
    <K extends keyof AccessibilityPreferences>(
      key: K,
      value: AccessibilityPreferences[K],
    ) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const setTheme = useCallback(
    (theme: ThemeMode) => updatePreference("theme", theme),
    [updatePreference],
  );

  const toggleTheme = useCallback(() => {
    setPreferences((current) => ({
      ...current,
      theme: current.theme === "light" ? "dark" : "light",
    }));
  }, []);

  const setLargerText = useCallback(
    (enabled: boolean) => updatePreference("largerText", enabled),
    [updatePreference],
  );

  const setHighContrast = useCallback(
    (enabled: boolean) => updatePreference("highContrast", enabled),
    [updatePreference],
  );

  const setReducedMotion = useCallback(
    (enabled: boolean) => updatePreference("reducedMotion", enabled),
    [updatePreference],
  );

  return (
    <PreferencesContext.Provider
      value={{
        ...preferences,
        hydrated,
        setTheme,
        toggleTheme,
        setLargerText,
        setHighContrast,
        setReducedMotion,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error(
      "usePreferences must be used inside PreferencesProvider.",
    );
  }

  return context;
}
