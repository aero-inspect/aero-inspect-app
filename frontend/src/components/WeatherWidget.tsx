import { useEffect, useState } from "react";
import { Droplets, Eye, Wind } from "lucide-react";
import climaImage from "../assets/clima.jpg";
import { emptyWeather, fetchWeather } from "../services/weather";

export function WeatherWidget({ city = "Bragado", province = "Buenos Aires" }: { city?: string; province?: string }) {
  const [weather, setWeather] = useState(emptyWeather);

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setWeather(await fetchWeather(city));
      } catch (error) {
        console.error("Error fetching weather:", error);
        setWeather((current) => ({ ...current, desc: "Error de conexión", loading: false }));
      }
    };

    loadWeather();
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
        <img className="weather-main-image" src={climaImage} alt={weather.desc} />
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
            <span className="detail-label">Viento</span>
          </div>
        </div>
        <div className="weather-detail-item">
          <Droplets size={20} aria-hidden="true" />
          <div>
            <span className="detail-value">{weather.humidity}%</span>
            <span className="detail-label">Humedad</span>
          </div>
        </div>
        <div className="weather-detail-item">
          <Eye size={20} aria-hidden="true" />
          <div>
            <span className="detail-value">{weather.visibility} km</span>
            <span className="detail-label">Visibilidad</span>
          </div>
        </div>
      </div>
    </div>
  );
}

