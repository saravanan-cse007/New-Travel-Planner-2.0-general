import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { log } from "@/lib/log";
import { Star, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

/**
 * MapTab — Embedded Google Map (via Maps Embed API iframe) plus a
 * live restaurant list from the Places API. Both endpoints are
 * Google services that require the relevant APIs + billing enabled
 * on the project. If they're not enabled the iframe shows Google's
 * own error page and the restaurant fetch falls back gracefully.
 */
export default function MapTab({ destination, foodPref }) {
  const [restaurants, setRestaurants] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/places/restaurants", {
          params: { destination, food_pref: foodPref || "Non-vegetarian", limit: 12 },
        });
        if (!cancelled) setRestaurants(data.results);
      } catch (err) {
        log.warn("Live restaurants unavailable", err);
        if (!cancelled) setError(err.response?.data?.detail || "Live restaurant data unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, [destination, foodPref]);

  const embedSrc = MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/search?key=${MAPS_KEY}&q=${encodeURIComponent(`things to do in ${destination}`)}`
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="map-tab">
      <div className="lg:col-span-2 glass rounded-3xl overflow-hidden h-[520px]">
        {embedSrc ? (
          <iframe
            data-testid="map-iframe"
            title={`Map of ${destination}`}
            src={embedSrc}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="h-full flex items-center justify-center text-white/50 p-8 text-center text-sm">
            Google Maps key not configured. Add REACT_APP_GOOGLE_MAPS_KEY to enable embedded maps.
          </div>
        )}
      </div>

      <div className="glass rounded-3xl p-5 h-[520px] flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl">Live restaurants</h3>
          <span className="text-xs font-mono-acc uppercase tracking-widest text-white/40">Google Places</span>
        </div>

        {!restaurants && !error && (
          <div className="space-y-3">
            {["s1","s2","s3","s4","s5"].map((k) => <Skeleton key={k} className="h-16 bg-white/5 rounded-xl" />)}
          </div>
        )}

        {error && (
          <div className="text-sm text-white/60 p-3 rounded-xl bg-white/5 border border-white/10">
            {error}. Enable the Places API and Billing in Google Cloud Console to see live results.
          </div>
        )}

        {restaurants && restaurants.length === 0 && (
          <div className="text-sm text-white/60">No restaurants returned for this destination.</div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 mt-1 scrollbar-thin pr-1">
          {(restaurants || []).map((r) => (
            <a
              key={r.place_id}
              href={`https://www.google.com/maps/place/?q=place_id:${r.place_id}`}
              target="_blank"
              rel="noreferrer"
              data-testid={`live-restaurant-${r.place_id}`}
              className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-500/40 transition group"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="font-display text-base group-hover:text-fuchsia-200 transition">{r.name}</div>
                {r.rating && (
                  <span className="text-xs font-mono-acc text-fuchsia-300 inline-flex items-center gap-1 flex-shrink-0">
                    <Star className="w-3 h-3 fill-current"/>{r.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <div className="text-xs text-white/50 mt-1 line-clamp-1">{r.address}</div>
              <div className="text-xs text-white/40 mt-1 inline-flex items-center gap-1 group-hover:text-fuchsia-300 transition">
                <ExternalLink className="w-3 h-3"/> Open in Maps
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
