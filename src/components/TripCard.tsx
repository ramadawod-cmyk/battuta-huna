import UnsplashCredit from "./UnsplashCredit";

type TripCardProps = {
  city: string;
  meta: string;
  tags: string[];
  className?: string;
  imageUrl?: string | null;
  imageCredit?: { name: string; profileUrl: string } | null;
  onImageError?: () => void;
  onClick?: () => void;
};

export default function TripCard({ city, meta, tags, className = "", imageUrl, imageCredit, onImageError, onClick }: TripCardProps) {
  return (
    <button
      onClick={onClick}
      className={`text-start bg-white rounded-[20px] shadow-[0px_8px_24px_0px_rgba(48,48,48,0.06)] w-[358px] max-w-full overflow-hidden ${className}`}
    >
      <div className="relative bg-surface-lavender h-[140px]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={city}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              onImageError?.();
            }}
            className="size-full object-cover"
          />
        )}
        {imageCredit && <UnsplashCredit name={imageCredit.name} profileUrl={imageCredit.profileUrl} compact />}
      </div>
      <div className="p-[19px]">
        <p className="font-heading font-semibold text-[17px] text-text-primary">{city}</p>
        <p className="font-medium text-[10px] text-text-secondary tracking-[0.4px] mt-[6px]">{meta}</p>
        <div className="flex gap-[8px] mt-[9px]">
          {tags.map((tag) => (
            <span key={tag} className="bg-surface-lavender text-secondary-purple text-[10px] font-medium tracking-[0.4px] rounded-[20px] px-[10px] py-[4px]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
