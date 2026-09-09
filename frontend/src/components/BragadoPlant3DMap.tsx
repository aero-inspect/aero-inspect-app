import { useEffect, useMemo, useRef, useState } from "react";
import catalog from "../data/bragado-assets.json";
import { buildPlant } from "./bragado/geometry.js";
import { Maximize2, Minimize2, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BackendAsset, BackendAssetStatus } from "../api/types";

type EquipmentType = "silo" | "flotante" | "celda" | "noria" | "secadora";
type DisplayStatus = "Activo" | "Inactivo" | "En mantenimiento" | "Sin confirmar";
type ViewMode = "top" | "perspective" | "street";

type Equipment = {
  id: string;
  name: string;
  short: string;
  type: EquipmentType;
  status: DisplayStatus;
  capacity?: number;
  description: string;
  position: THREE.Vector3;
  asset?: BackendAsset;
  radius: number;
  height: number;
};

type ProjectedTag = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
};

type MissionPoint = {
  id: string;
  x: number;
  z: number;
};

const OUTER_MISSION_ROUTE: MissionPoint[] = [
  { id: "P01", x: -72, z: -39 }, { id: "P02", x: -64, z: -28 },
  { id: "P03", x: -52, z: -17 }, { id: "P04", x: -38, z: -5 },
  { id: "P05", x: -28, z: 8 }, { id: "P06", x: -17, z: 16 },
  { id: "P07", x: -7, z: 21 }, { id: "P08", x: 6, z: 24 },
  { id: "P09", x: 20, z: 22 }, { id: "P10", x: 31, z: 15 },
  { id: "P11", x: 39, z: 5 }, { id: "P12", x: 38, z: -7 },
  { id: "P13", x: 30, z: -17 }, { id: "P14", x: 19, z: -25 },
  { id: "P15", x: 7, z: -31 }, { id: "P16", x: -6, z: -35 },
  { id: "P17", x: -20, z: -38 }, { id: "P18", x: -34, z: -44 },
  { id: "P19", x: -48, z: -53 }, { id: "P20", x: -58, z: -66 },
  { id: "P21", x: -58, z: -82 }, { id: "P22", x: -47, z: -94 },
  { id: "P23", x: -31, z: -99 }, { id: "P24", x: -16, z: -93 },
  { id: "P25", x: -9, z: -81 }, { id: "P26", x: -15, z: -67 },
  { id: "P27", x: -30, z: -58 }, { id: "P28", x: -45, z: -45 }
];

type MissionRoute = MissionPoint[];

type MissionObstacle = {
  x: number;
  z: number;
  radius?: number;
  width?: number;
  depth?: number;
  angle?: number;
};

function rotatePoint(x: number, z: number, angle: number) {
  return { x: x * Math.cos(angle) - z * Math.sin(angle), z: x * Math.sin(angle) + z * Math.cos(angle) };
}

const MISSION_OBSTACLES: MissionObstacle[] = catalog.map((record) => record.r > 0
  ? { x: record.x, z: record.z, radius: record.r }
  : {
      x: record.x,
      z: record.z,
      width: record.type === "CELDA" ? 27 : record.type === "SECADORA" ? 4.8 : 7,
      depth: record.type === "CELDA" ? 43 : record.type === "SECADORA" ? 4.4 : 7,
      angle: record.type === "CELDA" ? Math.PI / 4 : 0
    });

function pointBlocked(point: MissionPoint, clearance = 1.35) {
  return MISSION_OBSTACLES.some((obstacle) => {
    if (obstacle.radius) return Math.hypot(point.x - obstacle.x, point.z - obstacle.z) < obstacle.radius + clearance;
    const local = rotatePoint(point.x - obstacle.x, point.z - obstacle.z, -(obstacle.angle ?? 0));
    return Math.abs(local.x) < (obstacle.width ?? 0) / 2 + clearance && Math.abs(local.z) < (obstacle.depth ?? 0) / 2 + clearance;
  });
}

function segmentBlocked(start: MissionPoint, end: MissionPoint) {
  const distance = Math.hypot(end.x - start.x, end.z - start.z);
  const steps = Math.max(2, Math.ceil(distance / 0.8));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    if (pointBlocked({ id: "probe", x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t })) return true;
  }
  return false;
}

