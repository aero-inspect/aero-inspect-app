import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import type { SessionUser } from "../types";
import { AppTopActions } from "../components/AppTopActions";

type ManagedUser = {
  username: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  role: "TECNICO_MANTENIMIENTO" | "JEFE_PLANTA";
  plant: string | null;
  profileImage: string | null;
  active: boolean;
};

const ROLE_OPTIONS = [
  { value: "TECNICO_MANTENIMIENTO", label: "Técnico de Mantenimiento" },
  { value: "JEFE_PLANTA", label: "Jefe de Planta" }
];

const PLANT_OPTIONS = ["Planta de Bragado", "Planta de Trili"];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  username: "",
  password: "",
  role: "TECNICO_MANTENIMIENTO",
  plant: PLANT_OPTIONS[0]
};

export function RoleManagementView({ user }: { user: SessionUser; onBack: () => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [plantFilter, setPlantFilter] = useState("Todas las plantas");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, [user.token, user.username]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((item) => {
      const matchesPlant = plantFilter === "Todas las plantas" || item.plant === plantFilter;
      const matchesQuery =
        !normalizedQuery ||
        item.fullName.toLowerCase().includes(normalizedQuery) ||
        item.username.toLowerCase().includes(normalizedQuery);
      return matchesPlant && matchesQuery;
    });
  }, [plantFilter, query, users]);

  async function loadUsers() {
    setIsLoading(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/v1/users", {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!response.ok) throw new Error("No se pudo cargar el personal.");
      setUsers(await response.json());
    } catch {
      setFeedback({ type: "error", message: "No se pudo cargar el personal." });
    } finally {
      setIsLoading(false);
    }
  }

  async function createUser() {
    setFeedback(null);
    if (!form.firstName || !form.lastName || !form.username || !form.password) {
      setFeedback({ type: "error", message: "Completá nombre, apellido, usuario y contraseña." });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/v1/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      if (!response.ok) throw new Error(await readError(response));
      const created = await response.json();
      setUsers((current) => [...current, created].sort((a, b) => a.fullName.localeCompare(b.fullName)));
      setForm(EMPTY_FORM);
      setFeedback({ type: "success", message: "Usuario creado correctamente." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo crear el usuario." });
    } finally {
      setIsSaving(false);
    }
  }

  async function updateUser(username: string, patch: Partial<Pick<ManagedUser, "role" | "plant" | "active">>) {
    const current = users.find((item) => item.username === username);
    if (!current) return;
    const next = { role: current.role, plant: current.plant ?? PLANT_OPTIONS[0], active: current.active, ...patch };

    setUsers((items) => items.map((item) => (item.username === username ? { ...item, ...next } : item)));
    try {
      const response = await fetch(`/api/v1/users/${username}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(next)
      });
      if (!response.ok) throw new Error(await readError(response));
      const saved = await response.json();
      setUsers((items) => items.map((item) => (item.username === username ? saved : item)));
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo actualizar el usuario." });
      loadUsers();
    }
  }

  async function deleteUser(username: string) {
    setFeedback(null);
    try {
      const response = await fetch(`/api/v1/users/${username}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!response.ok) throw new Error(await readError(response));
      setUsers((current) => current.filter((item) => item.username !== username));
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo eliminar el usuario." });
    }
  }

  return (
    <section className="personnel-page">
      <header className="personnel-topbar">
        <div>
          <h1>Gestión de Personal</h1>
          <p>Creá y administrá los usuarios de tus plantas</p>
        </div>
        <AppTopActions />
      </header>

      <div className="personnel-layout">
        <section className="personnel-create-card">
          <header>
            <h2>Crear nuevo usuario</h2>
            <p>Alta de jefes de planta y técnicos de mantenimiento</p>
          </header>

          <div className="personnel-form-grid">
            <PersonnelField label="Nombre" value={form.firstName} onChange={(value) => setForm((current) => ({ ...current, firstName: value }))} />
            <PersonnelField label="Apellido" value={form.lastName} onChange={(value) => setForm((current) => ({ ...current, lastName: value }))} />
            <PersonnelField label="Usuario" value={form.username} onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
            <PersonnelField label="Contraseña" type="password" value={form.password} onChange={(value) => setForm((current) => ({ ...current, password: value }))} />
          </div>

          <label className="personnel-select-field">
            <span>Rol</span>
            <PersonnelDropdown
              id="create-role"
              isOpen={openSelect === "create-role"}
              onOpenChange={setOpenSelect}
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={(value) => setForm((current) => ({ ...current, role: value }))}
            />
          </label>

          <label className="personnel-select-field">
            <span>Planta</span>
            <PersonnelDropdown
              id="create-plant"
              isOpen={openSelect === "create-plant"}
              onOpenChange={setOpenSelect}
              options={PLANT_OPTIONS.map((plant) => ({ value: plant, label: plant }))}
              value={form.plant}
              onChange={(value) => setForm((current) => ({ ...current, plant: value }))}
            />
          </label>

          {feedback && <p className={feedback.type === "success" ? "personnel-feedback success" : "personnel-feedback error"}>{feedback.message}</p>}

          <button className="personnel-create-button" disabled={isSaving} onClick={createUser} type="button">
            <Plus size={16} />
            {isSaving ? "Creando usuario" : "Crear usuario"}
          </button>
        </section>

        <section className="personnel-table-card">
          <header>
            <div>
              <h2>Empleados por planta</h2>
              <p>{users.length} usuarios registrados</p>
            </div>
          </header>

          <div className="personnel-table-toolbar">
            <PersonnelDropdown
              id="filter-plant"
              isOpen={openSelect === "filter-plant"}
              onOpenChange={setOpenSelect}
              options={[{ value: "Todas las plantas", label: "Todas las plantas" }, ...PLANT_OPTIONS.map((plant) => ({ value: plant, label: plant }))]}
              value={plantFilter}
              onChange={setPlantFilter}
            />
            <label>
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar empleado..." />
            </label>
          </div>

          {feedback?.type === "error" && <p className="personnel-feedback error">{feedback.message}</p>}

          <div className="personnel-table-wrap">
            <table className="personnel-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Planta</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6}>Cargando personal...</td></tr>
                ) : filteredUsers.length ? (
                  filteredUsers.map((item) => (
                    <tr key={item.username}>
                      <td>
                        <div className="personnel-user-cell">
                          <span className={item.profileImage ? "has-image" : undefined}>
                            {item.profileImage ? <img src={item.profileImage} alt="" /> : null}
                          </span>
                          <strong>{item.fullName}</strong>
                        </div>
                      </td>
                      <td>{item.username}</td>
                      <td>
                        <PersonnelDropdown
                          compact
                          id={`role-${item.username}`}
                          isOpen={openSelect === `role-${item.username}`}
                          onOpenChange={setOpenSelect}
                          options={ROLE_OPTIONS}
                          value={item.role}
                          onChange={(value) => updateUser(item.username, { role: value as ManagedUser["role"] })}
                        />
                      </td>
                      <td>
                        <PersonnelDropdown
                          compact
                          id={`plant-${item.username}`}
                          isOpen={openSelect === `plant-${item.username}`}
                          onOpenChange={setOpenSelect}
                          options={PLANT_OPTIONS.map((plant) => ({ value: plant, label: plant }))}
                          value={item.plant ?? PLANT_OPTIONS[0]}
                          onChange={(value) => updateUser(item.username, { plant: value })}
                        />
                      </td>
                      <td>
                        <button className={item.active ? "personnel-status active" : "personnel-status inactive"} onClick={() => updateUser(item.username, { active: !item.active })} type="button">
                          {item.active ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td>
                        <button className="personnel-delete-button" onClick={() => deleteUser(item.username)} type="button" aria-label="Eliminar usuario">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6}>No hay usuarios para mostrar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

function PersonnelField({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="personnel-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} />
    </label>
  );
}

function PersonnelDropdown({
  compact,
  id,
  isOpen,
  onChange,
  onOpenChange,
  options,
  value
}: {
  compact?: boolean;
  id: string;
  isOpen: boolean;
  onChange: (value: string) => void;
  onOpenChange: (id: string | null) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];

  const classes = [
    "assets-filter-select",
    "personnel-dropdown",
    compact ? "compact" : "",
    selected ? "selected" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <button onClick={() => onOpenChange(isOpen ? null : id)} type="button">
        {selected.label}
      </button>
      <ChevronDown size={14} aria-hidden="true" />
      {isOpen && (
        <div className="assets-filter-menu personnel-dropdown-menu">
          {options.map((option) => (
            <button
              className={option.value === value ? "selected" : undefined}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                onOpenChange(null);
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return body.message ?? "No se pudo completar la operación.";
  } catch {
    return "No se pudo completar la operación.";
  }
}
