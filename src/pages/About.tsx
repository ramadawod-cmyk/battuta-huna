import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";

const MOMENTS = [
  {
    title: "A street with a story.",
    caption: "The kind of street you'd normally just walk down.",
    gradient: "linear-gradient(160deg, #ff9f68 0%, #fe9c5e 55%, #e8794f 100%)",
  },
  {
    title: "A place you would have walked past.",
    caption: "Right there the whole time, waiting to be noticed.",
    gradient: "linear-gradient(160deg, #8f86e0 0%, #6155cc 55%, #453f99 100%)",
  },
  {
    title: "A piece of history hiding in plain sight.",
    caption: "Older than you'd guess, and easy to miss.",
    gradient: "linear-gradient(160deg, #57667a 0%, #33404f 55%, #1c2531 100%)",
  },
  {
    title: "A local tradition you never knew existed.",
    caption: "Something locals do every day that visitors rarely see.",
    gradient: "linear-gradient(160deg, #5fae8f 0%, #3f8a6d 55%, #2b6350 100%)",
  },
];

function MomentsAccordion() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="hidden md:flex gap-3 h-[420px]">
      {MOMENTS.map((moment, i) => (
        <div
          key={moment.title}
          className="relative overflow-hidden rounded-[20px] cursor-default transition-[flex-grow] duration-500 ease-out"
          style={{ background: moment.gradient, flexGrow: hovered === i ? 3 : 1, flexBasis: 0 }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="font-heading font-semibold text-white text-lg leading-snug">
              {moment.title}
            </p>
            <p
              className="mt-2 text-white/80 text-sm leading-relaxed transition-opacity duration-300"
              style={{ opacity: hovered === i ? 1 : 0 }}
            >
              {moment.caption}
            </p>
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
      <nav className="flex items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
        <Link to="/" className="font-heading font-semibold text-xl text-text-primary">
          Battuta
        </Link>
        <Link to="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          Back home
        </Link>
      </nav>

      <div className="max-w-[680px] mx-auto px-6 py-16 sm:py-20">
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
          <p className="font-heading font-semibold text-text-primary">Battuta brings those two parts of travel together.</p>
          <p>
            We help you plan your trip around the places worth seeing, while making it easier to discover more as
            you explore. From the landmarks you came for to the places you might have otherwise missed, Battuta
            helps you make better choices about where to go and what to experience.
          </p>
        </div>
      </div>

      <div className="max-w-[1040px] mx-auto px-6 mt-8">
        <h2 className="font-heading font-semibold text-2xl sm:text-[28px] text-text-primary">
          Travel with more curiosity
        </h2>
        <div className="mt-6 flex flex-col gap-4 text-[15px] sm:text-base leading-relaxed text-text-secondary max-w-[680px]">
          <p>We believe the best trips aren't necessarily the ones where you see the most.</p>
          <p>They're the ones where you discover something you'll remember.</p>
        </div>

        <div className="mt-6">
          <MomentsAccordion />

          <ul className="md:hidden flex flex-col gap-3">
            {MOMENTS.map((moment) => (
              <li key={moment.title} className="flex items-start gap-3">
                <span className="mt-[9px] size-[6px] rounded-full bg-secondary-purple shrink-0" />
                <span className="italic text-[15px] text-text-primary">{moment.title}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 text-[15px] sm:text-base leading-relaxed text-text-secondary max-w-[680px]">
          Battuta is designed to help you find those moments.
        </p>
      </div>

      <div className="max-w-[680px] mx-auto px-6 pb-16 sm:pb-20">
        <h2 className="mt-16 font-heading font-semibold text-2xl sm:text-[28px] text-text-primary">
          Built for the way people actually travel
        </h2>
        <div className="mt-6 flex flex-col gap-4 text-[15px] sm:text-base leading-relaxed text-text-secondary">
          <p>You shouldn't need to become a travel expert to have a great trip.</p>
          <p>
            Battuta takes the research, planning, and discovery that usually happens across dozens of tabs and
            apps and brings it into one experience.
          </p>
        </div>
        <p className="mt-6 font-heading font-semibold text-lg sm:text-xl text-secondary-purple">
          Plan less. Discover more. Make every trip count.
        </p>

        <h2 className="mt-16 font-heading font-semibold text-2xl sm:text-[28px] text-text-primary">Why Battuta?</h2>
        <div className="mt-6 flex flex-col gap-2 text-[15px] sm:text-base leading-relaxed text-text-secondary">
          <p>Because travel should leave you with more than photos.</p>
          <p>It should leave you with stories.</p>
          <p>And we want to help you find them.</p>
        </div>

        <div className="mt-16 flex justify-center">
          <Button variant="orange" onClick={() => navigate("/plan")}>
            Start Planning your Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
