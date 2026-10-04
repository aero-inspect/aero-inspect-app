import { useEffect, useState } from "react";
import { Bell, UserRound, X } from "lucide-react";
import { emptyWeather, fetchWeather } from "../services/weather";
import { getWeatherIcon } from "../utils/weatherIcon";

import { useSelectedPlant } from "../data/PlantContext";
import { LUJAN_PLANT } from "../data/plants";
import { useActivity, noticeTitles, eventDate } from "../data/ActivityContext";

export function AppTopActions() {
  const plant = useSelectedPlant();
  const WEATHER_CITY = plant.id === LUJAN_PLANT.id ? "Luján" : "Bragado";
  const [isOpen, setIsOpen] = useState(false);
  const {notifications,unread,markRead,dismiss,loading,error}=useActivity();
  const [weather, setWeather] = useState(emptyWeather);
  const goToProfile = () => {
    window.history.pushState({}, "", "/perfil");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  useEffect(() => {
    const loadWeather = async () => {
      try {
        setWeather(await fetchWeather(WEATHER_CITY));
      } catch (error) {
        console.error("Error fetching weather:", error);
        setWeather((current) => ({ ...current, desc: "Sin conexión", loading: false }));
      }
    };

    loadWeather();
  }, [WEATHER_CITY]);

  const WeatherIcon = getWeatherIcon(weather.icon);


  return (
    <div className="app-top-actions">
      <div className="app-weather" style={{ opacity: weather.loading ? 0.6 : 1 }}>
        <WeatherIcon aria-hidden="true" className="weather-icon" size={26} />
        <div>
          <strong>{weather.loading ? "--" : weather.temp}{String.fromCharCode(176)}C</strong>
          <span style={{ textTransform: "capitalize" }}>({WEATHER_CITY}) {weather.desc}</span>
        </div>
      </div>

      <div className="notifications-menu-wrap">
        <button className="tech-notification-button" onClick={() => {if(!isOpen)markRead();setIsOpen((current) => !current);}} type="button" aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`} aria-expanded={isOpen}>
          <Bell size={20} />
          {unread>0 && <span aria-hidden="true" />}
        </button>

        {isOpen && (
          <section className="notifications-popover" aria-label="Notificaciones">
            <header>
              <h2>Notificaciones</h2>
            </header>
            <div className="notifications-list">
              {error && <p className="notifications-message" role="status">{error}</p>}
              {!notifications.length && !error && <p className="notifications-message">{loading?'Cargando notificaciones…':'No hay ninguna notificación.'}</p>}
              {notifications.map((item) => (
                <article className="notification-item" key={item.id}>
                  <div>
                    <strong>{noticeTitles[item.kind] ?? item.kind}</strong>
                    <p>{item.name}</p>
                    <small>{eventDate(item.occurredAt)}</small>
                  </div>
                  <button className="notification-dismiss" aria-label={`Eliminar notificación: ${item.name}`} title="Eliminar notificación" onClick={()=>dismiss(item.id)} type="button"><X size={16} aria-hidden="true" /></button>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <button className="tech-user-button" onClick={goToProfile} type="button" aria-label="Perfil">
        <UserRound size={21} />
      </button>
    </div>
  );
}

export function DroneGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <path d="M7 8h10M12 8v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9.5 13h5l1.6 3H7.9L9.5 13Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="5" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="19" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 5.8V4M19 5.8V4M9.5 18h-2M14.5 18h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

