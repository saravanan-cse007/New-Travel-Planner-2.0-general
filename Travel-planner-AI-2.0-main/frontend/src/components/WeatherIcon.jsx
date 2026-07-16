import {
  Sun, CloudSun, Cloud, CloudRain, CloudLightning, CloudSnow, CloudFog, CloudDrizzle, Moon, CloudMoon,
} from "lucide-react";

/** Map OpenWeather icon codes to lucide-react components. */
const ICON_MAP = {
  "01d": Sun, "01n": Moon,
  "02d": CloudSun, "02n": CloudMoon,
  "03d": Cloud, "03n": Cloud,
  "04d": Cloud, "04n": Cloud,
  "09d": CloudDrizzle, "09n": CloudDrizzle,
  "10d": CloudRain, "10n": CloudRain,
  "11d": CloudLightning, "11n": CloudLightning,
  "13d": CloudSnow, "13n": CloudSnow,
  "50d": CloudFog, "50n": CloudFog,
};

export function getWeatherIcon(iconCode, condition) {
  if (iconCode && ICON_MAP[iconCode]) return ICON_MAP[iconCode];
  const c = (condition || "").toLowerCase();
  if (c.includes("rain") || c.includes("drizzle")) return CloudRain;
  if (c.includes("snow")) return CloudSnow;
  if (c.includes("thunder")) return CloudLightning;
  if (c.includes("fog") || c.includes("mist") || c.includes("haze")) return CloudFog;
  if (c.includes("cloud")) return Cloud;
  if (c.includes("clear") || c.includes("sun")) return Sun;
  return CloudSun;
}

export default function WeatherIcon({ icon, condition, className = "w-5 h-5" }) {
  const Icon = getWeatherIcon(icon, condition);
  return <Icon className={className} />;
}
