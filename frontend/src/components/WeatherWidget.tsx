import { useState, useEffect } from "react";
import { ArrowRight, Wind, Droplets, Eye } from "lucide-react";

interface WeatherData {
  temp: number;
  desc: string;
  wind: number;
  humidity: number;
  visibility: number;
  icon: string;
  loading: boolean;
}

export function WeatherWidget({ city = "Bragado", province = "Buenos Aires" }: { city?: string; province?: string }) {
  const [weather, setWeather] = useState<WeatherData>({
    temp: 0,
    desc: "Cargando...",
    wind: 0,
    humidity: 0,
    visibility: 0,
    icon: "",
    loading: true
  });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // REEMPLAZA ESTO CON TU CLAVE REAL DE OPENWEATHERMAP
        const API_KEY = "8d76bb9c20d4f03ef9743edaf4a74828";
        
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},AR&units=metric&lang=es&appid=${API_KEY}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("Error en la petición del clima");
        
        const data = await response.json();

        setWeather({
          temp: Math.round(data.main.temp),
          desc: data.weather[0].description,
          wind: Math.round(data.wind.speed * 3.6), // Convertir m/s a km/h
          humidity: data.main.humidity,
          visibility: Math.round(data.visibility / 1000), // Convertir metros a kilómetros
          icon: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`,
          loading: false
        });
      } catch (error) {
        console.error("Error fetching weather:", error);
        setWeather(prev => ({ ...prev, desc: "Error de conexión", loading: false }));
      }
    };

    fetchWeather();
  }, [city]);

  return (
    <div className="tech-weather-section">
      <div className="weather-header">
        <div>
          <h2 className="section-title">Clima actual</h2>
          <span className="weather-location">{city}, {province}</span>
        </div>
      </div>

  <div className="weather-display" style={{ opacity: weather.loading ? 0.5 : 1 }}>
        {/* Reemplazamos la lógica del ícono de la API por tu imagen estática */}
        <img className="weather-main-image" src="/src/assets/clima.jpg" alt={weather.desc} />
        
        <div>
          <div className="weather-main-temp">{weather.temp}°C</div>
          <div className="weather-main-desc" style={{ textTransform: "capitalize" }}>
            {weather.desc}
          </div>
        </div>
      </div>

      <div className="weather-details-grid">
        <div className="weather-detail-item">
          <Wind size={20} aria-hidden="true" />
          <div>
            <span className="detail-value">{weather.wind} km/h</span>
            <span></span>
            <span className="detail-label">Viento</span>
          </div>
        </div>
        <div className="weather-detail-item">
          <Droplets size={20} aria-hidden="true" />
          <div>
            <span className="detail-value">{weather.humidity}%</span>
            <span> </span>
            <span className="detail-label">Humedad</span>
          </div>
        </div>
        <div className="weather-detail-item">
          <Eye size={20} aria-hidden="true" />
          <div>
            <span className="detail-value">{weather.visibility} km</span>
            <span> </span>
            <span className="detail-label">Visibilidad</span>
          </div>
        </div>
      </div>
    </div>
  );
}