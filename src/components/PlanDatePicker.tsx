import { useState } from "react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRange(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = sameMonth
    ? start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : formatDay(start);
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
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

  function changeMonth(delta: number) {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + delta, 1));
  }

  return (
    <div className="rounded-[16px] border border-secondary-purple/20 bg-white p-[16px] max-w-[340px]">
      {mode === "calendar" ? (
        <>
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
              className="size-[28px] rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-lavender/60"
            >
              ‹
            </button>
            <p className="font-heading font-semibold text-[13px] text-text-primary">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => changeMonth(1)}
              className="size-[28px] rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-lavender/60"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-[2px] mt-[10px]">
            {WEEKDAYS.map((w) => (
              <p key={w} className="text-[10px] font-medium text-text-secondary text-center py-[4px]">
                {w}
              </p>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const isPast = day < today;
              const isStart = selectedStart && sameDay(day, selectedStart);
              const inRange = selectedStart && selectedEnd && day > selectedStart && day <= selectedEnd;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={isPast}
                  onClick={() => setSelectedStart(day)}
                  className={`size-[32px] rounded-full text-[12px] flex items-center justify-center transition-colors ${
                    isPast
                      ? "text-text-secondary/30"
                      : isStart
                        ? "bg-secondary-purple text-white font-medium"
                        : inRange
                          ? "bg-surface-lavender text-text-primary"
                          : "text-text-primary hover:bg-surface-lavender/60"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {selectedStart && selectedEnd && (
            <p className="text-[12px] text-secondary-purple font-medium mt-[10px] text-center">
              {formatRange(selectedStart, selectedEnd)} · {duration} day{duration === 1 ? "" : "s"}
            </p>
          )}

          <button
            type="button"
            onClick={() => setMode("month")}
            className="text-[12px] text-text-secondary underline mt-[12px] block mx-auto"
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
              className="size-[28px] rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-lavender/60 disabled:opacity-30"
            >
              ‹
            </button>
            <p className="font-heading font-semibold text-[13px] text-text-primary">{viewYear}</p>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setViewYear((y) => y + 1)}
              className="size-[28px] rounded-full flex items-center justify-center text-text-secondary hover:bg-surface-lavender/60"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-3 gap-[8px] mt-[12px]">
            {MONTHS.map((m, i) => {
              const isPast = viewYear === today.getFullYear() && i < today.getMonth();
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isPast}
                  onClick={() => onConfirm(`${m} ${viewYear} (flexible)`)}
                  className={`rounded-[10px] py-[10px] text-[12px] font-medium transition-colors ${
                    isPast
                      ? "text-text-secondary/30"
                      : "text-text-primary bg-surface-lavender/60 hover:bg-surface-lavender"
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
            className="text-[12px] text-text-secondary underline mt-[12px] block mx-auto"
          >
            Actually, I know my dates
          </button>
        </>
      )}
    </div>
  );
}
