type TagPillProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export default function TagPill({ label, active = false, onClick }: TagPillProps) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-[20px] px-[14px] py-[8px] text-[13px] font-medium transition-colors ${
        active
          ? "bg-secondary-purple text-white"
          : "bg-white border border-secondary-purple text-text-primary hover:bg-surface-lavender/40"
      }`}
    >
      {label}
    </button>
  );
}
