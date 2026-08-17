type ToggleSwitchProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
};

export default function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange?.(!checked)}
      className={`relative h-[24px] w-[44px] rounded-[12px] transition-colors ${
        checked ? "bg-secondary-purple" : "bg-white border border-text-secondary"
      }`}
    >
      <span
        className={`absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-all ${
          checked ? "left-[23px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}
