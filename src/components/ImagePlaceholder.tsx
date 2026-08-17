export default function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center size-full text-secondary-purple/25 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-2/5 h-2/5">
        <path d="M12 21s-7-7.2-7-12a7 7 0 1 1 14 0c0 4.8-7 12-7 12Z" strokeLinejoin="round" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    </div>
  );
}