function safeMissionConnector(start: MissionPoint, end: MissionPoint) {
  if (!segmentBlocked(start, end)) return [start, end];
  const candidates: MissionPoint[] = [start, end];
  MISSION_OBSTACLES.forEach((obstacle, obstacleIndex) => {
    const clearance = 2.4;
    if (obstacle.radius) {
      for (let step = 0; step < 8; step += 1) {
        const angle = step * Math.PI / 4;
        candidates.push({ id: `detour-${obstacleIndex}-${step}`, x: obstacle.x + Math.cos(angle) * (obstacle.radius + clearance), z: obstacle.z + Math.sin(angle) * (obstacle.radius + clearance) });
      }
    } else {
      const width = (obstacle.width ?? 0) / 2 + clearance;
      const depth = (obstacle.depth ?? 0) / 2 + clearance;
      [[-width, -depth], [width, -depth], [width, depth], [-width, depth]].forEach(([x, z], step) => {
        const rotated = rotatePoint(x, z, obstacle.angle ?? 0);
        candidates.push({ id: `detour-${obstacleIndex}-${step}`, x: obstacle.x + rotated.x, z: obstacle.z + rotated.z });
      });
    }
  });
  const distances = new Map<number, number>([[0, 0]]);
  const previous = new Map<number, number>();
  const open = new Set<number>([0]);
  while (open.size) {
    const current = [...open].reduce((best, index) => (distances.get(index)! < distances.get(best)! ? index : best));
    open.delete(current);
    if (current === 1) break;
    candidates.forEach((candidate, next) => {
      if (next === current || pointBlocked(candidate, 0.1) || segmentBlocked(candidates[current], candidate)) return;
      const nextDistance = distances.get(current)! + Math.hypot(candidate.x - candidates[current].x, candidate.z - candidates[current].z);
      if (nextDistance < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, nextDistance);
        previous.set(next, current);
        open.add(next);
      }
    });
  }
  if (!previous.has(1)) return [start, end];
  const path: MissionPoint[] = [];
  let current: number | undefined = 1;
  while (current !== undefined) {
    path.unshift(candidates[current]);
    if (current === 0) break;
    current = previous.get(current);
  }
  return path;
}

function buildMissionRoutes(): MissionRoute[] {
  const routes: MissionRoute[] = [OUTER_MISSION_ROUTE];
  catalog.forEach((record, index) => {
    const local: MissionPoint[] = [];
    if (record.r > 0) {
      for (let step = 0; step < 6; step += 1) {
        const angle = (step / 6) * Math.PI * 2;
        const radius = record.r + 2.2;
        local.push({ id: `A${index + 1}-${step + 1}`, x: record.x + Math.cos(angle) * radius, z: record.z + Math.sin(angle) * radius });
      }
    } else {
      const dimensions = record.type === "CELDA" ? [27, 43] : record.type === "SECADORA" ? [4.8, 4.4] : [7, 7];
      const angle = record.type === "CELDA" ? Math.PI / 4 : 0;
      const [width, depth] = dimensions;
      const perimeter = [
        [-width / 2 - 2, -depth / 2 - 2], [0, -depth / 2 - 2], [width / 2 + 2, -depth / 2 - 2],
        [width / 2 + 2, 0], [width / 2 + 2, depth / 2 + 2], [0, depth / 2 + 2],
        [-width / 2 - 2, depth / 2 + 2], [-width / 2 - 2, 0]
      ];
      perimeter.forEach(([x, z], pointIndex) => {
        const rotated = rotatePoint(x, z, angle);
        local.push({ id: `A${index + 1}-${pointIndex + 1}`, x: record.x + rotated.x, z: record.z + rotated.z });
      });
    }
    routes.push(local);
  });
  const accepted: MissionPoint[] = [];
  const minimumSpacing = 4.2;
  return routes.map((route) => route.filter((point) => {
    const isTooClose = accepted.some((other) => Math.hypot(point.x - other.x, point.z - other.z) < minimumSpacing);
    if (isTooClose) return false;
    accepted.push(point);
    return true;
  })).filter((route) => route.length > 1);
}

