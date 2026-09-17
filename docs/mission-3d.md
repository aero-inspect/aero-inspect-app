# Mission detail 3D viewer

Only MonitorMission's map changes. MissionDetailRouteMap remains the 2D map for
planning and the table's summary. Start, scheduling, status labels, panels and
backend execution are unchanged. The live viewer reuses BragadoPlant3DMap in
read-only playback mode, without selectable aerial points or asset editing.

## Existing telemetry

MAVSDK simulator streams feed flight-controller/telemetry/state.py.
telemetry/publisher.py publishes MQTT aeroinspect/dron/{droneId}/telemetry
(default 1 Hz). The monolith relays this to the existing mission SSE endpoint
/api/v1/telemetry/missions/{id}/stream. useMissionTelemetry owns the sole
subscription; native EventSource reconnects after transient errors.

Position includes latitude, longitude, relativeAltitude and absoluteAltitude.
Velocity includes headingDegree. Aircraft pitch/roll are not published; gimbal
angles in waypoints are camera angles, not aircraft attitude, and are not used
to rotate the aircraft. No backend or flight-controller contract changes.

## Calibration

components/bragado/georeference.ts centralizes the reference used by the existing
Bragado import: latitude -35.140583, longitude -60.458067 maps to local (0,0).
Local X is east, Z south, one unit is one metre, no north rotation. Plan altitude
and relativeAltitude are heights above home. groundHeight is the dock surface.
absoluteGroundAltitude deliberately remains null: surveyed home elevation above
mean sea level is unknown. Absolute-only data is not rendered until configured.

The visual dock (-72,-65) and the real plan's home may differ. Do not shift live
telemetry or snap the aircraft to the dock to hide that discrepancy. To calibrate,
measure GPS at a known point (ideally the dock), its local X/Z, north alignment
and home elevation, then update this one configuration for drone and both routes.

## Playback

No movement is generated before telemetry arrives. Position and heading blend
between received samples over at most 650 ms, with no extrapolation. Invalid and
out-of-order samples are ignored. Completion freezes at the last valid sample;
the MISSION_COMPLETED SSE event also freezes the visual without issuing commands.
Center plant turns follow off. Follow preserves the camera's orbit offset.

The real trail is sessionStorage-backed per mission in this browser tab, includes
only received samples and decimates above 4096 vertices. Reloading in this tab
can recover it; a new browser cannot reconstruct an earlier flight without a
historical telemetry API (none is exposed by the current stream). Existing saved
plans are never modified. Startup seed data is unrelated to this visualization.

## Checks

Run npm run build from frontend. Browser checks should cover pending/live/finished
states, stale packets, altitude, heading, follow toggle, centering, reconnect and
the absence of planning controls. Validate actual mission execution with the
simulator separately; the viewer does not start flights during automated checks.

With Vite running, run node scripts/check-mission-3d.cjs from the repository root.
It uses Playwright and installed Microsoft Edge. PLAYWRIGHT_MODULE can point to
an existing Playwright installation; APP_URL defaults to http://127.0.0.1:5173.
Screenshots are written to the OS temporary directory, not committed to the repo.
