import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Plane, TrainFront, TrainTrack, Bus, Car, Bike, Footprints, Ship, Sailboat,
  Loader2, AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const ICON_MAP = {
  flight: Plane, high_speed_rail: TrainFront, train: TrainTrack,
  metro: TrainFront, bus: Bus, taxi: Car, rental_car: Car,
  bicycle: Bike, scooter: Bike, walking: Footprints,
  ferry: Ship, boat: Sailboat, seaplane: Plane, helicopter: Plane, tram: TrainFront,
};

/**
 * TransportPicker
 *  Props:
 *  - destinationLocation (with country_code, city)
 *  - sourceLocation (with lat,lng)
 *  - destinationLatLng: { lat, lng }
 *  - days, budget, currency
 *  - value: selected mode code (e.g. "metro")
 *  - onChange(mode)
 *  - onEstimate({ mode, cost, percentage_of_budget }): fired when estimate fetched
 */
export default function TransportPicker({
  destinationLocation,
  sourceLocation,
  days,
  budget,
  currency,
  value,
  onChange,
  onEstimate,
}) {
  const [options, setOptions] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [loadingEst, setLoadingEst] = useState(false);
  const [estError, setEstError] = useState(null);

  // Fetch available options whenever destination changes
  useEffect(() => {
    if (!destinationLocation?.country_code && !destinationLocation?.city) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingOpts(true);
      try {
        const { data } = await api.get("/transport/options", {
          params: {
            country_code: destinationLocation.country_code || "",
            city: destinationLocation.city || destinationLocation.name || "",
          },
        });
        if (!cancelled) setOptions(data.options || []);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoadingOpts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [destinationLocation?.country_code, destinationLocation?.city, destinationLocation?.name]);

  // If current value is not in available options, switch to first
  useEffect(() => {
    if (value && options.length && !options.find((o) => o.code === value)) {
      onChange?.(options[0].code);
    } else if (!value && options.length) {
      onChange?.(options[0].code);
    }
  }, [options, value, onChange]);

  // Fetch estimate whenever mode + locations change
  useEffect(() => {
    if (
      !value ||
      !sourceLocation?.lat || !sourceLocation?.lng ||
      !destinationLocation?.lat || !destinationLocation?.lng
    ) {
      setEstimate(null);
      setEstError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingEst(true);
      setEstError(null);
      try {
        const { data } = await api.post("/transport/estimate", {
          origin_lat: sourceLocation.lat,
          origin_lng: sourceLocation.lng,
          dest_lat: destinationLocation.lat,
          dest_lng: destinationLocation.lng,
          mode: value,
          currency: currency,
          days: days || 1,
          budget: budget,
        });
        if (!cancelled) {
          setEstimate(data);
          onEstimate?.(data);
        }
      } catch (err) {
        if (!cancelled) setEstError("Could not estimate cost");
      } finally {
        if (!cancelled) setLoadingEst(false);
      }
    })();
    return () => { cancelled = true; };
  }, [
    value,
    sourceLocation?.lat, sourceLocation?.lng,
    destinationLocation?.lat, destinationLocation?.lng,
    currency, days, budget, onEstimate,
  ]);

  if (loadingOpts) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50 py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading available transport…
      </div>
    );
  }

  if (!options.length) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/50">
        Select a destination to see available transport options.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" data-testid="transport-picker">
        {options.map((opt) => {
          const Icon = ICON_MAP[opt.code] || Car;
          const active = value === opt.code;
          return (
            <motion.button
              key={opt.code}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange?.(opt.code)}
              data-testid={`transport-${opt.code}`}
              className={`relative px-3.5 py-2.5 rounded-xl border flex items-center gap-2 text-sm transition ${
                active
                  ? "bg-gradient-to-br from-fuchsia-500/30 to-purple-600/20 border-fuchsia-400/60 text-white shadow-[0_0_18px_rgba(217,70,239,0.35)]"
                  : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-fuchsia-500/30"
              }`}
            >
              <Icon className="w-4 h-4" />
              {opt.label}
            </motion.button>
          );
        })}
      </div>

      {/* Estimate panel */}
      <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-purple-600/5 border border-fuchsia-500/20 p-4">
        {loadingEst ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="w-4 h-4 animate-spin" /> Calculating transport cost…
          </div>
        ) : estimate ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">
                Estimated Transport Cost
              </div>
              <div className="font-display text-2xl mt-1">
                {estimate.symbol} {Number(estimate.cost).toLocaleString()}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {estimate.distance_km} km • {estimate.label}
              </div>
            </div>
            {estimate.percentage_of_budget !== null && estimate.percentage_of_budget !== undefined && (
              <div className="text-right">
                <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">% of budget</div>
                <div className={`font-display text-2xl mt-1 ${estimate.percentage_of_budget > 30 ? "text-amber-300" : ""}`}>
                  {estimate.percentage_of_budget}%
                </div>
              </div>
            )}
          </div>
        ) : estError ? (
          <div className="text-sm text-white/50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {estError}
          </div>
        ) : (
          <div className="text-sm text-white/50">
            Select source &amp; destination above to estimate transport cost.
          </div>
        )}
      </div>
    </div>
  );
}
