import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon
} from "lucide-react";

// Codigos de icono de OpenWeather (https://openweathermap.org/weather-conditions):
// 01 despejado, 02 pocas nubes, 03/04 nublado, 09 llovizna, 10 lluvia,
// 11 tormenta, 13 nieve, 50 niebla. Sufijo "d"/"n" = dia/noche.
const ICON_BY_CODE: Record<string, LucideIcon> = {
  "01d": Sun,
  "01n": Moon,
  "02d": CloudSun,
  "02n": CloudMoon,
  "03d": Cloud,
  "03n": Cloud,
  "04d": Cloud,
  "04n": Cloud,
  "09d": CloudDrizzle,
  "09n": CloudDrizzle,
  "10d": CloudRain,
  "10n": CloudRain,
  "11d": CloudLightning,
  "11n": CloudLightning,
  "13d": CloudSnow,
  "13n": CloudSnow,
  "50d": CloudFog,
  "50n": CloudFog
};

export function getWeatherIcon(iconCode: string | undefined | null): LucideIcon {
  return (iconCode && ICON_BY_CODE[iconCode]) || Cloud;
}
