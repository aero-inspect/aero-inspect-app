import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BackendAsset, BackendAssetStatus } from "../api/types";

type EquipmentType = "silo" | "flotante" | "celda" | "noria" | "tubo" | "ventilador" | "secadora" | "descarga";
type DisplayStatus = "Activo" | "Inactivo" | "En mantenimiento" | "Sin confirmar";
type ViewMode = "top" | "perspective" | "street";

type Bin = { id: string; x: number; z: number; r: number; h: number; number?: number; type: EquipmentType };
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
  hiddenInScene?: boolean;
};

type ProjectedTag = {
  id: string;
  x: number;
  y: number;
  visible: boolean;
};

const TYPE_LABELS: Record<EquipmentType, string> = {
  silo: "Silo",
  flotante: "Flotante",
  celda: "Celda",
  noria: "Noria",
  tubo: "Tubo",
  ventilador: "Ventilador",
  secadora: "Secadora",
  descarga: "Descarga"
};

const STATUS_FROM_BACKEND: Record<BackendAssetStatus, DisplayStatus> = {
  ACTIVE: "Activo",
  MAINTENANCE: "En mantenimiento",
  OUT_OF_SERVICE: "Inactivo"
};

const SIZES = {
  cell: { capacity: 10000 },
  silos: { 1: 450, 2: 450, 3: 450, 4: 450, 5: 900, 6: 900, 7: 900, 8: 900, 9: 1760, 10: 2750, 11: 2750 } as Record<number, number>
};

const siloNumbers: Record<string, number> = { G1: 10, G2: 11, G3: 9, M1: 5, M3: 6, M2: 3, M4: 4, M5: 2, M6: 1, M7: 8, M8: 7 };

const bins: Bin[] = [
  ["G1", 179, 64, 112, 19],
  ["G2", 93, 168, 112, 19],
  ["G3", 460, 465, 108, 17],
  ["M1", 242, 145, 72, 14],
  ["M2", 298, 195, 66, 13],
  ["M3", 181, 218, 74, 14],
  ["M4", 242, 254, 64, 12],
  ["M5", 363, 266, 62, 12],
  ["M6", 316, 326, 68, 14],
  ["M7", 437, 331, 76, 15],
  ["M8", 373, 395, 78, 15],
  ["P1", 252, 390, 36, 8],
  ["P2", 294, 374, 29, 10],
  ["P3", 285, 431, 29, 7]
].map(([id, u, v, d, h]) => ({
  id: String(id),
  x: (Number(u) - 292) * 0.16,
  z: (Number(v) - 277) * 0.16,
  r: Number(d) * 0.08,
  h: Number(h),
  number: siloNumbers[String(id)],
  type: String(id).startsWith("P") ? "flotante" : "silo"
}));

const tubeDestinations = [10, 11, 9, 5, 3, 6, 4, 2, 1, 8, 7, "F1", "F2", "F3"];
const tubeConnections = tubeDestinations.map((to, index) => ({ id: `tube-${index}`, from: "", to: String(to), noria: index < 7 ? 1 : 2 }));

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function statusFor(id: string, name: string, assets: BackendAsset[]): { status: DisplayStatus; asset?: BackendAsset } {
  const lookup = [id, name].map(normalize);
  const asset = assets.find((candidate) => {
    const fields = [candidate.name, candidate.code, candidate.locationDetail ?? ""].map(normalize);
    return fields.some((field) => lookup.some((key) => key && field.includes(key)));
  });
  if (asset) return { status: STATUS_FROM_BACKEND[asset.status], asset };
  if (id === "silo-10" || id === "silo-11") return { status: "Inactivo" };
  if (id === "secadora-1") return { status: "Activo" };
  return { status: "Sin confirmar" };
}

