import { useEffect, useRef, useState } from "react";
import { haversineDistanceMeters } from "../utils/geo";

type Position = { latitude: number; longitude: number } | null | undefined;

// Acumula la distancia recorrida sumando la distancia entre cada posicion
// nueva y la anterior (el backend no envia un total, solo la posicion
// instantanea en cada evento de telemetria). Se resetea cuando cambia `resetKey`
// (por ejemplo, al cambiar de mision).
export function useTraveledDistance(position: Position, resetKey: string | null | undefined) {
  const [distanceMeters, setDistanceMeters] = useState(0);
  const lastPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    setDistanceMeters(0);
    lastPositionRef.current = null;
  }, [resetKey]);

  useEffect(() => {
    if (!position) return;

    const last = lastPositionRef.current;
    if (last) {
      setDistanceMeters((total) => total + haversineDistanceMeters(last, position));
    }
    lastPositionRef.current = position;
  }, [position?.latitude, position?.longitude]);

  return distanceMeters;
}
