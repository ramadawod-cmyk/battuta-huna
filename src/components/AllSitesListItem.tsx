import { useState } from "react";
import ImagePlaceholder from "./ImagePlaceholder";

type AllSitesListItemProps = {
  name: string;
  category: string;
  description: string;
  className?: string;
  imageUrl?: string | null;
  onClick?: () => void;
};

export default function AllSitesListItem({
  name,
  category,
  description,
  className = "",
  imageUrl,
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
        <p className="font-heading font-semibold text-[15px] text-text-primary">{name}</p>
        <p className="font-medium text-[10px] text-secondary-purple tracking-[0.4px] mt-[4px]">{category}</p>
        <p className="text-[12px] text-text-secondary mt-[6px]">{description}</p>
      </div>
    </button>
  );
}
