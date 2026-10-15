import { useState } from "react";
import ImagePlaceholder from "./ImagePlaceholder";
import { useTranslation } from "../lib/LanguageContext";
import type { CategoryAccent } from "../lib/categories";

type PoiCardProps = {
  name: string;
  distance: string;
  category: string;
  description: string;
  className?: string;
  imageUrl?: string | null;
  categoryAccent?: CategoryAccent;
  onClick?: () => void;
};

const CATEGORY_TEXT_CLASSES: Record<CategoryAccent, string> = {
  purple: "text-secondary-purple",
  orange: "text-primary-orange",
  coral: "text-error",
  teal: "text-tertiary-teal",
};

export default function PoiCard({
  name,
  distance,
  category,
  description,
  className = "",
  imageUrl,
  categoryAccent = "purple",
  onClick,
}: PoiCardProps) {
  const { t } = useTranslation();
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className={`relative bg-white border border-secondary-purple rounded-[20px] w-[358px] max-w-full p-[19px] flex flex-col ${className}`}>
      <div className="flex gap-4">
        {/* aspect-square + self-stretch: a square that matches the height of the name/category/description block beside it, not the view-more link below */}
        <div className="bg-surface-lavender rounded-[12px] aspect-square self-stretch shrink-0 overflow-hidden">
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
        <div className="min-w-0 flex-1 flex flex-col">
          {/* pe-8 reserves room for a future top-right action (like/more) button, not added yet */}
          <button className="text-start pe-8" onClick={onClick}>
            <p className="font-heading font-semibold text-[17px] text-text-primary">{name}</p>
            <p className="font-medium text-[10px] text-text-secondary tracking-[0.4px] mt-[5px]">{distance}</p>
            <p className={`font-medium text-[11px] ${CATEGORY_TEXT_CLASSES[categoryAccent]} tracking-[0.44px] mt-[3px]`}>
              {category}
            </p>
          </button>
          <p className="text-[13px] leading-[1.5] text-text-primary mt-[12px] line-clamp-2">{description}</p>
        </div>
      </div>
      <div className="flex justify-end mt-[8px]">
        <button
          onClick={onClick}
          className="text-[12px] font-medium text-secondary-purple underline hover:opacity-70 transition-opacity"
        >
          {t("poiCard.viewMore")}
        </button>
      </div>
    </div>
  );
}
