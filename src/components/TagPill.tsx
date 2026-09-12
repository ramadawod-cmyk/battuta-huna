import type { CategoryAccent } from "../lib/categories";

type TagPillProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
  accent?: CategoryAccent;
};

const ACCENT_CLASSES: Record<CategoryAccent, { border: string; bg: string }> = {
  purple: { border: "border-secondary-purple", bg: "bg-secondary-purple" },
  orange: { border: "border-primary-orange", bg: "bg-primary-orange" },
  coral: { border: "border-error", bg: "bg-error" },
  teal: { border: "border-tertiary-teal", bg: "bg-tertiary-teal" },
};

export default function TagPill({ label, active = false, onClick, accent = "purple" }: TagPillProps) {
  const { border, bg } = ACCENT_CLASSES[accent];
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-[20px] px-[14px] py-[8px] text-[13px] font-medium transition-colors ${
        active ? `${bg} text-white` : `bg-white border ${border} text-text-primary hover:bg-surface-lavender/40`
      }`}
    >
      {label}
    </button>
  );
}
