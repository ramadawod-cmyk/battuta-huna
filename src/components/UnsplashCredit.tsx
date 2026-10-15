// Unsplash's API guidelines require visibly attributing the photographer, linked back to their
// profile, wherever a photo sourced from them is displayed. Photographer names and "Unsplash"
// itself are never translated, same convention as LANGUAGE_NAMES.
export default function UnsplashCredit({
  name,
  profileUrl,
  compact = false,
}: {
  name: string;
  profileUrl: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`absolute bottom-[6px] end-[6px] text-white/90 bg-black/35 rounded-[6px] leading-none ${
        compact ? "text-[7px] px-[4px] py-[1px]" : "text-[10px] px-[6px] py-[3px]"
      }`}
    >
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hover:underline"
      >
        {name}
      </a>
      {" · "}
      <a
        href="https://unsplash.com/?utm_source=battuta_huna&utm_medium=referral"
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hover:underline"
      >
        Unsplash
      </a>
    </div>
  );
}
