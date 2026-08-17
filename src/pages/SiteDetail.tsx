import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import { useCity } from "../lib/CityContext";
import { db, planAgent, type WikiImage, wikiImagesBySearch } from "../lib/api";
import { normalizeCategory } from "../lib/categories";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Site } from "../lib/types";

export default function SiteDetail() {
  const { siteName } = useParams<{ siteName: string }>();
  const { city } = useCity();
  const navigate = useNavigate();

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<WikiImage[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [longDescription, setLongDescription] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  const name = siteName ? decodeURIComponent(siteName) : "";

  useTrackScreen("site_detail");

  useEffect(() => {
    if (!name || !city) return;
    setLoading(true);
    db("getSite", { name, cityId: city.id })
      .then((result: Site | null) => {
        setSite(result ? { ...result, category: normalizeCategory(result.category) } : null);
        setLongDescription(result?.long_description || null);
        if (result?.long_description) {
          track("Site Description Generated", { name, source: "cache", success: true });
        }
      })
      .catch(() => setSite(null))
      .finally(() => setLoading(false));
    wikiImagesBySearch(name)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [name, city]);

  useEffect(() => {
    if (!site || site.long_description || generatingDescription) return;
    setGeneratingDescription(true);
    const system =
      "You write warm, editorial 3-4 sentence descriptions of cultural sites for travellers, for the Battuta app. No markdown, no bullet points, no em dashes.";
    planAgent(system, [
      { role: "user", content: `Write a description of ${site.name} in ${city?.name ?? ""}. Context: ${site.description}` },
    ])
      .then(async (text) => {
        const cleaned = text.trim();
        setLongDescription(cleaned);
        track("Site Description Generated", { name: site.name, source: "ai", success: true });
        if (city) {
          await db("saveLongDescription", { name: site.name, cityId: city.id, longDescription: cleaned });
        }
      })
      .catch((err) => {
        track("Site Description Generated", {
          name: site.name,
          source: "ai",
          success: false,
          message: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => setGeneratingDescription(false));
  }, [site, city, generatingDescription]);

  const activePhoto = photos[photoIndex];

  if (loading) {
    return <div className="px-[48px] py-[40px] text-text-secondary">Loading…</div>;
  }

  if (!site) {
    return (
      <div className="px-[48px] py-[40px]">
        <p className="text-text-primary">Couldn't find "{name}".</p>
        <button className="mt-[16px] font-medium text-[13px] text-text-secondary" onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="px-[48px] py-[40px] max-w-[1180px]">
      <button className="font-medium text-[13px] text-text-secondary" onClick={() => navigate(-1)}>
        ← Back to Explore
      </button>

      <div className="flex gap-[48px] mt-[32px] items-start flex-wrap">
        <div>
          <div className="bg-surface-lavender rounded-[24px] size-[640px] max-w-full overflow-hidden relative">
            {activePhoto && (
              <img
                src={activePhoto.url}
                alt={site.name}
                onError={(e) => (e.currentTarget.style.display = "none")}
                className="size-full object-cover"
              />
            )}
            {photos.length > 1 && (
              <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 flex gap-[6px]">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIndex(i)}
                    className={`size-[8px] rounded-full ${i === photoIndex ? "bg-secondary-purple" : "bg-white/70"}`}
                  />
                ))}
              </div>
            )}
          </div>
          {activePhoto?.attribution && (
            <p className="text-[11px] text-text-secondary mt-[16px]">Photo: {activePhoto.attribution}</p>
          )}
        </div>

        <div className="w-[396px] max-w-full">
          <p className="font-medium text-[11px] text-secondary-purple tracking-[0.44px]">
            {site.category.toUpperCase()}
          </p>
          <h1 className="font-heading font-semibold text-[34px] text-text-primary mt-[24px]">{site.name}</h1>
          <p className="text-[13px] text-text-secondary mt-[8px]">{city?.name}</p>

          <div className="h-px bg-text-primary/20 mt-[14px]" />

          <p className="text-[15px] leading-[1.65] text-text-primary mt-[24px]">
            {longDescription || site.description}
          </p>

          <Button
            variant="orange"
            className="!w-full !h-[52px] mt-[52px]"
            onClick={() => {
              track("Map Link Clicked", { name: site.name, source: "site_detail" });
              if (site.map_url) window.open(site.map_url, "_blank", "noopener,noreferrer");
            }}
          >
            OPEN IN MAPS
          </Button>
        </div>
      </div>
    </div>
  );
}
