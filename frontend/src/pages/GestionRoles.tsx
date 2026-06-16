import { useState } from "react";
import { ArrowLeft, UserMinus, UserPlus, Users } from "lucide-react";
import type { MockUser } from "../types";

export function RoleManagementView({
  users,
  setUsers,
  onBack
}: {
  users: MockUser[];
  setUsers: React.Dispatch<React.SetStateAction<MockUser[]>>;
  onBack: () => void;
}) {
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "Tecnico de Mantenimiento", active: true });

  const handleCreate = () => {
    if (!form.username || !form.password || !form.name) return;
    setUsers((current) => [...current, { username: form.username, password: form.password, name: form.name, role: form.role as any, active: form.active }]);
    setForm({ username: "", password: "", name: "", role: "Tecnico de Mantenimiento", active: true });
  };

  const handleDelete = (username: string) => {
    setUsers((current) => current.filter((u) => u.username !== username));
  };

  const handleRoleChange = (username: string, role: string) => {
    setUsers((current) => current.map((u) => (u.username === username ? { ...u, role } : u)));
  };

  return (
    <section className="asset-page">
      <header className="asset-header">
        <button className="back-link" onClick={onBack} type="button">
          <ArrowLeft size={18} aria-hidden="true" />
          Volver
        </button>
        <div>
          <p className="asset-title">Gestión de usuarios</p>
          <p>Crear, editar y asignar roles a cuentas del sistema.</p>
        </div>
      </header>

      <section className="role-management-modern">
        <div className="role-card create-user-card">
          <div className="role-card-header">
            <UserPlus size={24} />
            <h3>Crear nueva cuenta</h3>
          </div>
          <div className="role-form">
            <div className="role-form-field">
              <label>Usuario</label>
              <input
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                placeholder="Ingrese nombre de usuario"
              />
            </div>
            <div className="role-form-field">
              <label>Nombre completo</label>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Ingrese nombre completo"
              />
            </div>
            <div className="role-form-field">
              <label>Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Ingrese contraseña"
              />
            </div>
            <div className="role-form-field">
              <label>Rol</label>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option>Tecnico de Mantenimiento</option>
                <option>Jefe de Planta</option>
              </select>
            </div>
            <div className="role-form-field-checkbox">
              <input
                type="checkbox"
                id="active-checkbox"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
              <label htmlFor="active-checkbox">Usuario activo</label>
            </div>
            <button className="role-create-button" onClick={handleCreate} type="button">
              <UserPlus size={18} />
              Crear cuenta
            </button>
          </div>
        </div>

        <div className="role-card users-list-card">
          <div className="role-card-header">
            <Users size={24} />
            <h3>Usuarios registrados</h3>
            <span className="user-count">{users.length} usuarios</span>
          </div>
          <div className="users-modern-table">
            {users.map((u) => (
              <div key={u.username} className="user-row">
                <div className="user-row-info">
                  <div className="user-row-main">
                    <span className="user-row-name">{u.name}</span>
                    <span className="user-row-username">@{u.username}</span>
                  </div>
                  <div className="user-row-details">
                    <select
                      className="user-role-select"
                      value={u.role}
                      onChange={(event) => handleRoleChange(u.username, event.target.value)}
                    >
                      <option>Jefe de Planta</option>
                      <option>Tecnico de Mantenimiento</option>
                    </select>
                    <span className={`user-status ${u.active ? 'active' : 'inactive'}`}>
                      {u.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </div>
                <button
                  className="user-delete-button"
                  onClick={() => handleDelete(u.username)}
                  type="button"
                  aria-label="Eliminar usuario"
                >
                  <UserMinus size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

