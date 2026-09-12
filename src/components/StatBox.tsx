type StatBoxProps = {
  value: string | number;
  label: string;
  className?: string;
};

export default function StatBox({ value, label, className = "" }: StatBoxProps) {
  return (
    <div className={`bg-surface-lavender rounded-[16px] w-[220px] h-[90px] text-center flex flex-col items-center justify-center ${className}`}>
      <p className="font-heading font-semibold text-[24px] text-secondary-purple">{value}</p>
      <p className="text-[12px] text-text-secondary mt-[2px]">{label}</p>
    </div>
  );
}
