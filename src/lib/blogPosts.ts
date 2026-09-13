export type BlogPost = {
  slug: string;
  title: string;
  titleAr: string;
  excerpt: string;
  excerptAr: string;
  date: string;
  readMinutes: number;
  tag: string;
  tagAr: string;
  image: string;
  paragraphs: string[];
  paragraphsAr: string[];
};

import marrakech from "../assets/about/marrakech.jpg";
import kyoto from "../assets/about/kyoto.jpg";
import highlands from "../assets/about/highlands.jpg";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "who-was-ibn-battuta",
    title: "Who Was Ibn Battuta? The Traveler Battuta Huna Is Named After",
    titleAr: "من هو ابن بطوطة؟ الرحّالة الذي سُمّي التطبيق باسمه",
    excerpt:
      "Nearly 700 years before trip-planning apps existed, one man spent three decades crossing the known world on foot, by camel, and by ship. Here's why we named the app after him.",
    excerptAr:
      "قبل نحو 700 عام من وجود تطبيقات تخطيط الرحلات، أمضى رجل واحد ثلاثة عقود يجوب العالم المعروف سيرًا على الأقدام، وعلى ظهر الجمال، وعلى متن السفن. إليك سبب تسميتنا التطبيق باسمه.",
    date: "2026-06-02",
    readMinutes: 5,
    tag: "History",
    tagAr: "تاريخ",
    image: marrakech,
    paragraphs: [
      "In 1325, a 21-year-old law student named Ibn Battuta left his hometown of Tangier for a pilgrimage to Mecca. He didn't return home for 29 years. By the time he did, he had covered roughly 75,000 miles across North Africa, the Middle East, East Africa, Central Asia, South Asia, and China. It remains one of the most extensive journeys recorded before the age of mechanized travel.",
      "What set Ibn Battuta apart wasn't just the distance. It was his curiosity. He didn't travel in a straight line from one famous site to the next. Instead, he took detours, stayed in cities for months, learned local customs, and wrote about the small, specific details of daily life that most travelers of his era ignored: how markets were run, what people ate, how disputes were settled.",
      "\"Traveling, it leaves you speechless, then turns you into a storyteller.\" That line, attributed to him, is the idea at the center of Battuta Huna. His account, the Rihla, is still one of the richest surviving records of the medieval world, precisely because he paid attention to what was easy to walk past.",
      "\"Battuta Huna\" is Arabic for \"Battuta is here.\" We built the app around the same instinct that drove his journey: the places worth remembering aren't always the ones on the list. Sometimes they're the ones you would have missed.",
    ],
    paragraphsAr: [
      "في عام 1325، غادر طالب فقه يبلغ من العمر 21 عامًا يُدعى ابن بطوطة مدينته طنجة في رحلة حج إلى مكة. لم يعد إلى دياره إلا بعد 29 عامًا. وبحلول ذلك الوقت، كان قد قطع نحو 75 ألف ميل عبر شمال أفريقيا والشرق الأوسط وشرق أفريقيا وآسيا الوسطى وجنوب آسيا والصين. وتظل رحلته واحدة من أطول الرحلات المسجّلة قبل عصر وسائل النقل الحديثة.",
      "ما ميّز ابن بطوطة لم يكن المسافة وحدها، بل فضوله. لم يسافر في خط مستقيم من معلم مشهور إلى آخر، بل كان يحيد عن الطريق، ويقيم في المدن لأشهر، ويتعلم عادات أهلها، ويكتب عن التفاصيل الصغيرة والدقيقة للحياة اليومية التي تجاهلها معظم مسافري عصره: كيف كانت الأسواق تُدار، وماذا كان الناس يأكلون، وكيف كانت الخلافات تُحل.",
      "\"السفر يترك الإنسان بلا كلام، ثم يحوّله إلى راوي حكايات.\" هذه المقولة المنسوبة إليه هي الفكرة التي تقوم عليها بطوطة هنا. رحلته، المعروفة بـ«الرحلة»، لا تزال واحدة من أغنى السجلات الباقية عن العالم في القرون الوسطى، تحديدًا لأنه انتبه لما كان يسهل على غيره تجاهله.",
      "«بطوطة هنا» تعني بالعربية أن بطوطة موجود هنا. بنينا التطبيق حول الغريزة نفسها التي دفعته في رحلته: الأماكن التي تستحق أن تُتذكر ليست دائمًا تلك المدرجة في القائمة. أحيانًا تكون هي تلك التي كنت لتفوّتها.",
    ],
  },
  {
    slug: "plan-trips-around-culture-not-just-landmarks",
    title: "How to Plan a Trip Around Cultural Sites, Not Just Landmarks",
    titleAr: "كيف تخطط رحلة حول المواقع الثقافية، لا المعالم فقط",
    excerpt:
      "Most itineraries are built around a handful of famous landmarks and a lot of empty time in between. Here's a different way to plan: one built around what a place actually is.",
    excerptAr:
      "تُبنى معظم خطط الرحلات حول حفنة من المعالم الشهيرة، مع الكثير من الوقت الفارغ بينها. إليك طريقة مختلفة للتخطيط، طريقة تُبنى حول حقيقة المكان نفسه.",
    date: "2026-06-18",
    readMinutes: 4,
    tag: "Travel Tips",
    tagAr: "نصائح سفر",
    image: kyoto,
    paragraphs: [
      "Open almost any trip-planning app and you'll get the same result: a shortlist of the five or six landmarks everyone photographs, dropped onto a map with no sense of how they relate to each other or to the city around them. It's a start, but it treats a destination like a checklist instead of a place with layers.",
      "Cultural sites (a neighborhood shrine, a centuries-old market street, a building with an unremarkable facade and a remarkable history) rarely make that shortlist, even though they're often what makes a trip memorable. They don't have the marketing budget of a landmark, but they have the story.",
      "A better approach starts with density, not fame: what's actually near where you'll be walking, not just what's most photographed. It also means giving yourself room to be surprised, leaving gaps in the day rather than filling every hour, so a good detour has somewhere to go.",
      "This is the gap Battuta Huna is built to close: build a day-by-day itinerary around what's genuinely there, and get a nudge when you're near something worth knowing about, even if it never made anyone's top-ten list.",
    ],
    paragraphsAr: [
      "افتح أي تطبيق لتخطيط الرحلات تقريبًا وستحصل على النتيجة نفسها: قائمة قصيرة بخمسة أو ستة معالم يصورها الجميع، موزّعة على خريطة من دون أي إحساس بعلاقتها ببعضها أو بالمدينة المحيطة بها. إنها بداية، لكنها تتعامل مع الوجهة كقائمة مهام بدلاً من مكان له طبقات متعددة.",
      "نادرًا ما تحضر المواقع الثقافية، كضريح في حيّ سكني، أو شارع سوق عمره قرون، أو مبنى بواجهة عادية وتاريخ استثنائي، ضمن تلك القائمة، رغم أنها غالبًا ما تكون سبب تذكّر الرحلة. قد لا تملك ميزانية تسويق كالمعالم الشهيرة، لكنها تملك القصة.",
      "الطريقة الأفضل تبدأ من الكثافة لا الشهرة: ما هو قريب فعلاً من مسارك، لا ما يُصوَّر أكثر من غيره. وهذا يعني أيضًا أن تترك لنفسك مساحة للمفاجأة، بترك فراغات في يومك بدل ملء كل ساعة، حتى يكون لأي انعطافة جيدة وجهة تذهب إليها.",
      "هذه هي الفجوة التي بُني بطوطة هنا ليسدّها: بناء خطة يومية حول ما هو موجود فعلاً، وتنبيهك حين تكون قريبًا من شيء يستحق المعرفة، حتى لو لم يظهر يومًا في قائمة أفضل عشرة أماكن لأحد.",
    ],
  },
  {
    slug: "five-cultural-sites-you-might-walk-past",
    title: "5 Cultural Sites You Might Walk Right Past (And How Not to Miss Them)",
    titleAr: "5 مواقع ثقافية قد تمرّ بجانبها من دون أن تنتبه (وكيف لا تفوّتها)",
    excerpt:
      "Some of the most interesting places in a city give away almost nothing from the street. A few examples of sites that are easy to miss, and what to look for instead.",
    excerptAr:
      "بعض أكثر الأماكن إثارة للاهتمام في أي مدينة لا يكشف عن نفسه من الشارع. إليك بعض الأمثلة على مواقع يسهل تفويتها، وما يجب الانتباه إليه بدلاً من ذلك.",
    date: "2026-07-05",
    readMinutes: 6,
    tag: "Discovery",
    tagAr: "اكتشاف",
    image: highlands,
    paragraphs: [
      "The most photographed sites in any city tend to announce themselves: a dome, a spire, a queue of tourists. The most interesting ones often don't. A doorway that looks like any other doorway can lead to a 400-year-old courtyard. A plain building might sit on the site of something that no longer exists but shaped everything built after it.",
      "This is less about any five specific places and more about a habit: slowing down enough to notice what a street is actually telling you. A worn threshold. A plaque you'd normally walk past without reading. A building whose age doesn't match its neighbors.",
      "It's also why location matters more than a static list. The right piece of context, delivered exactly when you're standing in front of something, does more than the same fact read the night before in a guidebook.",
      "That's the specific problem Battuta Huna solves: a notification when you're near a site with a story attached, so the things you'd otherwise walk past get a chance to be noticed.",
    ],
    paragraphsAr: [
      "المواقع الأكثر تصويرًا في أي مدينة عادة ما تُعلن عن نفسها: قبة، مئذنة، أو طابور من السياح. أما الأكثر إثارة للاهتمام فغالبًا لا تفعل ذلك. باب يشبه أي باب آخر قد يقود إلى فناء عمره 400 عام. مبنى بسيط قد يقف على أرض كان فيها شيء لم يعد موجودًا، لكنه شكّل كل ما بُني بعده.",
      "الأمر هنا لا يتعلق بخمسة أماكن محددة بقدر ما يتعلق بعادة: أن تُبطئ خطاك بما يكفي لتلاحظ ما يخبرك به الشارع فعلاً. عتبة باب متآكلة. لوحة كنت لتمر بجانبها من دون قراءتها. مبنى لا يتماشى عمره مع جيرانه.",
      "ولهذا فإن الموقع يهم أكثر من أي قائمة ثابتة. المعلومة الصحيحة، حين تصلك لحظة وقوفك أمام شيء ما، تُحدث فرقًا أكبر من الحقيقة نفسها لو قرأتها في دليل سياحي قبل ليلة.",
      "هذه هي المشكلة تحديدًا التي يحلّها بطوطة هنا: تنبيه حين تكون قريبًا من موقع له قصة، حتى تحصل الأشياء التي كنت لتمر بجانبها من دون انتباه على فرصة أن تُلاحظ.",
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
