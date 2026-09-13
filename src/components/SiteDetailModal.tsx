import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import Button from "./Button";
import ImagePlaceholder from "./ImagePlaceholder";
import { db, planAgent, type WikiImage, wikiImagesBySearch } from "../lib/api";
import { normalizeCategory } from "../lib/categories";
import { buildViatorSearchUrl } from "../lib/viator";
import { track } from "../lib/analytics";
import type { Site } from "../lib/types";

type SiteDetailModalProps = {
  siteName: string;
  cityId: string;
  cityName: string;
  source: string;
  onClose: () => void;
};

// Renders as a modal over the current page — used from both Explore and the trip itinerary so
// viewing a place's details is the same experience everywhere, without a page navigation. Takes
// cityId/cityName explicitly rather than reading useCity(), since the trip being viewed can be in
// a different city than the one currently detected for the user (e.g. browsing a past Amman trip
// while physically in Dubai).
export default function SiteDetailModal({ siteName, cityId, cityName, source, onClose }: SiteDetailModalProps) {
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<WikiImage[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [longDescription, setLongDescription] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  useEffect(() => {
    track("Site Viewed", { name: siteName, source });
    setLoading(true);
    db("getSite", { name: siteName, cityId })
      .then((result: Site | null) => {
        setSite(result ? { ...result, category: normalizeCategory(result.category) } : null);
        setLongDescription(result?.long_description || null);
        if (result?.long_description) {
          track("Site Description Generated", { name: siteName, source: "cache", success: true });
        }
      })
      .catch(() => setSite(null))
      .finally(() => setLoading(false));
    wikiImagesBySearch(siteName)
      .then(setPhotos)
      .catch(() => setPhotos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName, cityId]);

  useEffect(() => {
    if (!site || site.long_description || generatingDescription) return;
    setGeneratingDescription(true);
    const system =
      "You write warm, editorial 3-4 sentence descriptions of cultural sites for travellers, for the Battuta app. No markdown, no bullet points, no em dashes.";
    planAgent(system, [
      { role: "user", content: `Write a description of ${site.name} in ${cityName}. Context: ${site.description}` },
    ])
      .then(async (text) => {
        const cleaned = text.trim();
        setLongDescription(cleaned);
        track("Site Description Generated", { name: site.name, source: "ai", success: true });
        await db("saveLongDescription", { name: site.name, cityId, longDescription: cleaned });
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
  }, [site, cityId, cityName, generatingDescription]);

  const activePhoto = photos[photoIndex];

  useEffect(() => {
    setPhotoFailed(false);
  }, [activePhoto?.url]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[960px] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[24px] bg-white p-[24px] sm:p-[32px] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-[16px] top-[16px] sm:right-[24px] sm:top-[24px] text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={20} />
        </button>

        {loading && <p className="text-text-secondary">Loading…</p>}

        {!loading && !site && <p className="text-text-primary">Couldn't find "{siteName}".</p>}

        {!loading && site && (
          <div className="flex gap-[32px] lg:gap-[48px] items-start flex-wrap">
            <div className="w-full lg:w-auto">
              <div className="bg-surface-lavender rounded-[24px] w-full lg:w-[480px] aspect-square overflow-hidden relative">
                {activePhoto && !photoFailed ? (
                  <img
                    src={activePhoto.url}
                    alt={site.name}
                    onError={() => setPhotoFailed(true)}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlaceholder />
                )}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                      aria-label="Previous photo"
                      className="absolute left-[12px] top-1/2 -translate-y-1/2 size-[36px] rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                      aria-label="Next photo"
                      className="absolute right-[12px] top-1/2 -translate-y-1/2 size-[36px] rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 flex gap-[6px]">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPhotoIndex(i)}
                          aria-label={`Go to photo ${i + 1}`}
                          className={`size-[8px] rounded-full ${i === photoIndex ? "bg-secondary-purple" : "bg-white/70"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="w-[360px] max-w-full">
              <p className="font-medium text-[11px] text-secondary-purple tracking-[0.44px]">
                {site.category.toUpperCase()}
              </p>
              <h1 className="font-heading font-semibold text-[28px] text-text-primary mt-[16px] pr-[32px]">
                {site.name}
              </h1>
              <p className="text-[13px] text-text-secondary mt-[8px]">{cityName}</p>

              <div className="h-px bg-text-primary/20 mt-[14px]" />

              {longDescription ? (
                <p className="text-[15px] leading-[1.65] text-text-primary mt-[24px]">{longDescription}</p>
              ) : generatingDescription ? (
                <div className="mt-[24px] flex flex-col gap-[10px]">
                  <div className="h-[14px] rounded-full bg-surface-lavender animate-pulse" />
                  <div className="h-[14px] rounded-full bg-surface-lavender animate-pulse" />
                  <div className="h-[14px] w-2/3 rounded-full bg-surface-lavender animate-pulse" />
                </div>
              ) : (
                <p className="text-[15px] leading-[1.65] text-text-primary mt-[24px]">{site.description}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-[10px] mt-[32px]">
                <Button
                  variant="orange"
                  className="!w-full sm:!flex-1 !h-[52px]"
                  onClick={() => {
                    track("Map Link Clicked", { name: site.name, source: "site_detail_modal" });
                    if (site.map_url) window.open(site.map_url, "_blank", "noopener,noreferrer");
                  }}
                >
                  OPEN IN MAPS
                </Button>
                <Button
                  variant="outline"
                  className="!w-full sm:!flex-1 !h-[52px]"
                  onClick={() => {
                    track("Viator Link Clicked", { name: site.name, source: "site_detail_modal" });
                    window.open(buildViatorSearchUrl(`${site.name}, ${cityName}`), "_blank", "noopener,noreferrer");
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-[6px]">
                    BOOK NOW
                    <ExternalLink size={14} strokeWidth={2.5} />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
