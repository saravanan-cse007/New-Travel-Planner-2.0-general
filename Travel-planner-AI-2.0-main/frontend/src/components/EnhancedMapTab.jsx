import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Star, ExternalLink, Hotel, UtensilsCrossed, Camera, Bus, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const MAPS_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const TABS = [
  { key: "tourist_attraction", label: "Attractions", icon: Camera },
  { key: "lodging",            label: "Hotels",      icon: Hotel },
  { key: "restaurant",         label: "Restaurants", icon: UtensilsCrossed },
  { key: "transit_station",    label: "Transport",   icon: Bus },
];

/**
 * EnhancedMapTab — Google Map embed showing the destination with markers,
 * tabs to switch between Hotels / Restaurants / Attractions / Transit stops,
 * each backed by a Google Places Nearby search.
 */
export default function EnhancedMapTab({ trip }) {
  const lat = trip?.destination_location?.lat;
  const lng = trip?.destination_location?.lng;
  const destination = trip?.destination;
  const foodPref = trip?.food_pref || "Non-vegetarian";

  const [active, setActive] = useState("tourist_attraction");
  const [cache, setCache] = useState({}); // {tab: results}
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!destination) return;
    if (cache[active]) return;
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      try {
        if (active === "restaurant") {
          const { data } = await api.get("/places/restaurants", {
            params: { destination, food_pref: foodPref, limit: 15 },
          });
          if (!cancelled) setCache((c) => ({ ...c, [active]: data.results || [] }));
        } else if (lat && lng) {
          const { data } = await api.get("/places/nearby", {
            params: { lat, lng, type: active, radius: 8000, limit: 15 },
          });
          if (!cancelled) setCache((c) => ({ ...c, [active]: data.results || [] }));
        } else {
          // Geocode destination then nearby
          const { data: geo } = await api.get("/places/geocode", { params: { q: destination } });
          const first = (geo.results || [])[0];
          if (first) {
            const { data } = await api.get("/places/nearby", {
              params: { lat: first.lat, lng: first.lng, type: active, radius: 8000, limit: 15 },
            });
            if (!cancelled) setCache((c) => ({ ...c, [active]: data.results || [] }));
          } else {
            if (!cancelled) setCache((c) => ({ ...c, [active]: [] }));
          }
        }
      } catch {
        if (!cancelled) setCache((c) => ({ ...c, [active]: [] }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [active, destination, lat, lng, foodPref, cache]);

  const list = cache[active] || [];

  const embedSrc = useMemo(() => {
    if (!MAPS_KEY) return null;
    if (lat && lng) {
      const labelMap = { tourist_attraction: "tourist attractions", lodging: "hotels", restaurant: "restaurants", transit_station: "transit stations" };
      return `https://www.google.com/maps/embed/v1/search?key=${MAPS_KEY}&q=${encodeURIComponent(labelMap[active] || "things to do")}+near+${lat},${lng}`;
    }
    return `https://www.google.com/maps/embed/v1/search?key=${MAPS_KEY}&q=${encodeURIComponent(`things to do in ${destination}`)}`;
  }, [destination, lat, lng, active]);

  return (
    <div className="space-y-4" data-testid="map-tab">
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            data-testid={`map-tab-${key}`}
            className={`px-3.5 py-2 rounded-full text-sm border transition inline-flex items-center gap-2 ${
              active === key
                ? "bg-gradient-to-r from-fuchsia-500/30 to-purple-600/20 border-fuchsia-400/60 text-white"
                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
              Google Maps key not configured.
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-5 h-[520px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl">{TABS.find((t) => t.key === active)?.label}</h3>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
          </div>

          {loading && list.length === 0 && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 bg-white/5 rounded-xl" />)}
            </div>
          )}

          {!loading && list.length === 0 && (
            <div className="text-sm text-white/60 p-3 bg-white/5 rounded-xl">No results found.</div>
          )}

          <div className="flex-1 overflow-y-auto space-y-2 mt-1 scrollbar-thin pr-1">
            {list.map((r) => (
              <a
                key={r.place_id}
                href={`https://www.google.com/maps/place/?q=place_id:${r.place_id}`}
                target="_blank"
                rel="noreferrer"
                data-testid={`map-poi-${r.place_id}`}
                className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-500/40 transition group"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="font-display text-base group-hover:text-fuchsia-200 transition truncate">{r.name}</div>
                  {r.rating && (
                    <span className="text-xs font-mono-acc text-fuchsia-300 inline-flex items-center gap-1 flex-shrink-0">
                      <Star className="w-3 h-3 fill-current" /> {Number(r.rating).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50 mt-1 line-clamp-1">{r.address}</div>
                <div className="text-xs text-white/40 mt-1 inline-flex items-center gap-1 group-hover:text-fuchsia-300 transition">
                  <ExternalLink className="w-3 h-3" /> Open in Maps
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
