import { useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, ArrowRight, Edit3, HelpCircle, Lock, LogOut, UserRound } from "lucide-react";
import type { MockUser, SessionUser } from "../types";
import { AppTopActions } from "../components/AppTopActions";

export function ProfileView({
  users,
  setUsers,
  onViewActivity,
  onLogout
}: {
  user: SessionUser;
  users: MockUser[];
  setUsers: Dispatch<SetStateAction<MockUser[]>>;
  onBack: () => void;
  onAssignRoles: () => void;
  onViewActivity: () => void;
  onLogout: () => void;
}) {
  const userEntry = users.find((item) => item.username === "tecnico") ?? users[0] ?? null;
  const initialData = {
    firstName: userEntry?.firstName || "Emilia",
    lastName: userEntry?.lastName || "Andersen",
    phone: userEntry?.phone || "+54 11 1234 5678",
    email: userEntry?.email || "emilia.andersen@planta.com",
    company: userEntry?.company || "Agroindustrial del Norte S.A.",
    location: userEntry?.location || "Planta Principal - Sector Norte"
  };
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(initialData);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", next: "", repeat: "" });

  const displayName = "María Emilia Andersen";

  const cancelProfileEdit = () => {
    setFormData(initialData);
    setIsEditing(false);
  };

  const saveProfile = () => {
    if (userEntry) {
      setUsers((current) =>
        current.map((item) =>
          item.username === userEntry.username
            ? { ...item, ...formData }
            : item
        )
      );
    }
    setIsEditing(false);
  };

  const closePasswordModal = () => {
    setPasswordData({ current: "", next: "", repeat: "" });
    setIsPasswordModalOpen(false);
  };

  const goToHelp = () => {
    window.history.pushState({}, "", "/centro-ayuda");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <section className={isEditing ? "profile-dashboard profile-dashboard-editing" : "profile-dashboard"}>
      <header className="profile-topbar">
        <div>
          <h1>Mi Perfil</h1>
          <p>Gestiona tus datos personales y seguridad</p>
        </div>
        <AppTopActions />
      </header>

      <div className="profile-layout">
        <main className="profile-main-column profile-main-column-no-role">
          <section className="profile-identity-card" aria-label="Perfil de usuario">
            <div className={isEditing ? "profile-photo profile-photo-editing" : "profile-photo"}>
              {isEditing ? (
                <>
                  <Edit3 size={32} />
                  <span>JPG, PNG o WEBP.<br />Tamaño máximo:<br />2MB</span>
                </>
              ) : (
                <UserRound size={54} />
              )}
            </div>
            <div className="profile-identity-copy">
              <h2>{displayName}</h2>
              <p>Técnico de Mantenimiento</p>
            </div>
          </section>

          <section className="profile-personal-card">
            <div className="profile-card-heading">
              <h2>Información personal</h2>
              {!isEditing && (
                <button className="profile-edit-button" onClick={() => setIsEditing(true)} type="button">
                  <Edit3 size={14} />
                  Editar datos
                </button>
              )}
            </div>

            <div className="profile-form-grid">
              <ProfileField disabled={!isEditing} label="Nombre" onChange={(value) => setFormData((current) => ({ ...current, firstName: value }))} value={formData.firstName} />
              <ProfileField disabled={!isEditing} label="Apellido" onChange={(value) => setFormData((current) => ({ ...current, lastName: value }))} value={formData.lastName} />
              <ProfileField disabled={!isEditing} label="Teléfono" onChange={(value) => setFormData((current) => ({ ...current, phone: value }))} value={formData.phone} />
              <ProfileField disabled={!isEditing} label="Email" onChange={(value) => setFormData((current) => ({ ...current, email: value }))} value={formData.email} />
              <ProfileField disabled={!isEditing} label="Empresa" onChange={(value) => setFormData((current) => ({ ...current, company: value }))} value={formData.company} />
              <ProfileField disabled={!isEditing} label="Ubicación" onChange={(value) => setFormData((current) => ({ ...current, location: value }))} value={formData.location} />
            </div>

            {isEditing && (
              <div className="profile-edit-actions">
                <button className="profile-edit-cancel-button" onClick={cancelProfileEdit} type="button">
                  Cancelar
                </button>
                <button className="profile-edit-save-button" onClick={saveProfile} type="button">
                  <Edit3 size={20} />
                  Guardar datos
                </button>
              </div>
            )}
          </section>

          {!isEditing && (
            <>
              <section className="profile-action-card profile-security-card">
                <div className="profile-action-icon profile-security-icon">
                  <Lock size={28} />
                </div>
                <div className="profile-action-copy">
                  <h2>Seguridad de la cuenta</h2>
                  <p>Mantén tu información actualizada para asegurar el acceso a la plataforma.</p>
                </div>
                <button className="profile-password-button" onClick={() => setIsPasswordModalOpen(true)} type="button">
                  Cambiar contraseña
                </button>
              </section>

              <section className="profile-action-card profile-logout-card">
                <div className="profile-action-icon profile-logout-icon">
                  <LogOut size={29} />
                </div>
                <div className="profile-action-copy">
                  <h2>Cerrar sesión</h2>
                  <p>¿Deseas cerrar tu sesión actual en la plataforma?</p>
                </div>
                <button className="profile-logout-button" onClick={onLogout} type="button">
                  Cerrar sesión
                </button>
              </section>
            </>
          )}
        </main>

        <aside className="profile-side-column">
          <section className="profile-side-card profile-account-card">
            <h2>Información de la cuenta</h2>
            <ProfileInfoRow boxed={isEditing} label="Usuario" value="emilia.andersen" />
            <ProfileInfoRow label="Fecha de registro" value="12/03/2025" />
            <ProfileInfoRow label="Último acceso" value="Hoy, 08:42" />
            <ProfileInfoRow label="Estado de la cuenta" value="Activa" highlight />
            {!isEditing && (
              <button className="profile-delete-account-button" onClick={() => setIsDeleteModalOpen(true)} type="button">
                Eliminar cuenta
              </button>
            )}
          </section>

          <section className="profile-side-card profile-activity-card">
            <h2>Actividad reciente</h2>
            <ProfileActivity title="Misión completada" detail="Inspección Silo Norte" time="Hoy, 08:15" />
            <ProfileActivity title="Hallazgo validado" detail="Corrosión en unión" time="Ayer, 16:30" />
            <ProfileActivity title="Reporte generado" detail="Reporte mensual - Mayo" time="Ayer, 10:45" />
            <button className="profile-activity-link" onClick={onViewActivity} type="button">
              Ver toda la actividad
              <ArrowRight size={13} />
            </button>
          </section>

          <button className="profile-help-button" onClick={goToHelp} type="button">
            <HelpCircle size={22} />
            Centro de ayuda
          </button>
        </aside>
      </div>

      {isDeleteModalOpen && (
        <div className="modal-backdrop profile-delete-modal-backdrop" role="presentation">
          <section aria-modal="true" className="profile-delete-modal" role="dialog">
            <div className="profile-delete-modal-icon">
              <AlertCircle size={31} aria-hidden="true" />
            </div>
            <h2>Eliminar cuenta</h2>
            <p>¿Está seguro de que desea eliminar su cuenta?<br />Esta acción no se puede deshacer.</p>
            <div className="profile-delete-modal-actions">
              <button className="profile-delete-modal-secondary" onClick={() => setIsDeleteModalOpen(false)} type="button">
                Cancelar
              </button>
              <button className="profile-delete-modal-primary" onClick={() => setIsDeleteModalOpen(false)} type="button">
                Eliminar
              </button>
            </div>
          </section>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="modal-backdrop profile-modal-backdrop" role="presentation">
          <section aria-modal="true" className="profile-modal" role="dialog">
            <div className="profile-modal-icon">
              <Lock size={24} aria-hidden="true" />
            </div>
            <h2>Cambiar contraseña</h2>
            <p>Actualiza tu contraseña de acceso. Debe tener al menos 8 caracteres.</p>
            <div className="profile-modal-fields">
              <label>
                <span>Repetir contraseña</span>
                <input onChange={(event) => setPasswordData((current) => ({ ...current, repeat: event.target.value }))} placeholder="••••••••" type="password" value={passwordData.repeat} />
              </label>
              <label>
                <span>Nueva contraseña</span>
                <input onChange={(event) => setPasswordData((current) => ({ ...current, next: event.target.value }))} placeholder="••••••••" type="password" value={passwordData.next} />
              </label>
              <label>
                <span>Contraseña actual</span>
                <input onChange={(event) => setPasswordData((current) => ({ ...current, current: event.target.value }))} placeholder="••••••••" type="password" value={passwordData.current} />
              </label>
            </div>
            <div className="profile-modal-actions">
              <button className="profile-modal-secondary" onClick={closePasswordModal} type="button">
                Cancelar
              </button>
              <button className="profile-modal-primary" onClick={closePasswordModal} type="button">
                Continuar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function ProfileField({
  disabled,
  label,
  onChange,
  value
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="profile-modern-field">
      <span>{label}</span>
      <input disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function ProfileInfoRow({ boxed, highlight, label, value }: { boxed?: boolean; highlight?: boolean; label: string; value: string }) {
  return (
    <div className={boxed ? "profile-info-row profile-info-row-boxed" : "profile-info-row"}>
      <span>{label}</span>
      <strong className={highlight ? "profile-info-highlight" : undefined}>{value}</strong>
    </div>
  );
}

function ProfileActivity({ detail, time, title }: { detail: string; time: string; title: string }) {
  return (
    <div className="profile-activity-row">
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <span>{time}</span>
    </div>
  );
}