function buildEquipment(assets: BackendAsset[], heightScale: number): Equipment[] {
  const siloEquipment = bins.map((bin) => {
    const label = bin.number ? `Silo ${bin.number}` : `F${bin.id.slice(1)}`;
    const id = bin.number ? `silo-${bin.number}` : label;
    const status = statusFor(id, label, assets);
    return {
      id,
      name: label,
      short: bin.number ? String(bin.number) : label,
      type: bin.type,
      status: status.status,
      capacity: bin.number ? SIZES.silos[bin.number] : undefined,
      description: bin.number ? "Silo metalico de almacenamiento." : "Silo flotante identificado desde la distribucion satelital.",
      position: new THREE.Vector3(bin.x, bin.h * heightScale + bin.r * 0.3 + 1, bin.z),
      asset: status.asset
    };
  });

  const fanEquipment = bins.filter((bin) => bin.number).map((bin) => {
    const angle = Math.atan2(bin.x, bin.z);
    const distance = bin.r + 1.2;
    const name = `V${bin.number}`;
    const status = statusFor(name, `Ventilador ${bin.number}`, assets);
    return {
      id: name,
      name,
      short: name,
      type: "ventilador" as const,
      status: status.status,
      description: `Ventilador del Silo ${bin.number}.`,
      position: new THREE.Vector3(bin.x + Math.sin(angle) * distance, 1.5, bin.z + Math.cos(angle) * distance),
      asset: status.asset
    };
  });

  const fixedEquipment: Equipment[] = [
    { id: "cell", name: "Celda 1", short: "C1", type: "celda", capacity: SIZES.cell.capacity, description: "Celda de almacenamiento de 10.000 t.", position: new THREE.Vector3(-37, 17, -60), ...statusFor("cell", "Celda 1", assets) },
    { id: "secadora-1", name: "Secadora 1", short: "SC1", type: "secadora", description: "Secadora rectangular de tres niveles.", position: new THREE.Vector3(-9, 11, 10), ...statusFor("secadora-1", "Secadora 1", assets) },
    { id: "noria-1", name: "Noria 1", short: "N1", type: "noria", description: "Conjunto central de elevacion.", position: new THREE.Vector3(-1, 32, 0), ...statusFor("noria-1", "Noria 1", assets) },
    { id: "noria-2", name: "Noria 2", short: "N2", type: "noria", description: "Segundo conjunto de elevacion.", position: new THREE.Vector3(12, 27, 5), ...statusFor("noria-2", "Noria 2", assets) },
    { id: "descarga", name: "Descarga camiones", short: "DC", type: "descarga", description: "Techo y zona de descarga bajo cubierta.", position: new THREE.Vector3(14, 13, -18), ...statusFor("descarga", "Descarga camiones", assets) }
  ];

  const tubeEquipment = tubeConnections.map((tube) => {
    const ends = tubeEnds(tube, heightScale);
    const name = tube.from ? `T${tube.from}${tube.to}` : `T?-${tube.to}`;
    const status = statusFor(name, name, assets);
    return {
      id: tube.id,
      name,
      short: name,
      type: "tubo" as const,
      status: status.status,
      description: "Tubo de interconexion entre equipos.",
      position: ends.a.clone().add(ends.b).multiplyScalar(0.5),
      asset: status.asset
    };
  });

  return [...siloEquipment, ...fixedEquipment, ...fanEquipment, ...tubeEquipment];
}

function findBin(id: string) {
  return bins.find((bin) => String(bin.number ?? `F${bin.id.slice(1)}`) === String(id));
}

