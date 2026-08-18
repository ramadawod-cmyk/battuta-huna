export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readMinutes: number;
  tag: string;
  image: string;
  paragraphs: string[];
};

import marrakech from "../assets/about/marrakech.jpg";
import kyoto from "../assets/about/kyoto.jpg";
import highlands from "../assets/about/highlands.jpg";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "who-was-ibn-battuta",
    title: "Who Was Ibn Battuta? The Traveler Battuta Huna Is Named After",
    excerpt:
      "Nearly 700 years before trip-planning apps existed, one man spent three decades crossing the known world on foot, by camel, and by ship. Here's why we named the app after him.",
    date: "2026-06-02",
    readMinutes: 5,
    tag: "History",
    image: marrakech,
    paragraphs: [
      "In 1325, a 21-year-old law student named Ibn Battuta left his hometown of Tangier for a pilgrimage to Mecca. He didn't return home for 29 years — and by the time he did, he had covered roughly 75,000 miles across North Africa, the Middle East, East Africa, Central Asia, South Asia, and China. It remains one of the most extensive journeys recorded before the age of mechanized travel.",
      "What set Ibn Battuta apart wasn't just the distance. It was his curiosity. He didn't travel in a straight line from one famous site to the next — he took detours, stayed in cities for months, learned local customs, and wrote about the small, specific details of daily life that most travelers of his era ignored: how markets were run, what people ate, how disputes were settled.",
      "\"Traveling, it leaves you speechless, then turns you into a storyteller.\" That line, attributed to him, is the idea at the center of Battuta Huna. His account, the Rihla, is still one of the richest surviving records of the medieval world — precisely because he paid attention to what was easy to walk past.",
      "\"Battuta Huna\" is Arabic for \"Battuta is here.\" We built the app around the same instinct that drove his journey: the places worth remembering aren't always the ones on the list. Sometimes they're the ones you would have missed.",
    ],
  },
  {
    slug: "plan-trips-around-culture-not-just-landmarks",
    title: "How to Plan a Trip Around Cultural Sites, Not Just Landmarks",
    excerpt:
      "Most itineraries are built around a handful of famous landmarks and a lot of empty time in between. Here's a different way to plan — one built around what a place actually is.",
    date: "2026-06-18",
    readMinutes: 4,
    tag: "Travel Tips",
    image: kyoto,
    paragraphs: [
      "Open almost any trip-planning app and you'll get the same result: a shortlist of the five or six landmarks everyone photographs, dropped onto a map with no sense of how they relate to each other or to the city around them. It's a start, but it treats a destination like a checklist instead of a place with layers.",
      "Cultural sites — a neighborhood shrine, a centuries-old market street, a building with an unremarkable facade and a remarkable history — rarely make that shortlist, even though they're often what makes a trip memorable. They don't have the marketing budget of a landmark, but they have the story.",
      "A better approach starts with density, not fame: what's actually near where you'll be walking, not just what's most photographed. It also means giving yourself room to be surprised — leaving gaps in the day rather than filling every hour, so a good detour has somewhere to go.",
      "This is the gap Battuta Huna is built to close: build a day-by-day itinerary around what's genuinely there, and get a nudge when you're near something worth knowing about — even if it never made anyone's top-ten list.",
    ],
  },
  {
    slug: "five-cultural-sites-you-might-walk-past",
    title: "5 Cultural Sites You Might Walk Right Past (And How Not to Miss Them)",
    excerpt:
      "Some of the most interesting places in a city give away almost nothing from the street. A few examples of sites that are easy to miss — and what to look for instead.",
    date: "2026-07-05",
    readMinutes: 6,
    tag: "Discovery",
    image: highlands,
    paragraphs: [
      "The most photographed sites in any city tend to announce themselves — a dome, a spire, a queue of tourists. The most interesting ones often don't. A doorway that looks like any other doorway can lead to a 400-year-old courtyard. A plain building might sit on the site of something that no longer exists but shaped everything built after it.",
      "This is less about any five specific places and more about a habit: slowing down enough to notice what a street is actually telling you. A worn threshold. A plaque you'd normally walk past without reading. A building whose age doesn't match its neighbors.",
      "It's also why location matters more than a static list. The right piece of context, delivered exactly when you're standing in front of something, does more than the same fact read the night before in a guidebook.",
      "That's the specific problem Battuta Huna solves — a notification when you're near a site with a story attached, so the things you'd otherwise walk past get a chance to be noticed.",
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
