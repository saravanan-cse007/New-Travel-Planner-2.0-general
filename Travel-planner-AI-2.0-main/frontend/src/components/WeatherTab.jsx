import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import WeatherIcon, { getWeatherIcon } from "@/components/WeatherIcon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sunrise, Sunset, Droplets, Wind, Sun as SunIcon, Activity,
} from "lucide-react";
import { format } from "date-fns";

function fromUnix(ts) {
  if (!ts) return null;
  try { return format(new Date(ts * 1000), "h:mm a"); } catch { return null; }
}

const AQI_COLORS = {
  Good: "text-emerald-300", Fair: "text-lime-300", Moderate: "text-amber-300",
  Poor: "text-orange-300", "Very Poor": "text-red-300", Unknown: "text-white/60",
};

export default function WeatherTab({ weather, destination }) {
  const [aqi, setAqi] = useState(null);
  const [aqiLoading, setAqiLoading] = useState(false);

  useEffect(() => {
    if (!weather?.lat || !weather?.lng) return;
    let cancelled = false;
    setAqiLoading(true);
    (async () => {
      try {
        const { data } = await api.get("/weather/air-quality", {
          params: { lat: weather.lat, lng: weather.lng },
        });
        if (!cancelled) setAqi(data);
      } catch {
        // graceful: hide AQI
      } finally {
        if (!cancelled) setAqiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [weather?.lat, weather?.lng]);

  if (!weather) {
    return (
      <div className="glass rounded-3xl p-6">
        <Skeleton className="h-7 w-48 mb-4 bg-white/5" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-32 bg-white/5 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const current = weather.current || {};
  const forecast = weather.forecast || [];
  const hourly = (forecast[0]?.hourly || []).slice(0, 10);
  const Icon = getWeatherIcon(current.icon, current.condition);

  return (
    <div className="space-y-6" data-testid="weather-tab">
      {/* Current */}
      <div className="glass rounded-3xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-fuchsia-500/20 to-purple-600/20 border border-fuchsia-500/30 flex items-center justify-center">
              <Icon className="w-12 h-12 text-fuchsia-200" />
            </div>
            <div>
              <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Right now in</div>
              <h3 className="font-display text-3xl leading-none mt-1">{destination}</h3>
              <p className="text-white/60 text-sm mt-1 capitalize">{current.description || current.condition}</p>
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className="font-display text-6xl text-glow leading-none">{Math.round(current.temp_c ?? 0)}°</div>
            <div className="text-sm text-white/50 mt-1">
              Feels like {Math.round(current.feels_like ?? current.temp_c ?? 0)}°
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Droplets} label="Humidity" value={`${current.humidity ?? "—"}%`} />
          <Stat icon={Wind} label="Wind" value={`${current.wind_speed ?? "—"} m/s`} />
          <Stat icon={SunIcon} label="UV Index" value={current.uv ?? "—"} />
          <Stat icon={Activity} label="Rain"  value={`${current.rain_chance ?? 0}%`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat icon={Sunrise} label="Sunrise" value={fromUnix(current.sunrise || weather.sunrise) || "—"} />
          <Stat icon={Sunset} label="Sunset"  value={fromUnix(current.sunset  || weather.sunset)  || "—"} />
        </div>

        {/* AQI */}
        {(aqi || aqiLoading) && (
          <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Air Quality</div>
              {aqiLoading ? (
                <Skeleton className="h-6 w-20 mt-1 bg-white/5" />
              ) : aqi ? (
                <div className="font-display text-xl mt-0.5">
                  <span className={AQI_COLORS[aqi.label] || "text-white"}>{aqi.label}</span>
                  <span className="text-xs text-white/40 ml-2">AQI {aqi.aqi}</span>
                </div>
              ) : null}
            </div>
            {aqi?.components && (
              <div className="text-xs text-white/50 hidden md:flex gap-3">
                {["pm2_5", "pm10", "o3"].map((k) => aqi.components[k] !== undefined && (
                  <span key={k}>{k.toUpperCase().replace("_", ".")} {Math.round(aqi.components[k])}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hourly */}
      {hourly.length > 0 && (
        <div className="glass rounded-3xl p-6">
          <h4 className="font-display text-xl mb-4">Hourly forecast</h4>
          <div className="overflow-x-auto scrollbar-thin">
            <div className="flex gap-3 pb-2 min-w-max">
              {hourly.map((h) => {
                const HIcon = getWeatherIcon(h.icon, h.condition);
                const time = h.time?.slice(11, 16) || "";
                return (
                  <div key={h.time} className="text-center px-3 py-3 rounded-2xl bg-white/5 border border-white/10 min-w-[88px]">
                    <div className="text-xs text-white/50">{time}</div>
                    <HIcon className="w-6 h-6 text-fuchsia-300 mx-auto my-2" />
                    <div className="font-display text-lg">{Math.round(h.temp)}°</div>
                    <div className="text-[10px] text-white/40 mt-1">{h.pop}% rain</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7-day */}
      <div className="glass rounded-3xl p-6">
        <h4 className="font-display text-xl mb-4">{forecast.length}-day forecast</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {forecast.map((d) => (
            <div key={d.day} className="rounded-2xl p-4 bg-white/5 border border-white/10 text-center hover:border-fuchsia-500/30 transition">
              <div className="text-xs font-mono-acc uppercase tracking-widest text-white/50">Day {d.day}</div>
              <WeatherIcon icon={d.icon} condition={d.condition} className="w-7 h-7 mx-auto my-3 text-fuchsia-300" />
              <div className="font-display text-2xl">{Math.round(d.temp_c)}°</div>
              <div className="text-xs text-white/60 mt-1 capitalize">{d.description || d.condition}</div>
              <div className="text-[11px] text-white/40 mt-1">
                {d.temp_min !== undefined ? `${Math.round(d.temp_min)}° / ${Math.round(d.temp_max)}°` : ""}
              </div>
              <div className="text-[11px] text-fuchsia-300/80 mt-1">{d.rain_chance}% rain</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
      <Icon className="w-5 h-5 text-fuchsia-300 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-mono-acc uppercase tracking-wider text-white/50">{label}</div>
        <div className="font-display text-base truncate">{value}</div>
      </div>
    </div>
  );
}