function tubeEnds(tube: { from: string; to: string; noria: number }, heightScale: number) {
  const roof = (bin: Bin) => new THREE.Vector3(bin.x, bin.h * heightScale + bin.r * 0.3, bin.z);
  const towers = [new THREE.Vector3(-1, 30 * heightScale, 0), new THREE.Vector3(12, 24 * heightScale, 5)];
  const destination = findBin(tube.to) ?? bins[0];
  const origin = tube.from ? roof(findBin(tube.from) ?? destination) : towers[tube.noria - 1];
  return { a: origin, b: roof(destination) };
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function createScene(root: HTMLDivElement, heightScale: number, onProject: (projected: ProjectedTag[]) => void) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, far: 260 });
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 600);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.025;

  const material = (color: string, metalness = 0, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const steel = material("#a6afb0", 0.6, 0.55);
  const frame = material("#505f43", 0.4);
  const rust = material("#8a6956", 0.35);
  const yellow = material("#c0aa54");
  const concrete = material("#97978f");
  const dark = material("#343b37");
  const grass = material("#718256");

  const addMesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = scene) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat = steel, parent: THREE.Object3D = scene) => {
    const mesh = addMesh(new THREE.BoxGeometry(w, h, d), mat, parent);
    mesh.position.set(x, y + h / 2, z);
    return mesh;
  };
  const beam = (a: [number, number, number], b: [number, number, number], r = 0.09, mat = frame, parent: THREE.Object3D = scene) => {
    const av = new THREE.Vector3(...a);
    const bv = new THREE.Vector3(...b);
    const delta = bv.clone().sub(av);
    const mesh = addMesh(new THREE.CylinderGeometry(r, r, delta.length(), 8), mat, parent);
    mesh.position.copy(av.add(bv).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };

  const ground = addMesh(new THREE.PlaneGeometry(900, 900), grass);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.06;
  ground.castShadow = false;

  const path = (points: Array<[number, number]>, width: number) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0.025, z)));
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= 100; i += 1) {
      const point = curve.getPoint(i / 100);
      const tangent = curve.getTangent(i / 100);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(width / 2);
      vertices.push(point.x + normal.x, point.y, point.z + normal.z, point.x - normal.x, point.y, point.z - normal.z);
      if (i < 100) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = addMesh(geometry, concrete);
    mesh.castShadow = false;
  };

  path([[-98, -62], [-62, -19], [-27, 16], [12, 56], [65, 108]], 7);
  path([[12, 56], [42, 41], [42, 10], [24, -7], [14, -18], [1, -32]], 9);
  path([[-62, -19], [-46, -27], [-33, -33]], 6);

  const gabled = (w: number, d: number, h: number, rise: number, x: number, z: number, open = false) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = -Math.PI / 4;
    scene.add(group);
    if (!open) box(w, h, d, 0, 0, 0, steel, group);
    const angle = Math.atan2(rise, w / 2);
    const slope = Math.hypot(w / 2, rise);
    for (const side of [-1, 1]) {
      const panel = box(slope + 0.4, 0.16, d + 0.7, side * w / 4, h + rise / 2, 0, steel, group);
      panel.rotation.z = -side * angle;
      for (let zz = -d / 2; zz <= d / 2; zz += 3) {
        beam([side * w / 2, 0, zz], [side * w / 2, h, zz], 0.13, frame, group);
        beam([side * w / 2, h, zz], [0, h + rise, zz], 0.09, frame, group);
      }
    }
    return group;
  };

  gabled(27, 43, 8, 6, -37, -60).rotation.y += Math.PI / 2;
  const canopy = gabled(18, 13, 9, 1.5, 14, -18, true);
  box(0.12, 4, 13, -9, 5, 0, steel, canopy);
  box(0.12, 3, 13, 9, 6, 0, steel, canopy);
  box(8, 0.12, 12, 0, 0.05, 0, concrete, canopy);
  for (const z of [-6.5, 6.5]) box(18, 2.3, 0.12, 0, 6.7, z, steel, canopy);

  const fence = [[-80, -34], [-82, -89], [-28, -96], [7, -48], [53, 1], [59, 44], [22, 64]];
  for (let i = 0; i < fence.length; i += 1) {
    const [x1, z1] = fence[i];
    const [x2, z2] = fence[(i + 1) % fence.length];
    beam([x1, 1.1, z1], [x2, 1.1, z2], 0.025, dark);
    beam([x1, 1.8, z1], [x2, 1.8, z2], 0.025, dark);
  }

  for (const bin of bins) {
    const height = bin.h * heightScale;
    const small = bin.type === "flotante";
    const profile: THREE.Vector2[] = [];
    const base = small ? 3 : 0.35;
    for (let y = 0; y <= height - base; y += 0.1) profile.push(new THREE.Vector2(bin.r + Math.sin(y * Math.PI * 2 / 0.16) * 0.027, y + base));
    const silo = addMesh(new THREE.LatheGeometry(profile, 72), steel);
    silo.position.set(bin.x, 0, bin.z);
    const foundation = addMesh(new THREE.CylinderGeometry(bin.r + 0.05, bin.r + 0.06, 0.4, 56), concrete);
    foundation.position.set(bin.x, 0.2, bin.z);
    const roof = addMesh(new THREE.ConeGeometry(bin.r, bin.r * 0.3, 56), bin.id.startsWith("M") ? rust : steel);
    roof.position.set(bin.x, height + bin.r * 0.15, bin.z);
    if (!small) {
      for (const dx of [-0.35, 0.35]) beam([bin.x + dx, 0.5, bin.z + bin.r + 0.2], [bin.x + dx, height, bin.z + bin.r + 0.2], 0.035, yellow);
      const angle = Math.atan2(bin.x, bin.z);
      const d = bin.r + 1.2;
      const fx = bin.x + Math.sin(angle) * d;
      const fz = bin.z + Math.cos(angle) * d;
      const fan = addMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.72, 28), frame);
      fan.position.set(fx, 0.85, fz);
      fan.rotation.z = Math.PI / 2;
      beam([fx, 0.95, fz], [bin.x, 1.2, bin.z], 0.16, frame);
    } else {
      const hopper = addMesh(new THREE.CylinderGeometry(bin.r, 0.3, 2.6, 36), frame);
      hopper.position.set(bin.x, 1.9, bin.z);
    }
  }

  for (const [x, z, height] of [[-1, 0, 31], [12, 5, 25]]) {
    const h = height * heightScale;
    for (const dx of [-0.45, 0.45]) box(0.38, h, 0.35, x + dx, 0, z, frame);
    box(3.4, 0.15, 3.4, x, h - 1.3, z, dark);
    box(2.6, 1.6, 2.6, x, h - 1, z, frame);
    for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) beam([x + dx, 0, z + dz], [x + dx, h, z + dz], 0.1, frame);
  }

  for (const tube of tubeConnections) {
    const ends = tubeEnds(tube, heightScale);
    beam([ends.a.x, ends.a.y, ends.a.z], [ends.b.x, ends.b.y, ends.b.z], 0.16, frame);
  }

  const streetDirection = new THREE.Vector3(-0.72, 0, 0.72);
  for (const n of [9, 10, 11]) {
    const bin = bins.find((item) => item.number === n);
    if (!bin) continue;
    const start = new THREE.Vector3(bin.x, bin.h * heightScale * 0.52, bin.z).add(streetDirection.clone().multiplyScalar(bin.r * 0.65));
    const end = start.clone().add(streetDirection.clone().multiplyScalar(6));
    beam([start.x, start.y, start.z], [end.x, end.y, end.z], 0.2, rust);
    beam([start.x, start.y + 0.8, start.z], [end.x, end.y + 0.8, end.z], 0.2, rust);
  }

  const resize = () => {
    const rect = root.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(rect.height, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const setView = (view: ViewMode) => {
    controls.enabled = view !== "street";
    if (view === "street") {
      camera.fov = 68;
      camera.position.set(-51, 1.7, 0);
      controls.target.set(-16, 12, -9);
      camera.lookAt(controls.target);
    } else {
      camera.fov = 55;
      const distance = Math.max(150, 125 / camera.aspect);
      controls.target.set(-8, 0, -23);
      camera.position.set(-8, view === "top" ? distance : distance * 0.8, view === "top" ? -22.99 : -23 + distance * 0.65);
    }
    camera.updateProjectionMatrix();
    controls.update();
  };
  setView("top");

  let frameId = 0;
  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  };
  animate();

  return {
    setView,
    project(items: Equipment[]) {
      const rect = root.getBoundingClientRect();
      onProject(items.map((item) => {
        const point = item.position.clone().project(camera);
        return {
          id: item.id,
          x: (point.x + 1) * rect.width / 2,
          y: (1 - point.y) * rect.height / 2,
          visible: point.z >= -1 && point.z <= 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1
        };
      }));
    },
    destroy() {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

export function BragadoPlant3DMap({ assets, onViewAsset }: { assets: BackendAsset[]; onViewAsset?: (idAsset: number) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const [heightScale, setHeightScale] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("top");
  const [selectedId, setSelectedId] = useState("silo-1");
  const [projected, setProjected] = useState<ProjectedTag[]>([]);
  const [types, setTypes] = useState<Set<EquipmentType>>(new Set(["silo", "flotante", "celda", "noria", "tubo", "ventilador", "secadora", "descarga"]));
  const [states, setStates] = useState<Set<DisplayStatus>>(new Set(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"]));

  const equipment = useMemo(() => buildEquipment(assets, heightScale), [assets, heightScale]);
  const selected = equipment.find((item) => item.id === selectedId) ?? equipment[0];
  const visibleEquipment = useMemo(
    () => equipment.filter((item) => types.has(item.type) && states.has(item.status)),
    [equipment, states, types]
  );
  const projectedById = new Map(projected.map((tag) => [tag.id, tag]));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    sceneRef.current?.destroy();
    sceneRef.current = createScene(root, heightScale, setProjected);
    sceneRef.current.setView(viewMode);
    return () => {
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [heightScale]);

  useEffect(() => {
    sceneRef.current?.setView(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const timer = window.setInterval(() => sceneRef.current?.project(visibleEquipment), 120);
    sceneRef.current?.project(visibleEquipment);
    return () => window.clearInterval(timer);
  }, [visibleEquipment]);

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
    setTypes(new Set(["silo", "flotante", "celda", "noria", "tubo", "ventilador", "secadora", "descarga"]));
    setStates(new Set(["Activo", "Inactivo", "En mantenimiento", "Sin confirmar"]));
  };

  return (
    <div className="bragado-map">
      <div className="bragado-map-stage" ref={rootRef} />
      <div className="bragado-map-tags" aria-hidden="false">
        {visibleEquipment.map((item) => {
          const tag = projectedById.get(item.id);
          if (!tag?.visible) return null;
          return (
            <button
              className={`bragado-map-tag ${item.status === "Activo" ? "ok" : item.status === "En mantenimiento" ? "warning" : item.status === "Inactivo" ? "danger" : ""}`}
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              style={{ left: tag.x, top: tag.y }}
              type="button"
            >
              {item.short}
            </button>
          );
        })}
      </div>
      <div className="bragado-map-toolbar">
        <select aria-label="Vista 3D" onChange={(event) => setViewMode(event.target.value as ViewMode)} value={viewMode}>
          <option value="top">Desde arriba</option>
          <option value="perspective">Perspectiva</option>
          <option value="street">Nivel suelo</option>
        </select>
        <label>
          Altura
          <input max="1.35" min="0.75" onChange={(event) => setHeightScale(Number(event.target.value))} step="0.01" type="range" value={heightScale} />
        </label>
      </div>
      <aside className="bragado-map-panel">
        <header>
          <span>{visibleEquipment.length} de {equipment.length}</span>
          <strong>Mapa 3D Bragado</strong>
        </header>
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
      </aside>
    </div>
  );
}
