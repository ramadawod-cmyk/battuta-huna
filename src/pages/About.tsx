import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import marrakech from "../assets/about/marrakech.jpg";
import kyoto from "../assets/about/kyoto.jpg";
import highlands from "../assets/about/highlands.jpg";
import maldives from "../assets/about/maldives.jpg";

const SECTIONS = [
  {
    title: "Battuta brings those two parts of travel together.",
    body: "We help you plan your trip around the places worth seeing, while making it easier to discover more as you explore. From the landmarks you came for to the places you might have otherwise missed, Battuta helps you make better choices about where to go and what to experience.",
    image: marrakech,
  },
  {
    title: "Travel with more curiosity",
    body: "We believe the best trips aren't necessarily the ones where you see the most. They're the ones where you discover something you'll remember — a street with a story, a place you would have walked past, a piece of history hiding in plain sight, a local tradition you never knew existed. Battuta is designed to help you find those moments.",
    image: kyoto,
  },
  {
    title: "Built for the way people actually travel",
    body: "You shouldn't need to become a travel expert to have a great trip. Battuta takes the research, planning, and discovery that usually happens across dozens of tabs and apps and brings it into one experience. Plan less. Discover more. Make every trip count.",
    image: highlands,
  },
  {
    title: "Why Battuta?",
    body: "Because travel should leave you with more than photos. It should leave you with stories. And we want to help you find them.",
    image: maldives,
  },
];

function SectionCard({ section }: { section: (typeof SECTIONS)[number] }) {
  return (
    <div className="absolute inset-0 p-5 flex flex-col overflow-hidden">
      <p className="font-heading font-semibold text-white text-base leading-snug">{section.title}</p>
      <p className="mt-3 text-white/85 text-[13px] leading-relaxed">{section.body}</p>
    </div>
  );
}

function SectionsAccordion() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="hidden md:flex gap-3 h-[520px]">
      {SECTIONS.map((section, i) => (
        <div
          key={section.title}
          className="relative overflow-hidden rounded-[20px] cursor-default bg-cover bg-center transition-[flex-grow] duration-500 ease-out"
          style={{ backgroundImage: `url(${section.image})`, flexGrow: hovered === i ? 2 : 1, flexBasis: 0 }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="absolute inset-0 bg-black/45" />
          <SectionCard section={section} />
        </div>
      ))}
    </div>
  );
}

function SectionsStack() {
  return (
    <div className="md:hidden flex flex-col gap-3">
      {SECTIONS.map((section) => (
        <div key={section.title} className="relative rounded-[20px] overflow-hidden p-5 bg-cover bg-center" style={{ backgroundImage: `url(${section.image})` }}>
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative">
            <p className="font-heading font-semibold text-white text-base leading-snug">{section.title}</p>
            <p className="mt-3 text-white/85 text-[13px] leading-relaxed">{section.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1040px] mx-auto px-6 pt-16 sm:pt-20">
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl text-text-primary">About Battuta</h1>

        <div className="mt-8 flex flex-col gap-5 text-[15px] sm:text-base leading-relaxed text-text-secondary">
          <p>
            Travel is more than a list of places to visit. It's the stories, discoveries, and unexpected moments
            that make a trip worth remembering.
          </p>
          <p>
            Battuta was built around a simple idea: help people experience more of a place without making travel
            feel like work.
          </p>
          <p>
            Planning a trip can mean hours of searching, saving places, building maps, and trying to figure out
            what's actually worth your time. Then, once you arrive, it's easy to walk right past something
            fascinating because you didn't know it was there.
          </p>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-6 mt-10">
        <SectionsAccordion />
        <SectionsStack />
      </div>

      <div className="max-w-[680px] mx-auto px-6 pt-16 pb-16 sm:pb-20">
        <div className="flex justify-center">
          <Button variant="orange" onClick={() => navigate("/plan")}>
            Start Planning your Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
