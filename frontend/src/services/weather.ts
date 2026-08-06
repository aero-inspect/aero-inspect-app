export interface WeatherData {
  temp: number;
  desc: string;
  wind: number;
  humidity: number;
  visibility: number;
  loading: boolean;
}

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

export const emptyWeather: WeatherData = {
  temp: 0,
  desc: "Cargando...",
  wind: 0,
  humidity: 0,
  visibility: 0,
  loading: true
};

export async function fetchWeather(city = "Bragado"): Promise<WeatherData> {
  if (!OPENWEATHER_API_KEY) {
    throw new Error("Falta configurar VITE_OPENWEATHER_API_KEY");
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},AR&units=metric&lang=es&appid=${OPENWEATHER_API_KEY}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("No se pudo obtener el clima");
  }

  const data = await response.json();

  return {
    temp: Math.round(data.main.temp),
    desc: data.weather[0].description,
    wind: Math.round(data.wind.speed * 3.6),
    humidity: data.main.humidity,
    visibility: Math.round(data.visibility / 1000),
    loading: false
  };
}

