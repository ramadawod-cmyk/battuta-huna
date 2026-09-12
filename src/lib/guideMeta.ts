import { Backpack, Car, Clock, Handshake, Languages, ShieldCheck, Utensils, Wallet, type LucideIcon } from "lucide-react";

export type GuideAccent = "purple" | "orange" | "coral" | "teal";

// Keys match what ensureCityTips generates (src/lib/cityTips.ts) and what's already stored for
// the handful of cities seeded before that existed -- both use the same key set, so every city's
// guide renders with a proper icon/title instead of falling back to a generic pin + raw key name.
export const GUIDE_META: Record<string, { title: string; icon: LucideIcon; accent: GuideAccent }> = {
  getting_around: { title: "Getting around", icon: Car, accent: "purple" },
  safety: { title: "Safety", icon: ShieldCheck, accent: "orange" },
  where_to_eat: { title: "Where to eat", icon: Utensils, accent: "coral" },
  what_to_have: { title: "What to have", icon: Backpack, accent: "teal" },
  local_culture: { title: "Local culture", icon: Handshake, accent: "purple" },
  money_payments: { title: "Money & payments", icon: Wallet, accent: "orange" },
  language_basics: { title: "Language basics", icon: Languages, accent: "coral" },
  best_time_of_day: { title: "Best time of day", icon: Clock, accent: "teal" },
};

export const GUIDE_ACCENT_CLASSES: Record<GuideAccent, { bg: string; text: string }> = {
  purple: { bg: "bg-secondary-purple/15", text: "text-secondary-purple" },
  orange: { bg: "bg-primary-orange/15", text: "text-primary-orange" },
  coral: { bg: "bg-error/15", text: "text-error" },
  teal: { bg: "bg-tertiary-teal/15", text: "text-tertiary-teal" },
};
