type TripCardProps = {
  city: string;
  meta: string;
  tags: string[];
  className?: string;
  imageUrl?: string | null;
  onClick?: () => void;
};

export default function TripCard({ city, meta, tags, className = "", imageUrl, onClick }: TripCardProps) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white border border-secondary-purple rounded-[20px] w-[358px] overflow-hidden ${className}`}
    >
      <div className="bg-surface-lavender h-[140px]">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={city}
            onError={(e) => (e.currentTarget.style.display = "none")}
            className="size-full object-cover"
          />
        )}
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
