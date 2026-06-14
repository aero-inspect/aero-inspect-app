import { DRONE_OPERATION_ROLES } from "../constants";

export function Sidebar({
  currentPath,
  role,
  userCanConsultAssets,
  onNavigate
}: {
  currentPath: string;
  role: string;
  userCanConsultAssets: boolean;
  onNavigate: (path: string) => void;
}) {
  const isRegisterAssetPath = currentPath === "/registro-activo";
  const isAssetsPath = currentPath === "/mis-activos";
  const isMissionPath = currentPath === "/configurar-mision";
  const isMissionsPath = currentPath === "/mis-misiones";
  const isDronePath = currentPath === "/dron";
  const isLaunchPath = currentPath === "/ejecutar-despegue";

  return (
    <aside className="sidebar">
      <nav className="nav-list" aria-label="Principal">
        <button className={!isRegisterAssetPath && !isAssetsPath && !isMissionPath ? "active" : undefined} onClick={() => onNavigate("/")} type="button">
          Inicio
        </button>

        {role === "Jefe de Planta" && (
          <button className={isRegisterAssetPath ? "active" : undefined} onClick={() => onNavigate("/registro-activo")} type="button">
            Registrar Activo
          </button>
        )}

        {userCanConsultAssets && (
          <>
            <button className={isAssetsPath ? "active" : undefined} onClick={() => onNavigate("/mis-activos")} type="button">
              Mis activos
            </button>
            <button className={isMissionsPath ? "active" : undefined} onClick={() => onNavigate("/mis-misiones")} type="button">
              Mis misiones
            </button>
          </>
        )}

        {DRONE_OPERATION_ROLES.includes(role) && (
          <>
            <button className={isDronePath ? "active" : undefined} onClick={() => onNavigate("/dron")} type="button">
              Dron
            </button>
            <button className={isLaunchPath ? "active" : undefined} onClick={() => onNavigate("/ejecutar-despegue")} type="button">
              Ejecutar despegue
            </button>
          </>
        )}

        {role === "Tecnico de Mantenimiento" && (
          <button className={isMissionPath ? "active" : undefined} onClick={() => onNavigate("/configurar-mision")} type="button">
            Configurar misión
          </button>
        )}
      </nav>
    </aside>
  );
}