const MISSION_ROUTES = buildMissionRoutes();
const MISSION_POINTS = MISSION_ROUTES.flat();

function addMissionDrone(scene: THREE.Scene) {
  const baseGroup = new THREE.Group();
  baseGroup.position.set(34, 0, -48);
  scene.add(baseGroup);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: "#454e50", metalness: 0.6, roughness: 0.48 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: "#d5a13b", metalness: 0.35, roughness: 0.5 });
  const blackMaterial = new THREE.MeshStandardMaterial({ color: "#161c20", metalness: 0.55, roughness: 0.3 });
  const blueMaterial = new THREE.MeshStandardMaterial({ color: "#08a8da", metalness: 0.5, roughness: 0.3 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: "#1c6578", metalness: 0.35, roughness: 0.12, transparent: true, opacity: 0.9 });
  const plate = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 9), baseMaterial);
  plate.position.y = 0.22;
  plate.castShadow = plate.receiveShadow = true;
  baseGroup.add(plate);
  const border = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.08, 0.28), edgeMaterial);
  [-3.75, 3.75].forEach((z) => { const line = border.clone(); line.position.set(0, 0.45, z); baseGroup.add(line); });
  [-5, 5].forEach((x) => { const line = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 7.5), edgeMaterial); line.position.set(x, 0.45, 0); baseGroup.add(line); });
  const drone = new THREE.Group();
  drone.position.y = 2.15;
  drone.scale.setScalar(0.52);
  baseGroup.add(drone);
  const body = new THREE.Mesh(new THREE.SphereGeometry(2.05, 32, 18), blackMaterial);
  body.scale.set(1.28, 0.48, 0.95);
  body.castShadow = true;
  drone.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 14), blackMaterial);
  top.scale.set(1.15, 0.55, 0.9);
  top.position.y = 0.35;
  drone.add(top);
  const makeBeam = (from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) => {
    const delta = to.clone().sub(from);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 12), material);
    beam.position.copy(from.clone().add(to).multiplyScalar(0.5));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    beam.castShadow = true;
    drone.add(beam);
  };
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2 + Math.PI / 4;
    const end = new THREE.Vector3(Math.cos(angle) * 4.1, 0, Math.sin(angle) * 4.1);
    makeBeam(new THREE.Vector3(Math.cos(angle) * 1.1, 0, Math.sin(angle) * 1.1), end, 0.22, blueMaterial);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.42, 20), blackMaterial);
    motor.position.copy(end);
    motor.position.y = 0.12;
    drone.add(motor);
    const propeller = new THREE.Group();
    propeller.position.copy(end);
    propeller.position.y = 0.42;
    const bladeA = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.055, 0.16), blackMaterial);
    bladeA.rotation.y = angle;
    const bladeB = bladeA.clone();
    bladeB.rotation.y = angle + Math.PI / 2;
    propeller.add(bladeA, bladeB);
    drone.add(propeller);
  }
  for (const x of [-1.2, 1.2]) {
    makeBeam(new THREE.Vector3(x, -0.45, -0.65), new THREE.Vector3(x * 1.35, -2.25, -0.95), 0.14, blackMaterial);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.1, 12), blackMaterial);
    foot.rotation.z = Math.PI / 2;
    foot.position.set(x * 1.35, -2.25, -0.95);
    drone.add(foot);
  }
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 2.25, 12), blackMaterial);
  antenna.position.y = 2;
  drone.add(antenna);
  const antennaTop = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 10), blackMaterial);
  antennaTop.position.y = 3.15;
  drone.add(antennaTop);
  const gimbal = new THREE.Group();
  gimbal.position.set(0, -1.45, 1.05);
  const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.82), blackMaterial);
  gimbal.add(cameraBody);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 24), glassMaterial);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -0.15, 0.48);
  gimbal.add(lens);
  drone.add(gimbal);
  return baseGroup;
}

const TYPE_LABELS: Record<EquipmentType, string> = {
  silo: "Silo",
  flotante: "Silo flotante",
  celda: "Celda",
  noria: "Noria",
  secadora: "Secadora"
};

