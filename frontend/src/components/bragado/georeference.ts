import { Vector3, MathUtils } from 'three';

// Same reference as scripts/import-bragado-assets.ps1. Survey calibration remains configurable.
export const plantGeoreference = {
  latitude: -35.140583, longitude: -60.458067,
  x: 0, z: 0, metresToUnits: 1, northRotationDegrees: 0,
  eastSign: 1, southSign: 1, groundHeight: 0.113,
  // Required only for absolute-only telemetry; do not guess an AMSL elevation.
  absoluteGroundAltitude: null as number | null,
};
export type GeographicPosition = {latitude:number;longitude:number;altitude?:number;relativeAltitude?:number;absoluteAltitude?:number};
export function toPlantPosition(point:GeographicPosition):Vector3|null {
  if(!Number.isFinite(point.latitude)||!Number.isFinite(point.longitude)||Math.abs(point.latitude)>90||Math.abs(point.longitude)>180)return null;
  const g=plantGeoreference;
  const height=point.relativeAltitude ?? point.altitude ?? (g.absoluteGroundAltitude!==null&&point.absoluteAltitude!==undefined?point.absoluteAltitude-g.absoluteGroundAltitude:NaN);
  if(!Number.isFinite(height))return null;
  const east=(point.longitude-g.longitude)*111320*Math.cos(MathUtils.degToRad(g.latitude))*g.eastSign;
  const south=(g.latitude-point.latitude)*111320*g.southSign,angle=MathUtils.degToRad(g.northRotationDegrees);
  return new Vector3(g.x+(east*Math.cos(angle)-south*Math.sin(angle))*g.metresToUnits,g.groundHeight+height*g.metresToUnits,g.z+(east*Math.sin(angle)+south*Math.cos(angle))*g.metresToUnits);
}
