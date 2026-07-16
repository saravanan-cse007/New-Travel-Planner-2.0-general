import WeatherIcon from "@/components/WeatherIcon";
import { Sparkles } from "lucide-react";

/** Decides an optimization label/icon based on the forecast condition. */
function forecastSuggestion(condition) {
  const c = (condition || "").toLowerCase();
  if (c.includes("rain") || c.includes("drizzle") || c.includes("thunder")) {
    return "Today\u2019s itinerary has been optimized for indoor attractions — museums, cafés and covered markets.";
  }
  if (c.includes("snow")) {
    return "Today\u2019s plan favours warm indoor venues and seasonal hot-spring stops.";
  }
  if (c.includes("cloud")) {
    return "Today\u2019s plan emphasises photography, markets and shopping under soft cloudy light.";
  }
  if (c.includes("clear") || c.includes("sun")) {
    return "Today\u2019s plan takes advantage of clear skies — parks, viewpoints and outdoor walks.";
  }
  return "Today\u2019s plan is optimized for the local forecast.";
}

/**
 * DayWeatherBanner — replaces the old "Rain Plan" section.
 * Shows a single line with weather icon, condition and AI optimization message.
 */
export default function DayWeatherBanner({ weatherDay }) {
  if (!weatherDay) return null;
  return (
    <div className="rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-purple-600/5 border border-fuchsia-500/20 p-3.5 flex items-center gap-3 mb-4">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
        <WeatherIcon icon={weatherDay.icon} condition={weatherDay.condition} className="w-6 h-6 text-fuchsia-200" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono-acc uppercase tracking-widest text-fuchsia-300">Today&apos;s Weather</span>
          <span className="text-sm text-white capitalize">{weatherDay.description || weatherDay.condition}</span>
          <span className="text-xs text-white/40">• {Math.round(weatherDay.temp_c)}° • {weatherDay.rain_chance}% rain</span>
        </div>
        <div className="text-xs text-white/70 flex items-start gap-1.5">
          <Sparkles className="w-3 h-3 text-fuchsia-300 mt-0.5 flex-shrink-0" />
          <span>{forecastSuggestion(weatherDay.condition)}</span>
        </div>
      </div>
    </div>
  );
}
