import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useTranslation } from "../lib/LanguageContext";
import marrakech from "../assets/about/marrakech.jpg";
import kyoto from "../assets/about/kyoto.jpg";
import highlands from "../assets/about/highlands.jpg";
import maldives from "../assets/about/maldives.jpg";

const SECTIONS = [
  {
    title: "Battuta brings those two parts of travel together.",
    titleAr: "بطوطة يجمع هذين الجانبين من السفر معًا.",
    body: "We help you plan your trip around the places worth seeing, while making it easier to discover more as you explore. From the landmarks you came for to the places you might have otherwise missed, Battuta helps you make better choices about where to go and what to experience.",
    bodyAr: "نساعدك على تخطيط رحلتك حول الأماكن التي تستحق الزيارة، مع تسهيل اكتشاف المزيد أثناء تجوالك. من المعالم التي أتيت من أجلها إلى الأماكن التي كنت لتفوّتها، يساعدك بطوطة على اتخاذ قرارات أفضل حول إلى أين تذهب وماذا تختبر.",
    image: marrakech,
  },
  {
    title: "Travel with more curiosity",
    titleAr: "سافر بفضول أكبر",
    body: "We believe the best trips aren't necessarily the ones where you see the most. They're the ones where you discover something you'll remember — a street with a story, a place you would have walked past, a piece of history hiding in plain sight, a local tradition you never knew existed. Battuta is designed to help you find those moments.",
    bodyAr: "نؤمن بأن أفضل الرحلات ليست بالضرورة تلك التي ترى فيها أكثر عدد من الأماكن. بل تلك التي تكتشف فيها شيئًا ستتذكره: شارعًا له قصة، مكانًا كنت ستمرّ بجانبه من دون انتباه، قطعة من التاريخ مختبئة أمام عينيك، أو عادة محلية لم تكن تعرف بوجودها. صُمم بطوطة ليساعدك على إيجاد هذه اللحظات.",
    image: kyoto,
  },
  {
    title: "Built for the way people actually travel",
    titleAr: "مصمم بما يناسب طريقة سفر الناس الحقيقية",
    body: "You shouldn't need to become a travel expert to have a great trip. Battuta takes the research, planning, and discovery that usually happens across dozens of tabs and apps and brings it into one experience. Plan less. Discover more. Make every trip count.",
    bodyAr: "لا يجب أن تصبح خبيرًا في السفر لتحظى برحلة رائعة. يجمع بطوطة البحث والتخطيط والاكتشاف الذي يحدث عادة عبر عشرات التبويبات والتطبيقات، ويضعه كله في تجربة واحدة. خطّط أقل. اكتشف أكثر. اجعل كل رحلة تستحق.",
    image: highlands,
  },
  {
    title: "Why Battuta?",
    titleAr: "لماذا بطوطة؟",
    body: "Because travel should leave you with more than photos. It should leave you with stories. And we want to help you find them.",
    bodyAr: "لأن السفر يجب أن يترك لك أكثر من مجرد صور. يجب أن يترك لك قصصًا. ونحن نريد مساعدتك على إيجادها.",
    image: maldives,
  },
];

function SectionCard({ section, expanded }: { section: (typeof SECTIONS)[number]; expanded: boolean }) {
  const { language } = useTranslation();
  const title = language === "ar" ? section.titleAr : section.title;
  const body = language === "ar" ? section.bodyAr : section.body;
  return (
    <div className="absolute inset-0 p-5 flex flex-col justify-end overflow-hidden">
      <p className="font-heading font-semibold text-white text-xl leading-snug">{title}</p>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
        style={{ maxHeight: expanded ? 400 : 0, opacity: expanded ? 1 : 0 }}
      >
        <p className="mt-3 text-white/85 text-base leading-relaxed">{body}</p>
      </div>
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
          <SectionCard section={section} expanded={hovered === i} />
        </div>
      ))}
    </div>
  );
}

function SectionsStack() {
  const { language } = useTranslation();
  return (
    <div className="md:hidden flex flex-col gap-3">
      {SECTIONS.map((section) => (
        <div key={section.title} className="relative rounded-[20px] overflow-hidden p-5 bg-cover bg-center" style={{ backgroundImage: `url(${section.image})` }}>
          <div className="absolute inset-0 bg-black/25" />
          <div className="relative">
            <p className="font-heading font-semibold text-white text-xl leading-snug">
              {language === "ar" ? section.titleAr : section.title}
            </p>
            <p className="mt-3 text-white/85 text-base leading-relaxed">
              {language === "ar" ? section.bodyAr : section.body}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function About() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1040px] px-6 pt-16 sm:pt-20">
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl text-text-primary">{t("about.title")}</h1>

        <div className="mt-8 flex flex-col gap-5 text-[15px] sm:text-base leading-relaxed text-text-secondary">
          <p>{t("about.intro1")}</p>
          <p>{t("about.intro2")}</p>
          <p>{t("about.intro3")}</p>
        </div>
      </div>

      <div className="max-w-[1040px] px-6 mt-10">
        <SectionsAccordion />
        <SectionsStack />
      </div>

      <div className="max-w-[680px] px-6 pt-16 pb-16 sm:pb-20">
        <div className="flex justify-start">
          <Button variant="orange" onClick={() => navigate("/plan")}>
            {t("landing.startPlanning")}
          </Button>
        </div>
      </div>
    </div>
  );
}
