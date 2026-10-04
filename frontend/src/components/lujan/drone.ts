import { Vector3 } from 'three';
import { lujanToLocal } from '../../data/plants';
import type { PlaybackGeoreference } from '../bragado/missionPlayback';

export const LUJAN_DRONE_BASE = { latitude: -34.5508549, longitude: -59.0675193 };
// A 1.12 m landing pad, proportionate to the 46 cm stools.
export const LUJAN_DRONE_SCALE = .4;
const dockHeight = .113 * LUJAN_DRONE_SCALE;
export const lujanPlaybackReference: PlaybackGeoreference = {
  northRotationDegrees: 0,
  groundHeight: dockHeight,
  storagePrefix: 'aeroinspect.lujan.mission-trail.',
  stayAtDockUntilTelemetry: true,
  showActualTrail: true,
  toPosition(point) {
    const height = point.relativeAltitude ?? point.altitude;
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180 ||
        height === undefined || !Number.isFinite(height)) return null;
    const [x, z] = lujanToLocal(point.latitude, point.longitude);
    return new Vector3(x, dockHeight + height, z);
  }
};
