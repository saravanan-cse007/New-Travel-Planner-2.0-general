import { format, parseISO, addDays } from "date-fns";
import { MapPin } from "lucide-react";

/**
 * DayHeader — "Day N • Weekday • Date • Destination" header for each day in the itinerary.
 */
export default function DayHeader({ dayNumber, startDate, destination, currency, estimatedCost }) {
  let dateLabel = "";
  let weekday = "";
  if (startDate) {
    try {
      const d = addDays(parseISO(startDate), Math.max(0, (dayNumber || 1) - 1));
      dateLabel = format(d, "d MMM yyyy");
      weekday = format(d, "EEEE");
    } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center justify-between w-full pr-2">
      <div className="text-left">
        <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Day {dayNumber}</div>
        <div className="flex items-center gap-2 mt-1 text-white/80 text-sm">
          {weekday && <span>{weekday}</span>}
          {weekday && dateLabel && <span className="opacity-40">•</span>}
          {dateLabel && <span>{dateLabel}</span>}
          {destination && (
            <>
              <span className="opacity-40">•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-fuchsia-300" />
                {destination}
              </span>
            </>
          )}
        </div>
      </div>
      {estimatedCost !== undefined && estimatedCost !== null && (
        <div className="text-right ml-3">
          <div className="text-xs text-white/50 font-mono-acc uppercase tracking-widest">Est. cost</div>
          <div className="font-display text-lg">
            {currency} {Number(estimatedCost || 0).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
