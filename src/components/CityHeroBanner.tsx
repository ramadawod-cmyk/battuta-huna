type CityHeroBannerProps = {
  city: string;
  tagline?: string;
  className?: string;
};

export default function CityHeroBanner({ city, tagline = "CULTURAL DISCOVERY", className = "" }: CityHeroBannerProps) {
  return (
    <div className={`relative bg-secondary-purple rounded-[24px] w-[358px] h-[200px] overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="absolute left-[24px] top-[140px]">
        <p className="font-heading font-semibold text-[24px] text-white">{city}</p>
        <p className="font-medium text-[10px] text-white/72 tracking-[1px] mt-[2px]">{tagline}</p>
      </div>
    </div>
  );
}
