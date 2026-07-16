import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  ShieldAlert, Phone, Cross, Building2, BadgeAlert, MapPin, Star, Loader2, ExternalLink,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  { key: "hospital",       type: "hospital",       label: "Hospitals",       icon: Cross,        keyword: null },
  { key: "police",         type: "police",         label: "Police Stations", icon: BadgeAlert,   keyword: null },
  { key: "pharmacy",       type: "pharmacy",       label: "Pharmacies",      icon: Cross,        keyword: null },
  { key: "embassy",        type: "embassy",        label: "Embassies",       icon: Building2,    keyword: "embassy" },
  { key: "atm",            type: "atm",            label: "ATMs",            icon: BadgeAlert,   keyword: null },
];

// Emergency number lookup
const EMERGENCY_NUMBERS = {
  IN: "112", US: "911", GB: "999", JP: "110", AU: "000", NZ: "111",
  CA: "911", DE: "112", FR: "112", IT: "112", ES: "112", NL: "112",
  BE: "112", AT: "112", CH: "112", SE: "112", DK: "112", NO: "112",
  FI: "112", PT: "112", PL: "112", CZ: "112", HU: "112", GR: "112",
  IE: "112", RU: "112", TH: "191", SG: "999", MY: "999", ID: "112",
  PH: "911", VN: "113", KR: "112", CN: "110", HK: "999", TW: "110",
  AE: "999", SA: "999", QA: "999", TR: "112", IL: "100", EG: "122",
  ZA: "10111", BR: "190", MX: "911", AR: "911",
};

export default function SafetyTab({ trip, weather }) {
  const lat = trip?.destination_location?.lat ?? weather?.lat;
  const lng = trip?.destination_location?.lng ?? weather?.lng;
  const countryCode = trip?.destination_location?.country_code;
  const emergencyNumber =
    trip?.itinerary?.safety?.emergency_number ||
    EMERGENCY_NUMBERS[countryCode] ||
    "112";

  const [data, setData] = useState({});  // {hospital: [...], police: [...], ...}
  const [loadingKeys, setLoadingKeys] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!lat || !lng) return;
    let cancelled = false;
    CATEGORIES.forEach((cat) => {
      setLoadingKeys((s) => ({ ...s, [cat.key]: true }));
      api.get("/places/nearby", {
        params: { lat, lng, type: cat.type, keyword: cat.keyword || undefined, radius: 5000, limit: 8 },
      })
        .then(({ data: res }) => {
          if (cancelled) return;
          setData((s) => ({ ...s, [cat.key]: res.results || [] }));
        })
        .catch((err) => {
          if (cancelled) return;
          setErrors((s) => ({ ...s, [cat.key]: err?.response?.data?.detail || "Unavailable" }));
        })
        .finally(() => {
          if (cancelled) return;
          setLoadingKeys((s) => ({ ...s, [cat.key]: false }));
        });
    });
    return () => { cancelled = true; };
  }, [lat, lng]);

  return (
    <div className="space-y-6" data-testid="safety-tab">
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="w-5 h-5 text-fuchsia-300" />
          <h3 className="font-display text-2xl">Safety assistant</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 bg-gradient-to-br from-fuchsia-500/15 to-purple-600/15 border border-fuchsia-500/30">
            <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Emergency Number</div>
            <a href={`tel:${emergencyNumber}`} className="block font-display text-5xl mt-2 text-glow">
              {emergencyNumber}
            </a>
            <div className="text-xs text-white/50 mt-2 flex items-center gap-1">
              <Phone className="w-3 h-3" /> Tap to call (mobile)
            </div>
          </div>

          {(trip?.itinerary?.safety?.tips || []).length > 0 && (
            <div className="rounded-2xl p-5 bg-white/5 border border-white/10">
              <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300 mb-2">Safety tips</div>
              <ul className="space-y-2 text-sm text-white/70">
                {trip.itinerary.safety.tips.slice(0, 5).map((t) => (
                  <li key={t} className="flex gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-fuchsia-300 mt-0.5 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Nearby */}
      {!lat || !lng ? (
        <div className="glass rounded-3xl p-6 text-sm text-white/50">
          Save this trip with a Google Places-selected destination to see nearby hospitals, police, pharmacies and embassies.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const list = data[cat.key];
            const loading = loadingKeys[cat.key];
            const err = errors[cat.key];
            return (
              <div key={cat.key} className="glass rounded-3xl p-5" data-testid={`safety-${cat.key}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-fuchsia-300" />
                  <h4 className="font-display text-lg">{cat.label}</h4>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 bg-white/5 rounded-xl" />
                    ))}
                  </div>
                ) : err ? (
                  <div className="text-sm text-white/50 p-3 bg-white/5 rounded-xl">{err}</div>
                ) : list && list.length === 0 ? (
                  <div className="text-sm text-white/50">No results nearby.</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
                    {(list || []).map((p) => (
                      <a
                        key={p.place_id}
                        href={`https://www.google.com/maps/place/?q=place_id:${p.place_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:border-fuchsia-500/30 transition group"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="font-display text-sm text-white group-hover:text-fuchsia-200 truncate">{p.name}</div>
                          {p.rating && (
                            <span className="text-xs font-mono-acc text-fuchsia-300 inline-flex items-center gap-1 flex-shrink-0">
                              <Star className="w-3 h-3 fill-current" /> {Number(p.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        {p.address && (
                          <div className="text-xs text-white/50 mt-1 line-clamp-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {p.address}
                          </div>
                        )}
                        <div className="text-xs text-fuchsia-300/70 mt-1 inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> Open in Maps
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
