import { useState } from "react";
import ImagePlaceholder from "./ImagePlaceholder";

type AllSitesListItemProps = {
  name: string;
  category: string;
  description: string;
  className?: string;
  imageUrl?: string | null;
  // Small pill next to the name -- e.g. "ACTIVITY" for an activity-sourced item. Omitted by every
  // existing caller, so this is purely additive.
  badge?: string;
  onClick?: () => void;
};

export default function AllSitesListItem({
  name,
  category,
  description,
  className = "",
  imageUrl,
  badge,
  onClick,
}: AllSitesListItemProps) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      className={`text-left flex gap-[16px] items-start bg-white border border-secondary-purple rounded-[20px] w-full max-w-[358px] p-[19px] ${className}`}
    >
      <div className="bg-surface-lavender rounded-[12px] size-[60px] shrink-0 overflow-hidden">
        {imageUrl && !imgFailed ? (
          <img
            src={imageUrl}
            alt={name}
            onError={() => setImgFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <ImagePlaceholder />
        )}
      </div>
      <div>
        <div className="flex items-center gap-[6px]">
          <p className="font-heading font-semibold text-[15px] text-text-primary">{name}</p>
          {badge && (
            <span className="shrink-0 rounded-[6px] bg-secondary-purple/15 text-secondary-purple text-[9px] font-bold tracking-[0.4px] px-[5px] py-[1px]">
              {badge}
            </span>
          )}
        </div>
        <p className="font-medium text-[10px] text-secondary-purple tracking-[0.4px] mt-[4px]">{category}</p>
        <p className="text-[12px] text-text-secondary mt-[6px]">{description}</p>
      </div>
    </button>
  );
}
