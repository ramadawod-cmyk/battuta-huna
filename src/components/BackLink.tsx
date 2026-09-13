import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "../lib/LanguageContext";
import type en from "../lib/i18n/en";

type BackLinkProps = {
  to: string;
  labelKey: keyof typeof en;
  className?: string;
};

/**
 * Replaces a literal "← Back to X" string -- a Unicode arrow baked into text can't be flipped by
 * CSS the way an icon can. The chevron auto-reverses position with the rest of this inline-flex
 * row under dir="rtl" (same as any flex container), and rtl:scale-x-[-1] flips which way it
 * points, so "back" still visually points toward where the reader would expect in either
 * direction. Pass only text/color/spacing utilities in `className` -- display (inline-flex) is
 * fixed by this component itself.
 */
export default function BackLink({ to, labelKey, className = "" }: BackLinkProps) {
  const { t } = useTranslation();
  return (
    <Link to={to} className={`inline-flex items-center gap-[4px] ${className}`}>
      <ChevronLeft size={14} strokeWidth={2.5} className="rtl:scale-x-[-1] shrink-0" />
      {t(labelKey)}
    </Link>
  );
}
