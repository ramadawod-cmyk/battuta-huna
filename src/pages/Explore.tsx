import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TagPill from "../components/TagPill";
import PoiCard from "../components/PoiCard";
import { useCity } from "../lib/CityContext";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { haversineMeters, getCurrentPosition } from "../lib/geo";
import { CATEGORIES as SITE_CATEGORIES } from "../lib/categories";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Site } from "../lib/types";

const CATEGORIES = [
  "All",
  ...SITE_CATEGORIES,
];

function formatDistance(meters: number | null): string {
  if (meters === null) return "";
  if (meters < 1000) return `${Math.round(meters)} M`;
  return `${(meters / 1000).toFixed(1)} KM`;
}

function PoiCardWithImage({
  site,
  distance,
  onClick,
}: {
  site: Site;
  distance: string;
  onClick: () => void;
}) {
  const imageUrl = useWikiThumbnail(site.name);
  return (
    <PoiCard
      name={site.name}
      distance={distance}
      category={site.category.toUpperCase()}
      description={site.description}
      imageUrl={site.image_url || imageUrl}
      mapUrl={site.map_url}
      onClick={onClick}
    />
  );
}

export default function Explore() {
  const { city, sites, heroImageUrl, status, error, locate } = useCity();
  const [activeCategory, setActiveCategory] = useState("All");
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const navigate = useNavigate();

  useTrackScreen("explore");

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImageUrl]);

  useEffect(() => {
    if (status === "idle") {
      locate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status === "ready" && !userPos) {
      getCurrentPosition()
        .then((pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }))
        .catch(() => {});
    }
  }, [status, userPos]);

  const visibleSites =
    activeCategory === "All" ? sites : sites.filter((s) => s.category === activeCategory);

  const sitesWithDistance = useMemo(
    () =>
      visibleSites
        .map((site) => ({
          site,
          distanceMeters: userPos ? haversineMeters(userPos.lat, userPos.lng, site.lat, site.lng) : null,
        }))
        .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0)),
    [visibleSites, userPos],
  );

  return (
    <div className="px-[32px] py-[32px] max-w-[1260px]">
      <p className="text-[16px] text-text-primary">Cultural Discovery{city ? ` · ${city.name}` : ""}</p>

      <div className="relative bg-secondary-purple rounded-[24px] w-full h-[320px] overflow-hidden mt-[36px]">
        {heroImageUrl && !heroImageFailed ? (
          <>
            <img
              src={heroImageUrl}
              alt={city?.name || ""}
              onError={() => {
                setHeroImageFailed(true);
                track("Hero Image Broken", { city_id: city?.id, recovered: false });
              }}
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-[#2d2a5c] to-secondary-purple" />
        )}
        <div className="absolute left-[24px] bottom-[24px]">
          <p className="font-heading font-semibold text-[24px] text-white">{city?.name || "Locating…"}</p>
          <p className="font-medium text-[10px] text-white/72 tracking-[1px] mt-[2px]">CULTURAL DISCOVERY</p>
        </div>
      </div>

      <div className="bg-surface-lavender rounded-[16px] mt-[24px] px-[24px] py-[14px]">
        <p className="font-medium text-[11px] text-secondary-purple tracking-[0.44px]">
          {status === "locating" && "LOCATING YOU"}
          {status === "loading-sites" && "DISCOVERING SITES"}
          {status === "ready" && "NEARBY"}
          {status === "error" && "LOCATION UNAVAILABLE"}
          {status === "idle" && "LOCATING YOU"}
        </p>
        <p className="text-[14px] text-text-secondary mt-[4px]">
          {status === "locating" && "Finding your place in the world…"}
          {status === "loading-sites" &&
            "Battuta is gathering cultural sites for your city for the first time — this can take a moment."}
          {status === "ready" && `${sites.length} sites within range`}
          {status === "error" && (error || "Couldn't detect your location.")}
          {status === "idle" && "Finding your place in the world…"}
        </p>
        {status === "error" && (
          <button
            onClick={locate}
            className="mt-[10px] bg-secondary-purple text-white text-[12px] font-medium rounded-[16px] px-[14px] py-[6px]"
          >
            Try again
          </button>
        )}
      </div>

      <p className="font-medium text-[12px] text-text-primary tracking-[0.48px] mt-[20px]">
        NEARBY · WITHIN RANGE{city?.locality ? ` · ${city.locality.toUpperCase()}` : ""}
      </p>

      <div className="flex gap-[10px] mt-[16px] flex-wrap">
        {CATEGORIES.map((cat) => (
          <TagPill
            key={cat}
            label={cat}
            active={activeCategory === cat}
            onClick={() => {
              track("Site Filter Toggled", { tag: cat, active: activeCategory !== cat, view: "nearby" });
              setActiveCategory(cat);
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-[20px] mt-[20px]">
        {sitesWithDistance.map(({ site, distanceMeters }) => (
          <PoiCardWithImage
            key={site.id}
            site={site}
            distance={formatDistance(distanceMeters)}
            onClick={() => {
              track("Site Viewed", { name: site.name, category: site.category, source: "explore" });
              navigate(`/site/${encodeURIComponent(site.name)}`);
            }}
          />
        ))}
        {status === "ready" && sitesWithDistance.length === 0 && (
          <p className="text-text-secondary text-[14px]">No sites found for this category yet.</p>
        )}
      </div>
    </div>
  );
}
