import { Backpack, Car, Clock, Handshake, Languages, ShieldCheck, Utensils, Wallet, type LucideIcon } from "lucide-react";
import type en from "./i18n/en";

export type GuideAccent = "purple" | "orange" | "coral" | "teal";

// Keys match what ensureCityTips generates (src/lib/cityTips.ts) and what's already stored for
// the handful of cities seeded before that existed -- both use the same key set, so every city's
// guide renders with a proper icon/title instead of falling back to a generic pin + raw key name.
export const GUIDE_META: Record<string, { labelKey: keyof typeof en; icon: LucideIcon; accent: GuideAccent }> = {
  getting_around: { labelKey: "guide.gettingAround", icon: Car, accent: "purple" },
  safety: { labelKey: "guide.safety", icon: ShieldCheck, accent: "orange" },
  where_to_eat: { labelKey: "guide.whereToEat", icon: Utensils, accent: "coral" },
  what_to_have: { labelKey: "guide.whatToHave", icon: Backpack, accent: "teal" },
  local_culture: { labelKey: "guide.localCulture", icon: Handshake, accent: "purple" },
  money_payments: { labelKey: "guide.moneyPayments", icon: Wallet, accent: "orange" },
  language_basics: { labelKey: "guide.languageBasics", icon: Languages, accent: "coral" },
  best_time_of_day: { labelKey: "guide.bestTimeOfDay", icon: Clock, accent: "teal" },
};

export const GUIDE_ACCENT_CLASSES: Record<GuideAccent, { bg: string; text: string }> = {
  purple: { bg: "bg-secondary-purple/15", text: "text-secondary-purple" },
  orange: { bg: "bg-primary-orange/15", text: "text-primary-orange" },
  coral: { bg: "bg-error/15", text: "text-error" },
  teal: { bg: "bg-tertiary-teal/15", text: "text-tertiary-teal" },
};
