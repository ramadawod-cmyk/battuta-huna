import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import Button from "./Button";
import ImagePlaceholder from "./ImagePlaceholder";
import { db, planAgent, type WikiImage, wikiImagesBySearch } from "../lib/api";
import { ARABIC_VOICE_GUIDANCE } from "../lib/arabicVoice";
import { CATEGORY_LABEL_KEYS, normalizeCategory } from "../lib/categories";
import { buildViatorSearchUrl } from "../lib/viator";
import { useTranslation } from "../lib/LanguageContext";
import { track } from "../lib/analytics";
import type { Site } from "../lib/types";

// Paused (2026-09-13) pending a UX rethink on how/where the Viator CTA should actually appear --
// code, tests, and the env var wiring are all intact, just not rendered. Flip back to true to
// re-enable without touching any other logic.
const VIATOR_BOOKING_ENABLED = false;

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
function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export default function SiteDetailModal({ siteName, cityId, cityName, source, onClose }: SiteDetailModalProps) {
  const { t, language } = useTranslation();
  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<WikiImage[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [longDescription, setLongDescription] = useState<string | null>(null);
  const [longDescriptionAr, setLongDescriptionAr] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  useEffect(() => {
    track("Site Viewed", { name: siteName, source });
    setLoading(true);
    db("getSite", { name: siteName, cityId })
      .then((result: Site | null) => {
        setSite(result ? { ...result, category: normalizeCategory(result.category) } : null);
        setLongDescription(result?.long_description || null);
        setLongDescriptionAr(result?.long_description_ar || null);
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

  // Generates the long-form description the first time a site is opened (both languages in one
  // call, see decision 6) -- or, for a site cached before bilingual long descriptions existed,
  // opportunistically translates the existing English text into Arabic alone (decision 9's
  // backfill pattern), without touching the English a returning visitor has already seen.
  useEffect(() => {
    if (!site || generatingDescription || (site.long_description && site.long_description_ar)) return;
    setGeneratingDescription(true);

    if (!site.long_description) {
      const system = `You write warm, editorial 3-4 sentence descriptions of cultural sites for travellers, for the Battuta app, in both English and Arabic. No markdown, no bullet points, no em dashes. ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON object, no prose, no markdown fences: {"description": string, "descriptionAr": string}.`;
      planAgent(system, [
        { role: "user", content: `Write a description of ${site.name} in ${cityName}. Context: ${site.description}` },
      ])
        .then(async (text) => {
          const parsed = extractJsonObject(text);
          const cleaned = typeof parsed?.description === "string" ? parsed.description.trim() : "";
          const cleanedAr = typeof parsed?.descriptionAr === "string" ? parsed.descriptionAr.trim() : null;
          if (!cleaned) throw new Error("Missing description in AI response");
          setLongDescription(cleaned);
          setLongDescriptionAr(cleanedAr);
          track("Site Description Generated", { name: site.name, source: "ai", success: true });
          await db("saveLongDescription", { name: site.name, cityId, longDescription: cleaned, longDescriptionAr: cleanedAr });
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
    } else {
      const system = `You are a professional Arabic translator for Battuta, a cultural-discovery app. ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON object, no prose, no markdown fences: {"descriptionAr": string}.`;
      planAgent(system, [
        { role: "user", content: `Translate this description of ${site.name} in ${cityName}: ${site.long_description}` },
      ])
        .then(async (text) => {
          const parsed = extractJsonObject(text);
          const cleanedAr = typeof parsed?.descriptionAr === "string" ? parsed.descriptionAr.trim() : null;
          if (!cleanedAr) return;
          setLongDescriptionAr(cleanedAr);
          await db("saveLongDescription", { name: site.name, cityId, longDescription: site!.long_description, longDescriptionAr: cleanedAr });
        })
        .catch(() => {})
        .finally(() => setGeneratingDescription(false));
    }
  }, [site, cityId, cityName, generatingDescription]);

  const displayName = language === "ar" && site?.name_ar ? site.name_ar : site?.name;
  const displayShortDescription = language === "ar" && site?.description_ar ? site.description_ar : site?.description;
  const displayLongDescription = language === "ar" ? longDescriptionAr : longDescription;

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
          aria-label={t("siteDetail.close")}
          className="absolute end-[16px] top-[16px] sm:end-[24px] sm:top-[24px] text-text-secondary hover:text-text-primary transition-colors"
        >
          <X size={20} />
        </button>

        {loading && <p className="text-text-secondary">{t("siteDetail.loading")}</p>}

        {!loading && !site && <p className="text-text-primary">{t("siteDetail.notFound", { name: siteName })}</p>}

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
                    {/* Photo-carousel arrows stay physically left/right regardless of direction --
                        a media scrubber, not text, so it follows universal prev/next convention
                        rather than mirroring with the page. */}
                    <button
                      onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                      aria-label={t("siteDetail.previousPhoto")}
                      className="absolute left-[12px] top-1/2 -translate-y-1/2 size-[36px] rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                      aria-label={t("siteDetail.nextPhoto")}
                      className="absolute right-[12px] top-1/2 -translate-y-1/2 size-[36px] rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-[16px] left-1/2 -translate-x-1/2 flex gap-[6px]">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPhotoIndex(i)}
                          aria-label={t("siteDetail.goToPhoto", { number: i + 1 })}
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
                {t(CATEGORY_LABEL_KEYS[site.category]).toUpperCase()}
              </p>
              <h1 className="font-heading font-semibold text-[28px] text-text-primary mt-[16px] pe-[32px]">
                {displayName}
              </h1>
              <p className="text-[13px] text-text-secondary mt-[8px]">{cityName}</p>

              <div className="h-px bg-text-primary/20 mt-[14px]" />

              {displayLongDescription ? (
                <p className="text-[15px] leading-[1.65] text-text-primary mt-[24px]">{displayLongDescription}</p>
              ) : generatingDescription ? (
                <div className="mt-[24px] flex flex-col gap-[10px]">
                  <div className="h-[14px] rounded-full bg-surface-lavender animate-pulse" />
                  <div className="h-[14px] rounded-full bg-surface-lavender animate-pulse" />
                  <div className="h-[14px] w-2/3 rounded-full bg-surface-lavender animate-pulse" />
                </div>
              ) : (
                <p className="text-[15px] leading-[1.65] text-text-primary mt-[24px]">{displayShortDescription}</p>
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
                  {t("siteDetail.openInMaps")}
                </Button>
                {VIATOR_BOOKING_ENABLED && site.must_see && (
                  <Button
                    variant="outline"
                    className="!w-full sm:!flex-1 !h-[52px]"
                    onClick={() => {
                      track("Viator Link Clicked", { name: site.name, source: "site_detail_modal" });
                      window.open(buildViatorSearchUrl(`${site.name}, ${cityName}`), "_blank", "noopener,noreferrer");
                    }}
                  >
                    <span className="inline-flex items-center justify-center gap-[6px]">
                      {t("siteDetail.bookNow")}
                      <ExternalLink size={14} strokeWidth={2.5} />
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
