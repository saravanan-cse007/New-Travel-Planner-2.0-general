import { useState, useEffect } from "react";
import { api, API } from "@/lib/api";
import {
  MapPin, Star, Clock, Timer, ExternalLink, Sun, Sunset, Moon, CloudRain,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const SLOT_META = {
  morning:   { icon: Sun,    label: "Morning" },
  afternoon: { icon: Sunset, label: "Afternoon" },
  evening:   { icon: Moon,   label: "Evening" },
};

/**
 * ActivityCard — Smart activity card showing time, name, photo, rating, duration,
 * opening hours, cost, travel time from previous stop, distance, Open in Maps button.
 *
 * Props:
 *  - slot ("morning" | "afternoon" | "evening")
 *  - data (object from itinerary)
 *  - currency
 *  - destination (string — for Maps search bias)
 */
export default function ActivityCard({ slot, data, currency, destination }) {
  const [photo, setPhoto] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(true);
  const [place, setPlace] = useState(null);

  const placeName = data?.place_name || data?.location || data?.activity;

  // Fetch live place data (rating + photo) via backend proxy (Places Text Search)
  useEffect(() => {
    if (!placeName) {
      setPhotoLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPhotoLoading(true);
      try {
        // Try Google Places text search via existing restaurants endpoint (works for any place)
        // Use a generic geocode lookup as a fallback to get coordinates for Maps link.
        const q = `${placeName} ${destination || ""}`.trim();
        const { data: geo } = await api.get("/places/geocode", { params: { q } });
        if (cancelled) return;
        const first = (geo.results || [])[0];
        setPlace(first || null);

        // Unsplash image as fallback / primary photo
        const { data: imgRes } = await api.get("/images/destination", { params: { q: placeName, count: 1 } });
        if (cancelled) return;
        const img = (imgRes.results || [])[0];
        setPhoto(img || null);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setPhotoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [placeName, destination]);

  if (!data) return null;
  const meta = SLOT_META[slot] || SLOT_META.morning;
  const Icon = meta.icon;

  const mapsHref = place?.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
    : `https://www.google.com/maps/search/${encodeURIComponent(`${placeName} ${destination || ""}`)}`;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden group hover:border-fuchsia-500/30 transition">
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-0">
        {/* Photo */}
        <div className="relative h-36 md:h-full bg-gradient-to-br from-fuchsia-500/10 to-purple-600/10 overflow-hidden">
          {photoLoading ? (
            <Skeleton className="absolute inset-0 bg-white/5" />
          ) : photo ? (
            <img
              src={photo.thumb || photo.url}
              alt={photo.alt || placeName}
              loading="lazy"
              className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-fuchsia-300/40">
              <MapPin className="w-10 h-10" />
            </div>
          )}
          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-xs font-mono-acc text-fuchsia-200 inline-flex items-center gap-1">
            <Icon className="w-3 h-3" /> {meta.label}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              {data.time && (
                <div className="text-xs font-mono-acc text-fuchsia-300 uppercase tracking-widest mb-0.5">
                  {data.time}
                </div>
              )}
              <div className="font-display text-lg leading-tight">
                {placeName}
              </div>
              {data.activity && data.activity !== placeName && (
                <div className="text-sm text-white/70 mt-0.5">{data.activity}</div>
              )}
            </div>
            <span className="text-fuchsia-300 font-mono-acc text-sm whitespace-nowrap">
              {currency} {Number(data.cost || 0).toLocaleString()}
            </span>
          </div>

          {data.location && data.location !== placeName && (
            <div className="text-xs text-white/50 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {data.location}
            </div>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-2 text-xs text-white/60">
            {data.rating !== undefined && data.rating !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <Star className="w-3 h-3 fill-fuchsia-300 text-fuchsia-300" /> {Number(data.rating).toFixed(1)}
              </span>
            )}
            {data.duration_hours && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <Timer className="w-3 h-3" /> {data.duration_hours}h
              </span>
            )}
            {data.opening_hours && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <Clock className="w-3 h-3" /> {data.opening_hours}
              </span>
            )}
            {(data.travel_from_prev_min || data.travel_from_prev_km) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-200">
                ↳ {data.travel_from_prev_min ? `${data.travel_from_prev_min} min` : ""}
                {data.travel_from_prev_min && data.travel_from_prev_km ? " • " : ""}
                {data.travel_from_prev_km ? `${data.travel_from_prev_km} km` : ""}
              </span>
            )}
          </div>

          {data.tips && (
            <p className="text-xs text-white/60 italic leading-relaxed">{data.tips}</p>
          )}

          {data.rain_alt && (
            <div className="text-xs text-white/50 flex gap-1.5 items-start pt-1">
              <CloudRain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-fuchsia-300" />
              <span><span className="font-semibold text-white/70">Rain plan:</span> {data.rain_alt}</span>
            </div>
          )}

          <div className="pt-1">
            <a
              href={mapsHref}
              target="_blank"
              rel="noreferrer"
              data-testid={`maps-link-${slot}`}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500/25 transition"
            >
              <ExternalLink className="w-3 h-3" /> Open in Google Maps
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// Expose API base for any external callers needing direct image fetches
export { API };