const STATUS_FROM_BACKEND: Record<BackendAssetStatus, DisplayStatus> = {
  ACTIVE: "Activo",
  MAINTENANCE: "En mantenimiento",
  OUT_OF_SERVICE: "Inactivo",
  UNCONFIRMED: "Sin confirmar"
};

const SIZES = {
  cell: { capacity: 10000 },
  silos: { 1: 450, 2: 450, 3: 450, 4: 450, 5: 900, 6: 900, 7: 900, 8: 900, 9: 1760, 10: 2750, 11: 2750 } as Record<number, number>
};

const siloNumbers: Record<string, number> = { G1: 10, G2: 11, G3: 9, M1: 5, M3: 6, M2: 3, M4: 4, M5: 2, M6: 1, M7: 8, M8: 7 };

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function statusFor(id: string, name: string, assets: BackendAsset[]): { status: DisplayStatus; asset?: BackendAsset } {
  const lookup = [id, name].map(normalize);
  const asset = assets.find((candidate) => {
    const fields = [candidate.name, candidate.code, candidate.locationDetail ?? ""].map(normalize);
    return fields.some((field) => lookup.some((key) => key && field === key));
  });
  if (asset) return { status: STATUS_FROM_BACKEND[asset.status], asset };
  if (id === "silo-10" || id === "silo-11") return { status: "Inactivo" };
  if (id === "secadora-1") return { status: "Activo" };
  return { status: "Sin confirmar" };
}

function buildEquipment(assets: BackendAsset[], heightScale: number): Equipment[] {
  const types: Record<string, EquipmentType> = { SILO: "silo", SILO_FLOTANTE: "flotante", CELDA: "celda", NORIA: "noria", SECADORA: "secadora" };
  return catalog.map(record => {
    const matched = assets.find(asset => asset.code === record.code);
    const linked = matched ? {asset: matched, status: STATUS_FROM_BACKEND[matched.status]} : statusFor(record.id, record.name, assets);
    const height = record.h * (["SILO", "SILO_FLOTANTE", "NORIA"].includes(record.type) ? heightScale : 1);
    return {id:record.id, name:record.name, short:record.name, type:types[record.type], ...linked,
      capacity: record.type === "SILO" ? SIZES.silos[Number(record.id.slice(5))] : record.type === "CELDA" ? 10000 : undefined,
      description: linked.asset?.locationDetail ?? "Planta Bragado",
      position:new THREE.Vector3(record.x,height * .6,record.z),radius:record.r,height};
  });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite)) return;
    if (child instanceof THREE.Mesh) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
      material.dispose();
    });
  });
}

