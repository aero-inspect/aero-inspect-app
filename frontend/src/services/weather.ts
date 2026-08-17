import { getWeather } from "../api/client";

export interface WeatherData {
  temp: number;
  desc: string;
  icon: string;
  wind: number;
  humidity: number;
  visibility: number;
  loading: boolean;
}

export const emptyWeather: WeatherData = {
  temp: 0,
  desc: "Cargando...",
  icon: "",
  wind: 0,
  humidity: 0,
  visibility: 0,
  loading: true
};

// El clima se pide al backend (GET /api/v1/weather?city=...), que a su vez
// llama a OpenWeather con la API key guardada del lado del servidor. Asi la
// key nunca queda expuesta en el bundle del frontend.
export async function fetchWeather(city = "Bragado"): Promise<WeatherData> {
  const data = await getWeather(city);

  return {
    temp: Math.round(data.temp),
    desc: data.description,
    icon: data.icon,
    wind: Math.round(data.windKmh),
    humidity: Math.round(data.humidity),
    visibility: Math.round(data.visibilityKm),
    loading: false
  };
}
