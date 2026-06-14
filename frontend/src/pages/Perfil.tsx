import { useState, type ChangeEvent, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Clock3,
  Edit3,
  FileUp,
  Lock,
  LogOut,
  MapPin,
  Pencil,
  Shield,
  User,
  UserRound
} from "lucide-react";
import type { MockUser, SessionUser } from "../types";
import { AppTopActions } from "../components/AppTopActions";

export function ProfileView({
  users,
  setUsers,
  onLogout
}: {
  user: SessionUser;
  users: MockUser[];
  setUsers: Dispatch<SetStateAction<MockUser[]>>;
  onBack: () => void;
  onAssignRoles: () => void;
  onLogout: () => void;
}) {
  const userEntry = users.find((item) => item.name === "Emilia Andersen") ?? users[0] ?? null;
  const firstName = userEntry?.firstName || "Emilia";
  const lastName = userEntry?.lastName || "Andersen";
  const phone = userEntry?.phone || "+54 11 1234 5678";
  const email = userEntry?.email || "emilia.andersen@planta.com";
  const company = userEntry?.company || "Agroindustrial del Norte S.A.";
  const location = userEntry?.location || "Planta Principal - Sector Norte";
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState(userEntry?.profileImage ?? "");
  const [formData, setFormData] = useState({ firstName, lastName, phone, email, company, location });

  const handleProfileImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setProfileImage(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const saveProfile = () => {
    if (userEntry) {
      setUsers((current) =>
        current.map((item) =>
          item.username === userEntry.username
            ? { ...item, ...formData, profileImage }
            : item
        )
      );
    }
    setIsEditing(false);
  };

  const displayName = `${formData.firstName} ${formData.lastName}`.trim();

  return (
    <section className="profile-dashboard">
      <header className="profile-topbar">
        <div>
          <h1>Mi perfil</h1>
        </div>

        <AppTopActions />
      </header>

      <div className="profile-layout">
        <main className="profile-main-column profile-main-column-no-role">
          <section className="profile-card-modern profile-personal-card">
            <div className="profile-card-heading">
              <h2>Información personal</h2>
              <button className="profile-outline-button" onClick={isEditing ? saveProfile : () => setIsEditing(true)} type="button">
                <Edit3 size={16} />
                {isEditing ? "Guardar perfil" : "Editar perfil"}
              </button>
            </div>

            <div className="profile-personal-grid">
              <div className="profile-photo-block">
                <div className="profile-photo">
                  {profileImage ? <img alt={displayName} src={profileImage} /> : <UserRound size={72} />}
                  <label className="profile-photo-edit">
                    <Pencil size={16} />
                    <input accept="image/*" hidden onChange={handleProfileImageChange} type="file" />
                  </label>
                </div>
                <label className="profile-photo-button">
                  <Camera size={16} />
                  Cambiar foto
                  <input accept="image/*" hidden onChange={handleProfileImageChange} type="file" />
                </label>
                <p>JPG, PNG o WEBP.<br />Tamaño máximo: 2MB</p>
              </div>

              <div className="profile-form-grid">
                <ProfileField disabled={!isEditing} label="Nombre" onChange={(value) => setFormData((current) => ({ ...current, firstName: value }))} value={formData.firstName} />
                <ProfileField disabled={!isEditing} label="Apellido" onChange={(value) => setFormData((current) => ({ ...current, lastName: value }))} value={formData.lastName} />
                <ProfileField disabled={!isEditing} label="Teléfono" onChange={(value) => setFormData((current) => ({ ...current, phone: value }))} value={formData.phone} />
                <ProfileField disabled={!isEditing} label="Email" onChange={(value) => setFormData((current) => ({ ...current, email: value }))} value={formData.email} />
                <ProfileField disabled={!isEditing} label="Empresa" onChange={(value) => setFormData((current) => ({ ...current, company: value }))} value={formData.company} />
                <ProfileField disabled={!isEditing} label="Ubicación" onChange={(value) => setFormData((current) => ({ ...current, location: value }))} value={formData.location} />
              </div>
            </div>
          </section>

          <section className="profile-card-modern profile-security-card">
            <div className="profile-security-icon">
              <Shield size={24} />
            </div>
            <div>
              <h3>Seguridad de la cuenta</h3>
              <p>Mantén tu información actualizada para asegurar el acceso a la plataforma.</p>
            </div>
            <button className="profile-outline-button" type="button">
              <Lock size={16} />
              Cambiar contraseña
            </button>
          </section>

          <section className="profile-card-modern profile-logout-card">
            <div>
              <h2>Cerrar sesión</h2>
              <p>¿Deseas cerrar tu sesión actual en la plataforma?</p>
            </div>
            <button className="profile-danger-button" onClick={onLogout} type="button">
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </section>

          <section className="profile-card-modern profile-delete-card">
            <div>
              <h2>Eliminar cuenta</h2>
              <p>Esta acción desactivará el acceso del usuario a la plataforma.</p>
            </div>
            <button className="profile-delete-button" type="button">
              Eliminar cuenta
            </button>
          </section>
        </main>

        <aside className="profile-side-column">
          <section className="profile-card-modern profile-account-card">
            <h2>Información de la cuenta</h2>
            <ProfileInfoRow icon={<User size={17} />} label="Usuario" value="emilia.andersen" />
            <ProfileInfoRow icon={<CalendarDays size={17} />} label="Fecha de registro" value="12/03/2025" />
            <ProfileInfoRow icon={<Clock3 size={17} />} label="Último acceso" value="Hoy, 08:42" />
            <ProfileInfoRow icon={<MapPin size={17} />} label="Estado de la cuenta" value="Activa" badge />
          </section>

          <section className="profile-card-modern profile-activity-card">
            <h2>Actividad reciente</h2>
            <ProfileActivity icon={<ClipboardCheck size={20} />} title="Misión completada" detail="Inspección Silo Norte" time="Hoy, 08:15" tone="green" />
            <ProfileActivity icon={<Shield size={20} />} title="Hallazgo validado" detail="Corrosión en unión" time="Ayer, 16:30" tone="yellow" />
            <ProfileActivity icon={<FileUp size={20} />} title="Reporte generado" detail="Reporte mensual - Mayo" time="Ayer, 10:45" tone="green" />
            <ProfileActivity icon={<BriefcaseBusiness size={20} />} title="Misión creada" detail="Noria Principal" time="27/05/2026" tone="purple" />
            <button className="profile-activity-link" type="button">
              Ver toda la actividad
              <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>
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

function ProfileInfoRow({ badge, icon, label, value }: { badge?: boolean; icon: ReactNode; label: string; value: string }) {
  return (
    <div className="profile-info-row">
      {icon}
      <span>{label}</span>
      {badge ? <strong className="profile-account-badge">{value}</strong> : <strong>{value}</strong>}
    </div>
  );
}

function ProfileActivity({ detail, icon, time, title, tone }: { detail: string; icon: ReactNode; time: string; title: string; tone: "green" | "purple" | "yellow" }) {
  return (
    <div className="profile-activity-row">
      <div className={`profile-activity-icon ${tone}`}>{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      <span>{time}</span>
    </div>
  );
}