function createScene(root: HTMLDivElement, heightScale: number, onProject: (projected: ProjectedTag[]) => void, missionMode: boolean, onMissionPointToggle: (ids: string[]) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  root.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c6d0d5");
  scene.fog = new THREE.Fog("#c6d0d5", 160, 450);
  scene.add(new THREE.HemisphereLight("#e7efff", "#687257", 2.35));

  const sun = new THREE.DirectionalLight("#fff2dd", 2.4);
  sun.position.set(-65, 100, 40);
  sun.castShadow = true;
  sun.shadow.normalBias = 0.04;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, far: 260 });
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  let street = false;
  let currentView: ViewMode = "top";
  let pointer: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener("pointerdown", event => {
    if (!street) return;
    pointer = { x: event.clientX, y: event.clientY };
    camera.rotation.order = "YXZ";
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener("pointermove", event => {
    if (!pointer) return;
    camera.rotation.y -= (event.clientX - pointer.x) * 0.004;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - (event.clientY - pointer.y) * 0.004, -1.3, 1.3);
    pointer = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener("pointerup", () => { pointer = null; });
  renderer.domElement.addEventListener("pointercancel", () => { pointer = null; });

  const visualTubes = [10, 11, 9, 5, 3, 6, 4, 2, 1, 8, 7, "F1", "F2", "F3"].map((to, index) => ({ id: `tube-${index}`, from: "", to: String(to), noria: index < 7 ? 1 : 2 }));
  buildPlant(scene, heightScale, siloNumbers, visualTubes);
  const missionPointGroup = new THREE.Group();
  const missionSelectionLineGroup = new THREE.Group();
  const missionPointMaterials = new Map<string, THREE.MeshStandardMaterial>();
  const missionPointGeometry = new THREE.SphereGeometry(1.25, 24, 16);
  const missionRouteMaterial = new THREE.LineBasicMaterial({ color: "#f3a33b", transparent: true, opacity: 0.72 });
  const selectedMissionPointIds = new Set<string>();
  const missionPointsById = new Map(MISSION_POINTS.map((point) => [point.id, point]));
  if (missionMode) {
    scene.add(missionSelectionLineGroup);
    addMissionDrone(scene);
    MISSION_POINTS.forEach((point) => {
      const material = new THREE.MeshStandardMaterial({ color: "#f3a33b", emissive: "#8b4d0d", emissiveIntensity: 0.5, roughness: 0.42, metalness: 0.08 });
      const marker = new THREE.Mesh(missionPointGeometry, material);
      marker.position.set(point.x, 3.2, point.z);
      marker.userData.missionPointId = point.id;
      marker.castShadow = true;
      missionPointGroup.add(marker);
      missionPointMaterials.set(point.id, material);
    });
    scene.add(missionPointGroup);
  }
  const markerRaycaster = new THREE.Raycaster();
  const markerPointer = new THREE.Vector2();
  let pressedPoint: { x: number; y: number } | null = null;
  const selectMissionPoint = (event: PointerEvent) => {
    if (!missionMode || !pressedPoint || Math.hypot(event.clientX - pressedPoint.x, event.clientY - pressedPoint.y) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    markerPointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    markerRaycaster.setFromCamera(markerPointer, camera);
    const hit = markerRaycaster.intersectObjects(missionPointGroup.children, false)[0];
    const selectedPointId = hit?.object.userData.missionPointId ?? null;
    if (!selectedPointId) return;
    if (selectedMissionPointIds.has(selectedPointId)) selectedMissionPointIds.delete(selectedPointId);
    else selectedMissionPointIds.add(selectedPointId);
    missionPointMaterials.forEach((material, id) => {
      const selected = selectedMissionPointIds.has(id);
      material.color.set(selected ? "#39b96d" : "#f3a33b");
      material.emissive.set(selected ? "#0c6834" : "#8b4d0d");
      material.emissiveIntensity = selected ? 0.95 : 0.5;
    });
    for (const child of [...missionSelectionLineGroup.children]) {
      if (child instanceof THREE.Line) child.geometry.dispose();
      missionSelectionLineGroup.remove(child);
    }
    if (selectedMissionPointIds.size > 1) {
      const selectedPath = Array.from(selectedMissionPointIds).map((id) => missionPointsById.get(id)).filter((point): point is MissionPoint => Boolean(point));
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(selectedPath.map((point) => new THREE.Vector3(point.x, 3.45, point.z)));
      missionSelectionLineGroup.add(new THREE.Line(lineGeometry, missionRouteMaterial));
    }
    onMissionPointToggle(Array.from(selectedMissionPointIds));
  };
  const handleMarkerPointerDown = (event: PointerEvent) => { if (missionMode) pressedPoint = { x: event.clientX, y: event.clientY }; };
  const handleMarkerPointerUp = (event: PointerEvent) => { selectMissionPoint(event); pressedPoint = null; };
  renderer.domElement.addEventListener("pointerdown", handleMarkerPointerDown);
  renderer.domElement.addEventListener("pointerup", handleMarkerPointerUp);
  const highlightGroup = new THREE.Group();
  scene.add(highlightGroup);
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: "#3fbd68", transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const highlightEdgeMaterial = new THREE.LineBasicMaterial({ color: "#168244", transparent: true, opacity: 0.95 });
  const clearHighlight = () => {
    for (const child of [...highlightGroup.children]) {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) child.geometry.dispose();
      highlightGroup.remove(child);
    }
  };
  const highlight = (id: string | null) => {
    clearHighlight();
    if (!id) return;
    const record = catalog.find((item) => item.id === id);
    if (!record) return;
    const height = record.h * (["SILO", "SILO_FLOTANTE", "NORIA"].includes(record.type) ? heightScale : 1);
    if (record.r > 0) {
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(record.r * 1.025, record.r * 1.025, height * 0.98, 64), highlightMaterial);
      glow.position.set(record.x, height * 0.49, record.z);
      highlightGroup.add(glow);
      const ring = new THREE.Mesh(new THREE.RingGeometry(record.r * 1.02, record.r * 1.12, 64), highlightMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(record.x, 0.12, record.z);
      highlightGroup.add(ring);
      const topRing = ring.clone();
      topRing.position.y = height * 0.98;
      highlightGroup.add(topRing);
      return;
    }
    const size = record.type === "CELDA" ? [27, 14, 43] : record.type === "SECADORA" ? [4.8, 11.2, 4.4] : [5.5, 25, 5.5];
    const glow = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), highlightMaterial);
    glow.position.set(record.x, size[1] / 2, record.z);
    if (record.type === "CELDA") glow.rotation.y = Math.PI / 4;
    highlightGroup.add(glow);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(glow.geometry), highlightEdgeMaterial);
    outline.position.copy(glow.position);
    outline.rotation.copy(glow.rotation);
    highlightGroup.add(outline);
  };

  const resize = () => {
    const rect = root.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    const previousDistance = Math.max(175, 145 / camera.aspect);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    if (!street && camera.position.lengthSq() > 0) {
      const ratio = Math.max(175, 145 / camera.aspect) / previousDistance;
      camera.position.sub(controls.target).multiplyScalar(ratio).add(controls.target);
    }
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const setView = (view: ViewMode) => {
    currentView = view;
    street = view === "street";
    controls.enabled = view !== "street";
    if (view === "street") {
      camera.fov = 68;
      camera.position.set(-51, 1.7, 0);
      controls.target.set(-16, 12, -9);
      camera.lookAt(controls.target);
    } else {
      camera.fov = 55;
      const distance = Math.max(175, 145 / camera.aspect);
      controls.target.set(-16, 0, -32);
      camera.position.set(-16, view === "top" ? distance : distance * 0.8, view === "top" ? -31.99 : -32 + distance * 0.65);
    }
    camera.updateProjectionMatrix();
    controls.update();
  };
  setView("top");

  let frameId = 0;
  const animate = () => {
    if (controls.enabled) controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  };
  animate();

  return {
    setView,
    highlight,
    setMissionSelection(ids: string[]) {
      selectedMissionPointIds.clear();
      ids.forEach((id) => selectedMissionPointIds.add(id));
      missionPointMaterials.forEach((material, id) => {
        const selected = selectedMissionPointIds.has(id);
        material.color.set(selected ? "#39b96d" : "#f3a33b");
        material.emissive.set(selected ? "#0c6834" : "#8b4d0d");
        material.emissiveIntensity = selected ? 0.95 : 0.5;
      });
      for (const child of [...missionSelectionLineGroup.children]) {
        if (child instanceof THREE.Line) child.geometry.dispose();
        missionSelectionLineGroup.remove(child);
      }
      if (selectedMissionPointIds.size > 1) {
        const selectedPath = Array.from(selectedMissionPointIds).map((id) => missionPointsById.get(id)).filter((point): point is MissionPoint => Boolean(point));
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(selectedPath.map((point) => new THREE.Vector3(point.x, 3.45, point.z)));
        missionSelectionLineGroup.add(new THREE.Line(lineGeometry, missionRouteMaterial));
      }
    },
    project(items: Equipment[]) {
      const rect = root.getBoundingClientRect();
      const placed: Array<{ x: number; y: number }> = [];
      onProject(items.map((item) => {
        const anchor = item.position.clone();
        if (currentView === "top") {
          anchor.y = item.height + item.radius * .3;
        } else if (item.radius > 0) {
          // Attach the label to the camera-facing wall, not above the roof.
          const facing = new THREE.Vector3(camera.position.x - anchor.x, 0, camera.position.z - anchor.z).normalize();
          anchor.addScaledVector(facing, item.radius + .08);
        }
        const ray = anchor.clone().sub(camera.position);
        const horizontal = ray.x * ray.x + ray.z * ray.z;
        const occluded = currentView !== "top" && horizontal > 0 && catalog.some(other => {
          if (other.id === item.id || !other.r) return false;
          const ox = camera.position.x - other.x, oz = camera.position.z - other.z;
          const linear = 2 * (ox * ray.x + oz * ray.z);
          const discriminant = linear * linear - 4 * horizontal * (ox * ox + oz * oz - other.r * other.r);
          if (discriminant < 0) return false;
          const entry = Math.max(0, (-linear - Math.sqrt(discriminant)) / (2 * horizontal));
          const exit = Math.min(.99, (-linear + Math.sqrt(discriminant)) / (2 * horizontal));
          if (exit < entry) return false;
          const y1 = camera.position.y + ray.y * entry, y2 = camera.position.y + ray.y * exit;
          return Math.max(y1, y2) > 0 && Math.min(y1, y2) < other.h * heightScale;
        });
        const point = anchor.project(camera);
        const x = (point.x + 1) * rect.width / 2;
        const y = (1 - point.y) * rect.height / 2;
        const visible = !occluded && point.z >= -1 && point.z <= 1 && x > 38 && x < rect.width - 38 && y > 70 && y < rect.height - 14 &&
          !placed.some(tag => Math.abs(tag.x - x) < 76 && Math.abs(tag.y - y) < 26);
        if (visible) placed.push({ x, y });
        return {
          id: item.id,
          x, y, visible
        };
      }));
    },
    destroy() {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", handleMarkerPointerDown);
      renderer.domElement.removeEventListener("pointerup", handleMarkerPointerUp);
      pointGeometryCleanup();
      missionSelectionLineGroup.traverse((child) => {
        if (child instanceof THREE.Line) child.geometry.dispose();
      });
      missionRouteMaterial.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };

  function pointGeometryCleanup() {
    missionPointGeometry.dispose();
    missionPointMaterials.forEach((material) => material.dispose());
  }
}

export type MapFilters = { type: string; status: string; search?: string };
export function BragadoPlant3DMap({ assets, onViewAsset, filters, focusedAssetCode, missionMode = false }: { assets: BackendAsset[]; onViewAsset?: (idAsset: number) => void; filters?: MapFilters; focusedAssetCode?: string | null; missionMode?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const [heightScale, setHeightScale] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("top");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMissionPoints, setSelectedMissionPoints] = useState<string[]>([]);
  const [projected, setProjected] = useState<ProjectedTag[]>([]);
  const [types, setTypes] = useState<Set<EquipmentType>>(new Set(["silo", "flotante", "celda", "noria", "secadora"]));
  const [states, setStates] = useState<Set<DisplayStatus>>(new Set(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"]));

  const equipment = useMemo(() => buildEquipment(assets, heightScale), [assets, heightScale]);
  const visibleEquipment = useMemo(
    () => equipment.filter((item) => {
      if (!filters) return types.has(item.type) && states.has(item.status);
      const label = TYPE_LABELS[item.type];
      const status = item.status === "Inactivo" ? "Fuera de servicio" : item.status;
      return (filters.type === "Todos" || filters.type === label) &&
        (filters.status === "Todos" || filters.status === status) &&
        (!filters.search || normalize(`${item.name} ${label} ${status}`).includes(normalize(filters.search)));
    }),
    [equipment, states, types, filters]
  );
  const focusedId = focusedAssetCode ? equipment.find((item) => item.asset?.code === focusedAssetCode)?.id ?? null : null;
  const activeHighlightId = focusedId ?? selectedId;
  const selected = visibleEquipment.find((item) => item.id === activeHighlightId);
  const projectedById = new Map(projected.map((tag) => [tag.id, tag]));

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [expanded]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    sceneRef.current?.destroy();
    sceneRef.current = createScene(root, heightScale, setProjected, missionMode, setSelectedMissionPoints);
    sceneRef.current.setView(viewMode);
    return () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [heightScale, missionMode]);

  useEffect(() => {
    sceneRef.current?.setView(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = window.setInterval(() => sceneRef.current?.project(visibleEquipment), 32);
    sceneRef.current?.project(visibleEquipment);
    return () => window.clearInterval(timer);
  }, [visibleEquipment]);

  useEffect(() => {
    sceneRef.current?.highlight(activeHighlightId);
  }, [activeHighlightId, heightScale]);

  useEffect(() => {
    sceneRef.current?.setMissionSelection(selectedMissionPoints);
  }, [selectedMissionPoints]);

  const toggleType = (type: EquipmentType) => setTypes((current) => {
    const next = new Set(current);
    next.has(type) ? next.delete(type) : next.add(type);
    return next;
  });
  const toggleState = (status: DisplayStatus) => setStates((current) => {
    const next = new Set(current);
    next.has(status) ? next.delete(status) : next.add(status);
    return next;
  });

  const resetFilters = () => {
    setTypes(new Set(["silo", "flotante", "celda", "noria", "secadora"]));
    setStates(new Set(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"]));
  };

  return (
    <div className={`bragado-map${expanded ? " bragado-map-expanded" : ""}`}>
      <div className="bragado-map-stage" ref={rootRef} />
      <div className="bragado-map-toolbar">
        <button type="button" title={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-label={expanded ? "Reducir mapa" : "Ampliar mapa"} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        {!missionMode && <button type="button" title={panelOpen ? "Minimizar panel" : "Equipos y controles"} aria-label={panelOpen ? "Minimizar panel" : "Equipos y controles"} aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><SlidersHorizontal size={18} /></button>}
        <select aria-label="Vista 3D" onChange={(event) => setViewMode(event.target.value as ViewMode)} value={viewMode}>
          <option value="top">Desde arriba</option>
          <option value="perspective">Perspectiva</option>
          <option value="street">Nivel suelo</option>
        </select>
      </div>
      {missionMode && <div className="bragado-map-mission-point" role="status">
        <span>{selectedMissionPoints.length ? `${selectedMissionPoints.length} puntos seleccionados` : "Seleccioná puntos del recorrido"}</span>
        <button type="button" disabled={!selectedMissionPoints.length} onClick={() => setSelectedMissionPoints([])} title="Deseleccionar todos">
          <RotateCcw size={13} />
          <span>Limpiar</span>
        </button>
      </div>}
      {panelOpen && !missionMode && <aside className="bragado-map-panel">
        <header>
          <span>{visibleEquipment.length} de {equipment.length}</span>
          <strong>Mapa 3D Bragado</strong>
          <button type="button" title="Minimizar panel" aria-label="Minimizar panel" onClick={() => setPanelOpen(false)}><X size={16} /></button>
        </header>
        <label>Altura <input aria-label="Altura estimada" max="1.35" min="0.75" onChange={(event) => setHeightScale(Number(event.target.value))} step="0.01" type="range" value={heightScale} /></label>
        {!filters && <>
        <div className="bragado-map-filter-block">
          <span>Tipo</span>
          <div>
            {(Object.keys(TYPE_LABELS) as EquipmentType[]).map((type) => (
              <button className={types.has(type) ? "active" : undefined} key={type} onClick={() => toggleType(type)} type="button">
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="bragado-map-filter-block">
          <span>Estado</span>
          <div>
            {(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"] as DisplayStatus[]).map((status) => (
              <button className={states.has(status) ? "active" : undefined} key={status} onClick={() => toggleState(status)} type="button">
                {status}
              </button>
            ))}
          </div>
        </div>
        <button className="bragado-map-reset" onClick={resetFilters} type="button">Ver todo</button>
        </>}
        {selected && (
          <section className="bragado-map-detail">
            <p>{TYPE_LABELS[selected.type]} · <span className={`state ${selected.status}`}>{selected.status}</span></p>
            <h3>{selected.name}</h3>
            <span>{selected.capacity ? `${selected.capacity.toLocaleString("es-AR")} t` : selected.description}</span>
            {selected.asset && onViewAsset && (
              <button onClick={() => onViewAsset(selected.asset!.idAsset)} type="button">Ver activo</button>
            )}
          </section>
        )}
        <div className="bragado-map-list">
          {visibleEquipment.map((item) => (
            <button className={item.id === selectedId ? "selected" : undefined} key={item.id} onClick={() => setSelectedId(item.id)} type="button">
              <strong>{item.name}</strong>
              <span>{TYPE_LABELS[item.type]} · {item.status}</span>
            </button>
          ))}
        </div>
      </aside>}
    </div>
  );
}
