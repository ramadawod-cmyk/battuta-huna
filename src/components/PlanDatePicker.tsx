import { useState } from "react";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ChevronIcon({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={`${className || ""} ${flip ? "scale-x-[-1]" : ""}`}
      width="7"
      height="13"
      viewBox="0 0 6.40387 12.1679"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.30617 11.6177C6.38936 11.698 6.42272 11.817 6.39343 11.9289C6.36415 12.0408 6.27678 12.1282 6.16489 12.1574C6.05301 12.1867 5.93404 12.1534 5.85369 12.0702L0.0936917 6.31018C-0.0312306 6.18522 -0.0312306 5.98266 0.0936917 5.8577L5.85369 0.0977002C5.93404 0.014514 6.05301 -0.0188479 6.16489 0.0104371C6.27678 0.039722 6.36415 0.127096 6.39343 0.238978C6.42272 0.350859 6.38936 0.469836 6.30617 0.55018L0.772412 6.08394L6.30617 11.6177Z"
        fill="currentColor"
      />
    </svg>
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth
    ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

/** Where, within this calendar row, the soft range band should draw (excludes the solid start/end pills). */
function weekBand(week: (Date | null)[], start: Date, end: Date) {
  let first = -1;
  let last = -1;
  week.forEach((day, i) => {
    if (day && day > start && day < end) {
      if (first === -1) first = i;
      last = i;
    }
  });
  if (first === -1) return null;
  return { first, last, roundLeft: first === 0, roundRight: last === 6 };
}

type Props = {
  duration: number;
  onConfirm: (label: string) => void;
};

export default function PlanDatePicker({ duration, onConfirm }: Props) {
  const today = startOfDay(new Date());
  const [mode, setMode] = useState<"calendar" | "month">("calendar");
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);

  const selectedEnd = selectedStart ? addDays(selectedStart, Math.max(duration - 1, 0)) : null;

  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function changeMonth(delta: number) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  }

  return (
    <div className="bg-[#f0f2f6] rounded-[16px] p-[20px] w-full max-w-[365px]">
      {mode === "calendar" ? (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              className="size-[24px] flex items-center justify-center text-text-primary"
            >
              <ChevronIcon />
            </button>
            <p className="text-[14px] text-text-primary">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              className="size-[24px] flex items-center justify-center text-text-primary"
            >
              <ChevronIcon flip />
            </button>
          </div>

          <div className="grid grid-cols-7 mt-[16px]">
            {WEEKDAYS.map((w, i) => (
              <p key={i} className="text-[10px] text-text-primary text-center">
                {w}
              </p>
            ))}
          </div>

          <div className="flex flex-col mt-[4px]">
            {weeks.map((week, wi) => {
              const band = selectedStart && selectedEnd ? weekBand(week, selectedStart, selectedEnd) : null;
              return (
                <div key={wi} className="relative grid grid-cols-7">
                  {band && (
                    <div
                      className={`absolute top-0 bottom-0 bg-primary-orange/20 ${band.roundLeft ? "rounded-l-[4px]" : ""} ${
                        band.roundRight ? "rounded-r-[4px]" : ""
                      }`}
                      style={{ left: `${(band.first / 7) * 100}%`, width: `${((band.last - band.first + 1) / 7) * 100}%` }}
                    />
                  )}
                  {week.map((day, di) => {
                    if (!day) return <div key={di} />;
                    const isPast = day < today;
                    const isEndpoint = (selectedStart && sameDay(day, selectedStart)) || (selectedEnd && sameDay(day, selectedEnd));
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        disabled={isPast}
                        onClick={() => setSelectedStart(day)}
                        className={`relative z-10 h-[32px] text-[13px] flex items-center justify-center transition-colors ${
                          isPast
                            ? "text-text-secondary/30"
                            : isEndpoint
                              ? "rounded-[4px] bg-primary-orange text-white font-medium"
                              : "text-text-primary hover:bg-white/60 rounded-[4px]"
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {selectedStart && selectedEnd && (
            <p className="text-[12px] text-primary-orange font-medium mt-[10px] text-center">
              {formatRange(selectedStart, selectedEnd)} · {duration} day{duration === 1 ? "" : "s"}
            </p>
          )}

          <button
            type="button"
            onClick={() => setMode("month")}
            className="text-[12px] text-text-secondary underline mt-[14px] block mx-auto"
          >
            Not sure yet? Pick a month instead
          </button>

          {selectedStart && selectedEnd && (
            <button
              type="button"
              onClick={() => onConfirm(formatRange(selectedStart, selectedEnd))}
              className="w-full h-[40px] rounded-[12px] bg-primary-orange text-white text-[13px] font-bold tracking-[0.5px] mt-[10px]"
            >
              CONTINUE
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setViewYear((y) => y - 1)}
              disabled={viewYear <= today.getFullYear()}
              className="size-[24px] flex items-center justify-center text-text-primary disabled:opacity-30"
            >
              <ChevronIcon />
            </button>
            <p className="text-[14px] text-text-primary">{viewYear}</p>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setViewYear((y) => y + 1)}
              className="size-[24px] flex items-center justify-center text-text-primary"
            >
              <ChevronIcon flip />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-[8px] mt-[16px]">
            {MONTHS.map((m, i) => {
              const isPast = viewYear === today.getFullYear() && i < today.getMonth();
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isPast}
                  onClick={() => onConfirm(`${m} ${viewYear} (flexible)`)}
                  className={`rounded-[4px] py-[10px] text-[12px] transition-colors ${
                    isPast ? "text-text-secondary/30" : "text-text-primary bg-white hover:bg-white/70"
                  }`}
                >
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setMode("calendar")}
            className="text-[12px] text-text-secondary underline mt-[14px] block mx-auto"
          >
            Actually, I know my dates
          </button>
        </>
      )}
    </div>
  );
}
