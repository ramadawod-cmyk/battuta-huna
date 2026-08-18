import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TagPill from "../components/TagPill";
import AllSitesListItem from "../components/AllSitesListItem";
import { useCity } from "../lib/CityContext";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { CATEGORIES as SITE_CATEGORIES } from "../lib/categories";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Site } from "../lib/types";

const CATEGORIES = [
  "All",
  ...SITE_CATEGORIES,
];

function AllSitesListItemWithImage({ site, onClick }: { site: Site; onClick: () => void }) {
  const imageUrl = useWikiThumbnail(site.name);
  return (
    <AllSitesListItem
      name={site.name}
      category={site.category.toUpperCase()}
      description={site.description}
      className="max-w-none"
      imageUrl={site.image_url || imageUrl}
      onClick={onClick}
    />
  );
}

export default function AllSites() {
  const { city, sites, status } = useCity();
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useTrackScreen("all_sites");

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const timeout = setTimeout(() => track("Site Search", { query: q }), 600);
    return () => clearTimeout(timeout);
  }, [query]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.filter((site) => {
      const matchesCategory = activeCategory === "All" || site.category === activeCategory;
      const matchesQuery =
        q === "" || site.name.toLowerCase().includes(q) || site.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [sites, activeCategory, query]);

  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px] max-w-[1260px] mx-auto">
      <h1 className="font-heading font-semibold text-[26px] text-text-primary">
        All Sites{city ? ` · ${city.name}` : ""}
      </h1>

      <div className="mt-[20px] max-w-[420px]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sites, categories…"
          className="w-full h-[52px] rounded-[16px] bg-surface-lavender px-[24px] text-[14px] text-text-primary placeholder:text-text-secondary outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-[10px] mt-[24px]">
        {CATEGORIES.map((category) => (
          <TagPill
            key={category}
            label={category}
            active={activeCategory === category}
            onClick={() => {
              track("Site Filter Toggled", { tag: category, active: activeCategory !== category, view: "all_sites" });
              setActiveCategory(category);
            }}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px] mt-[24px]">
        {filteredSites.map((site) => (
          <AllSitesListItemWithImage
            key={site.id}
            site={site}
            onClick={() => {
              track("Site Viewed", { name: site.name, category: site.category, source: "all_sites" });
              navigate(`/site/${encodeURIComponent(site.name)}`);
            }}
          />
        ))}
        {status === "ready" && filteredSites.length === 0 && (
          <p className="text-text-secondary text-[14px] col-span-full">No sites match your search.</p>
        )}
        {status !== "ready" && (
          <p className="text-text-secondary text-[14px] col-span-full">Loading sites…</p>
        )}
      </div>
    </div>
  );
}
