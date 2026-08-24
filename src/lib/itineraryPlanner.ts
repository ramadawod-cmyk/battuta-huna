import { getDurationMinutes } from "./categories";
import { haversineMeters } from "./geo";
import type { Site, TripDay, TripSlot } from "./types";

const DAY_START_MINUTES = 9 * 60; // 9:00 AM
const DAY_END_MINUTES = 20 * 60 + 30; // 8:30 PM
const LUNCH_START = 12 * 60 + 30; // 12:30 PM
const LUNCH_MINUTES = 60;
const DINNER_START = 19 * 60; // 7:00 PM
const DINNER_MINUTES = 90;
const TRANSIT_BUFFER_MINUTES = 15;
const MAX_STOP_DISTANCE_METERS = 3000;

const PACE_BUDGET_MULTIPLIER: Record<string, number> = {
  Relaxed: 0.8,
  "Strict schedule": 0.95,
};

function touringBudgetMinutes(pace: string): number {
  const window = DAY_END_MINUTES - DAY_START_MINUTES - LUNCH_MINUTES - DINNER_MINUTES;
  const multiplier = PACE_BUDGET_MULTIPLIER[pace] ?? PACE_BUDGET_MULTIPLIER.Relaxed;
  return window * multiplier;
}

function formatClockTime(totalMinutes: number): string {
  const clamped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(clamped / 60);
  const minute = clamped % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

/** Pushes a clock cursor forward past the lunch/dinner blocks it would otherwise land inside. */
function skipMealBlocks(minutes: number): number {
  if (minutes >= LUNCH_START && minutes < LUNCH_START + LUNCH_MINUTES) return LUNCH_START + LUNCH_MINUTES;
  if (minutes >= DINNER_START && minutes < DINNER_START + DINNER_MINUTES) return DINNER_START + DINNER_MINUTES;
  return minutes;
}

function distanceMeters(a: Site, b: Site): number {
  return haversineMeters(a.lat, a.lng, b.lat, b.lng);
}

function centroid(sites: Site[]): { lat: number; lng: number } {
  const lat = sites.reduce((sum, s) => sum + s.lat, 0) / sites.length;
  const lng = sites.reduce((sum, s) => sum + s.lng, 0) / sites.length;
  return { lat, lng };
}

function siteToSlot(site: Site, time: string): TripSlot {
  return {
    time,
    name: site.name,
    description: site.description,
    category: site.category,
    tags: site.tags || [],
    lat: site.lat,
    lng: site.lng,
    mapUrl: site.map_url || `https://maps.google.com/?q=${encodeURIComponent(site.name)}`,
    durationMinutes: getDurationMinutes(site),
  };
}

/** Picks the site with the most other sites within range — the center of the densest untouched pocket. */
function densestSeed(pool: Set<Site>): Site | undefined {
  let best: Site | undefined;
  let bestCount = -1;
  for (const candidate of pool) {
    let count = 0;
    for (const other of pool) {
      if (other !== candidate && haversineMeters(candidate.lat, candidate.lng, other.lat, other.lng) <= MAX_STOP_DISTANCE_METERS) {
        count++;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

/** Orders a day's stops by nearest-neighbor walk from the seed, to keep travel efficient. */
function routeOrder(seed: Site, rest: Site[]): Site[] {
  const ordered = [seed];
  const pool = [...rest];
  let current = seed;
  while (pool.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    pool.forEach((candidate, idx) => {
      const dist = distanceMeters(current, candidate);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });
    current = pool.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

/**
 * Deterministically assigns the given sites across `duration` days: must-see places are
 * prioritized, each day is filled by proximity (nearest-neighbor to a running centroid) up to a
 * time budget derived from each stop's typical visit length plus lunch/dinner/transit, and stops
 * within a day are ordered to minimize backtracking. Replaces asking an LLM to independently pick
 * a subset per day, which is what caused some days to end up overloaded and others empty.
 */
export function planItinerary(sites: Site[], duration: number, pace: string): TripDay[] {
  const days = Math.max(1, duration);
  const budgetMinutes = touringBudgetMinutes(pace);

  // Must-see first so they win contested slots; stable order otherwise.
  const priority = [...sites].sort((a, b) => Number(!!b.must_see) - Number(!!a.must_see));
  const mustSeeQueue = priority.filter((s) => s.must_see);
  const remaining = new Set(priority);

  const dayGroups: Site[][] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    if (remaining.size === 0) {
      dayGroups.push([]);
      continue;
    }

    // Seed: must-see queue first. Once that's exhausted, seed with whichever remaining site has
    // the most other remaining sites nearby — the center of the densest untouched neighborhood —
    // rather than an arbitrary leftover, so a whole nearby cluster doesn't get stranded behind a
    // stray single point from an already-visited area.
    let seed = mustSeeQueue.find((s) => remaining.has(s));
    if (!seed) seed = densestSeed(remaining);
    if (!seed) {
      dayGroups.push([]);
      continue;
    }
    remaining.delete(seed);

    const group: Site[] = [seed];
    let usedMinutes = getDurationMinutes(seed);

    for (;;) {
      const center = centroid(group);
      let bestCandidate: Site | null = null;
      let bestDist = Infinity;
      for (const candidate of remaining) {
        const dist = haversineMeters(center.lat, center.lng, candidate.lat, candidate.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = candidate;
        }
      }
      if (!bestCandidate) break;

      // The proximity cap keeps a well-filled day tight, but a day that's still mostly empty
      // should reach past it rather than quit early — otherwise a day can end at midday just
      // because the nearest leftover site is a few hundred meters past the cap, even though
      // there's nothing closer and hours of budget left (rule 4 only excuses a lone far stop
      // when the day has nothing better to do, not when it's simply under-filled).
      const dayIsWellFilled = usedMinutes >= budgetMinutes * 0.6;
      if (dayIsWellFilled && bestDist > MAX_STOP_DISTANCE_METERS) break;

      const candidateMinutes = getDurationMinutes(bestCandidate) + TRANSIT_BUFFER_MINUTES;
      if (usedMinutes + candidateMinutes > budgetMinutes) break;

      remaining.delete(bestCandidate);
      group.push(bestCandidate);
      usedMinutes += candidateMinutes;
    }

    dayGroups.push(group);
  }

  return dayGroups.map((group, idx) => {
    if (group.length === 0) {
      return { day: idx + 1, label: `Day ${idx + 1}`, slots: [] };
    }
    const [seed, ...rest] = group;
    const ordered = routeOrder(seed, rest);

    let cursor = DAY_START_MINUTES;
    const slots: TripSlot[] = ordered.map((site) => {
      cursor = skipMealBlocks(cursor);
      const slot = siteToSlot(site, formatClockTime(cursor));
      cursor += getDurationMinutes(site) + TRANSIT_BUFFER_MINUTES;
      return slot;
    });

    return { day: idx + 1, label: `Day ${idx + 1}`, slots };
  });
}
