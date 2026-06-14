import L from "leaflet";
import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";

export function createAssetMarkerIcon(type: string, color: string) {
  return L.divIcon({
    className: "leaflet-asset-marker",
    html: `<span style="background:${color}; border-color:${color}; box-shadow:0 5px 12px rgba(2,18,30,0.28);"></span>`,
    iconAnchor: [5, 5],
    iconSize: [10, 10]
  });
}

export const selectedMarkerIcon = L.divIcon({
  className: "leaflet-asset-marker selected",
  html: "<span></span>",
  iconAnchor: [4, 4],
  iconSize: [8, 8]
});

export const missionRoutePointIcon = L.divIcon({
  className: "leaflet-route-marker",
  html: "<span></span>",
  iconAnchor: [5, 5],
  iconSize: [10, 10]
});

export function MapClickHandler({ onSelect }: { onSelect: (location: { latitude: string; longitude: string }) => void }) {
  useMapEvents({
    click(event) {
      onSelect({
        latitude: event.latlng.lat.toFixed(6),
        longitude: event.latlng.lng.toFixed(6)
      });
    }
  });

  return null;
}

export function MapSizeController({ center }: { center?: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;

    const refreshSize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
      });
    };

    const observer = new ResizeObserver(refreshSize);
    observer.observe(container);
    window.addEventListener("resize", refreshSize);

    refreshSize();
    const timers = [80, 220, 520].map((delay) => window.setTimeout(refreshSize, delay));

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      window.removeEventListener("resize", refreshSize);
    };
  }, [map]);

  useEffect(() => {
    if (!center) return;
    map.setView(center, map.getZoom(), { animate: false });
    map.invalidateSize({ animate: false });
  }, [center, map]);

  return null;
}
