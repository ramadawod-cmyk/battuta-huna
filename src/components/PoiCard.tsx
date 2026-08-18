import { useState } from "react";
import ImagePlaceholder from "./ImagePlaceholder";

type PoiCardProps = {
  name: string;
  distance: string;
  category: string;
  description: string;
  className?: string;
  imageUrl?: string | null;
  onClick?: () => void;
};

export default function PoiCard({
  name,
  distance,
  category,
  description,
  className = "",
  imageUrl,
  onClick,
}: PoiCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className={`bg-white border border-secondary-purple rounded-[20px] w-[358px] p-[19px] ${className}`}>
      <div className="flex justify-between gap-4">
        <button className="text-left" onClick={onClick}>
          <p className="font-heading font-semibold text-[17px] text-text-primary">{name}</p>
          <p className="font-medium text-[10px] text-text-secondary tracking-[0.4px] mt-[5px]">{distance}</p>
          <p className="font-medium text-[11px] text-secondary-purple tracking-[0.44px] mt-[3px]">{category}</p>
        </button>
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
      </div>
      <p className="text-[13px] leading-[1.5] text-text-primary mt-[16px]">{description}</p>
    </div>
  );
}
