"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/AuthContext";

export interface DemoProfile {
  name: string;
  phone: string;
  email: string;
}

export interface CarePreferences {
  preferredLanguage: "English" | "Hindi" | "Tamil";
  communicationPreference: "Email" | "Text message" | "Email and text message";
  caregiverUpdates: "Only approved updates" | "All coordination updates" | "No caregiver updates";
  appointmentReminders: "One day before" | "Two days before" | "One week before";
}

export interface NotificationPreferences {
  appointmentReminders: boolean;
  taskReminders: boolean;
  handoffNotifications: boolean;
  careCircleActivity: boolean;
}

interface LocalSettings {
  profile: DemoProfile;
  carePreferences: CarePreferences;
  notifications: NotificationPreferences;
}

interface LocalSettingsContextValue extends LocalSettings {
  hydrated: boolean;
  storageError: string;
  saveProfile: (profile: DemoProfile) => void;
  updateCarePreference: <K extends keyof CarePreferences>(
    key: K,
    value: CarePreferences[K],
  ) => void;
  toggleNotification: (key: keyof NotificationPreferences) => void;
}

const STORAGE_KEY = "maatru-care-demo-local-settings";

const defaults: LocalSettings = {
  profile: {
    name: "",
    phone: "",
    email: "",
  },
  carePreferences: {
    preferredLanguage: "English",
    communicationPreference: "Email and text message",
    caregiverUpdates: "Only approved updates",
    appointmentReminders: "One day before",
  },
  notifications: {
    appointmentReminders: true,
    taskReminders: true,
    handoffNotifications: true,
    careCircleActivity: false,
  },
};

const LocalSettingsContext = createContext<LocalSettingsContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fallback;
}

function hydrateSettings(value: unknown): LocalSettings {
  if (!isRecord(value)) return defaults;
  const profile = isRecord(value.profile) ? value.profile : {};
  const care = isRecord(value.carePreferences) ? value.carePreferences : {};
  const notifications = isRecord(value.notifications) ? value.notifications : {};

  return {
    profile: {
      name: typeof profile.name === "string" && profile.name.trim().length <= 80
        ? profile.name
        : defaults.profile.name,
      phone: typeof profile.phone === "string" && profile.phone.length <= 32
        ? profile.phone
        : defaults.profile.phone,
      email: typeof profile.email === "string" && profile.email.length <= 254
        ? profile.email
        : defaults.profile.email,
    },
    carePreferences: {
      preferredLanguage: oneOf(care.preferredLanguage, ["English", "Hindi", "Tamil"], defaults.carePreferences.preferredLanguage),
      communicationPreference: oneOf(care.communicationPreference, ["Email", "Text message", "Email and text message"], defaults.carePreferences.communicationPreference),
      caregiverUpdates: oneOf(care.caregiverUpdates, ["Only approved updates", "All coordination updates", "No caregiver updates"], defaults.carePreferences.caregiverUpdates),
      appointmentReminders: oneOf(care.appointmentReminders, ["One day before", "Two days before", "One week before"], defaults.carePreferences.appointmentReminders),
    },
    notifications: {
      appointmentReminders: typeof notifications.appointmentReminders === "boolean" ? notifications.appointmentReminders : defaults.notifications.appointmentReminders,
      taskReminders: typeof notifications.taskReminders === "boolean" ? notifications.taskReminders : defaults.notifications.taskReminders,
      handoffNotifications: typeof notifications.handoffNotifications === "boolean" ? notifications.handoffNotifications : defaults.notifications.handoffNotifications,
      careCircleActivity: typeof notifications.careCircleActivity === "boolean" ? notifications.careCircleActivity : defaults.notifications.careCircleActivity,
    },
  };
}

export function LocalSettingsProvider({ children }: { children: ReactNode }) {
  const { account } = useAuth();
  const storageKey = account ? `${STORAGE_KEY}:${account.subject}` : null;
  // Keep auth callback children mounted, but scope both state and persistence
  // to the subject that loaded them. A new key must never receive old state.
  const [snapshot, setSnapshot] = useState<{ storageKey: string | null; settings: LocalSettings; hydrated: boolean }>({ storageKey: null, settings: defaults, hydrated: false });
  const settings = snapshot.storageKey === storageKey ? snapshot.settings : defaults;
  const hydrated = snapshot.storageKey === storageKey && snapshot.hydrated;
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    let next = defaults;
    let error = "";
    try {
      const stored = storageKey ? window.localStorage.getItem(storageKey) : null;
      if (stored) {
        next = hydrateSettings(JSON.parse(stored));
      }
    } catch {
      error = "Saved browser preferences could not be read. Default preferences apply for this visit.";
    }
    // Browser-only state is loaded after mount, without exposing another subject.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnapshot({ storageKey, settings: next, hydrated: true });
    setStorageError(error);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated || !storageKey) return;
    let error = "";
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      error = "Browser preferences could not be saved. Changes apply for this visit.";
    }
    const timer = window.setTimeout(() => setStorageError(error), 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, settings, storageKey]);

  const setSettings = useCallback((change: (current: LocalSettings) => LocalSettings) => {
    setSnapshot(current => current.storageKey === storageKey && current.hydrated
      ? { ...current, settings: change(current.settings) } : current);
  }, [storageKey]);

  const saveProfile = useCallback((profile: DemoProfile) => {
    setSettings((current) => ({ ...current, profile }));
  }, [setSettings]);

  const updateCarePreference = useCallback(
    <K extends keyof CarePreferences>(key: K, value: CarePreferences[K]) => {
      setSettings((current) => ({
        ...current,
        carePreferences: { ...current.carePreferences, [key]: value },
      }));
    },
    [setSettings],
  );

  const toggleNotification = useCallback((key: keyof NotificationPreferences) => {
    setSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: !current.notifications[key] },
    }));
  }, [setSettings]);

  return (
    <LocalSettingsContext.Provider
      value={{ ...settings, hydrated, storageError, saveProfile, updateCarePreference, toggleNotification }}
    >
      {children}
    </LocalSettingsContext.Provider>
  );
}

export function useLocalSettings() {
  const context = useContext(LocalSettingsContext);
  if (!context) throw new Error("useLocalSettings must be used inside LocalSettingsProvider.");
  return context;
}
