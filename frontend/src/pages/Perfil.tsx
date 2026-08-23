import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, ArrowRight, Camera, Edit3, HelpCircle, Lock, LogOut, Trash2, UserRound } from "lucide-react";
import type { SessionUser } from "../types";
import { AppTopActions } from "../components/AppTopActions";
import { mapBackendRole } from "../utils/auth";

type ProfileData = {
  username: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  location: string;
  role: string;
  active: boolean;
  profileImage: string;
  registeredAt: string | null;
  lastAccessAt: string | null;
};

type ProfileFormData = Pick<ProfileData, "firstName" | "lastName" | "phone" | "email" | "company" | "location" | "profileImage">;

const EMPTY_PROFILE: ProfileFormData = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  company: "",
  location: "",
  profileImage: ""
};

export function ProfileView({
  user,
  setUser,
  onViewActivity,
  onLogout
}: {
  user: SessionUser;
  setUser: Dispatch<SetStateAction<SessionUser | null>>;
  onBack: () => void;
  onAssignRoles: () => void;
  onViewActivity: () => void;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(EMPTY_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", next: "", repeat: "" });
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch("/api/v1/users/me", {
          headers: { Authorization: `Bearer ${user.token}` }
        });

        if (!response.ok) throw new Error("No se pudo cargar el perfil.");

        const data: ProfileData = await response.json();
        const normalized = normalizeProfile(data);
        if (!active) return;
        setProfile(normalized);
        setFormData(toFormData(normalized));
        setUser((current) =>
          current
            ? {
                ...current,
                username: normalized.username,
                name: normalized.fullName,
                role: mapBackendRole(normalized.role),
                profileImage: normalized.profileImage
              }
            : current
        );
      } catch {
        if (active) setError("No se pudo cargar el perfil.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [setUser, user.token]);

  const displayName = useMemo(() => {
    if (profile?.fullName) return profile.fullName;
    return `${formData.firstName} ${formData.lastName}`.trim() || user.name;
  }, [formData.firstName, formData.lastName, profile?.fullName, user.name]);

  const displayRole = mapBackendRole(profile?.role ?? user.role);

  const cancelProfileEdit = () => {
    if (profile) setFormData(toFormData(profile));
    setIsEditing(false);
    setError("");
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/v1/users/me", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error("No se pudo guardar el perfil.");

      const data: ProfileData = await response.json();
      const normalized = normalizeProfile(data);
      setProfile(normalized);
      setFormData(toFormData(normalized));
      setUser((current) =>
        current
          ? {
              ...current,
              username: normalized.username,
              name: normalized.fullName,
              role: mapBackendRole(normalized.role),
              profileImage: normalized.profileImage
            }
          : current
      );
      setIsEditing(false);
    } catch {
      setError("No se pudo guardar el perfil.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileImageChange = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Seleccioná una imagen JPG, PNG o WEBP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = Math.min(image.width, image.height);
        const sourceX = (image.width - size) / 2;
        const sourceY = (image.height - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d");

        if (!context) {
          setError("No se pudo procesar la imagen.");
          return;
        }

        context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 512, 512);
        const profileImage = canvas.toDataURL("image/jpeg", 0.86);
        setFormData((current) => ({ ...current, profileImage }));
        setError("");
      };
      image.onerror = () => setError("No se pudo leer la imagen seleccionada.");
      image.src = String(reader.result ?? "");
    };
    reader.onerror = () => setError("No se pudo leer la imagen seleccionada.");
    reader.readAsDataURL(file);
  };

  const closePasswordModal = () => {
    setPasswordData({ current: "", next: "", repeat: "" });
    setPasswordFeedback(null);
    setIsPasswordModalOpen(false);
  };

  const changePassword = async () => {
    setPasswordFeedback(null);

    if (!passwordData.current || !passwordData.next || !passwordData.repeat) {
      setPasswordFeedback({ type: "error", message: "Completá los tres campos." });
      return;
    }
    if (passwordData.next.length < 8) {
      setPasswordFeedback({ type: "error", message: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (passwordData.next !== passwordData.repeat) {
      setPasswordFeedback({ type: "error", message: "Las contraseñas nuevas no coinciden." });
      return;
    }

    setIsPasswordSaving(true);
    try {
      const response = await fetch("/api/v1/users/me/password", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword: passwordData.current,
          newPassword: passwordData.next,
          repeatPassword: passwordData.repeat
        })
      });

      if (!response.ok) {
        let message = "No se pudo cambiar la contraseña.";
        try {
          const errorBody = await response.json();
          message = errorBody.message ?? message;
        } catch {
          // Keep fallback message.
        }
        setPasswordFeedback({ type: "error", message });
        return;
      }

      setPasswordData({ current: "", next: "", repeat: "" });
      setPasswordFeedback({ type: "success", message: "Contraseña actualizada correctamente." });
    } catch {
      setPasswordFeedback({ type: "error", message: "No se pudo conectar con el servidor." });
    } finally {
      setIsPasswordSaving(false);
    }
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
            {isEditing ? (
              <div className="profile-photo-editor">
                <label className="profile-photo profile-photo-editing profile-photo-button">
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Foto de perfil" />
                  ) : (
                    <UserRound size={54} />
                  )}
                  <input accept="image/jpeg,image/png,image/webp" onChange={(event) => handleProfileImageChange(event.target.files?.[0])} type="file" />
                </label>
                <div className="profile-photo-actions">
                  <label className="profile-photo-edit-button" aria-label="Cambiar foto de perfil">
                    <Camera size={14} />
                    <input accept="image/jpeg,image/png,image/webp" onChange={(event) => handleProfileImageChange(event.target.files?.[0])} type="file" />
                  </label>
                  {formData.profileImage && (
                    <button className="profile-photo-delete-button" onClick={() => setFormData((current) => ({ ...current, profileImage: "" }))} type="button" aria-label="Borrar foto de perfil">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="profile-photo">
                {profile?.profileImage ? (
                  <img src={profile.profileImage} alt="Foto de perfil" />
                ) : (
                  <UserRound size={54} />
                )}
              </div>
            )}
            <div className="profile-identity-copy">
              <h2>{displayName}</h2>
              <p>{displayRole}</p>
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

            {isLoading ? (
              <p className="profile-status-text">Cargando perfil...</p>
            ) : (
              <>
                {error && <p className="profile-error-text">{error}</p>}
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
                    <button className="profile-edit-save-button" disabled={isSaving} onClick={saveProfile} type="button">
                      <Edit3 size={20} />
                      {isSaving ? "Guardando" : "Guardar datos"}
                    </button>
                  </div>
                )}
              </>
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
            <ProfileInfoRow boxed={isEditing} label="Usuario" value={profile?.username ?? user.username} />
            <ProfileInfoRow label="Fecha de registro" value={formatDate(profile?.registeredAt)} />
            <ProfileInfoRow label="Último acceso" value={formatDateTime(profile?.lastAccessAt)} />
            <ProfileInfoRow label="Estado de la cuenta" value={profile?.active ? "Activa" : "Inactiva"} highlight />
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
                <span>Contraseña actual</span>
                <input onChange={(event) => setPasswordData((current) => ({ ...current, current: event.target.value }))} placeholder="••••••••" type="password" value={passwordData.current} />
              </label>
              <label>
                <span>Nueva contraseña</span>
                <input onChange={(event) => setPasswordData((current) => ({ ...current, next: event.target.value }))} placeholder="••••••••" type="password" value={passwordData.next} />
              </label>
              <label>
                <span>Repetir contraseña</span>
                <input onChange={(event) => setPasswordData((current) => ({ ...current, repeat: event.target.value }))} placeholder="••••••••" type="password" value={passwordData.repeat} />
              </label>
            </div>
            {passwordFeedback && (
              <p className={passwordFeedback.type === "success" ? "profile-password-success" : "profile-password-error"}>
                {passwordFeedback.message}
              </p>
            )}
            <div className="profile-modal-actions">
              <button className="profile-modal-secondary" onClick={closePasswordModal} type="button">
                Cancelar
              </button>
              <button className="profile-modal-primary" disabled={isPasswordSaving} onClick={changePassword} type="button">
                {isPasswordSaving ? "Guardando" : "Continuar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function normalizeProfile(profile: ProfileData): ProfileData {
  return {
    ...profile,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    company: profile.company ?? "",
    location: profile.location ?? "",
    profileImage: profile.profileImage ?? ""
  };
}

function toFormData(profile: ProfileData): ProfileFormData {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    company: profile.company ?? "",
    location: profile.location ?? "",
    profileImage: profile.profileImage ?? ""
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR").format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
