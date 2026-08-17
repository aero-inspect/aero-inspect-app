import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import { createDrone, deleteDrone, getDrones, updateDrone } from "../api/client";
import type { BackendDrone } from "../api/types";
import { AppTopActions } from "../components/AppTopActions";

type DroneFormState = {
  droneId: string;
  name: string;
  model: string;
  serialNumber: string;
};

const EMPTY_FORM: DroneFormState = { droneId: "", name: "", model: "", serialNumber: "" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

export function DronesAbmView() {
  const [drones, setDrones] = useState<BackendDrone[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<DroneFormState>(EMPTY_FORM);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingDrone, setEditingDrone] = useState<BackendDrone | null>(null);
  const [editForm, setEditForm] = useState<DroneFormState>(EMPTY_FORM);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingDrone, setDeletingDrone] = useState<BackendDrone | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadDrones = () => {
    setLoadError(null);
    getDrones()
      .then(setDrones)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los drones."));
  };

  useEffect(() => {
    loadDrones();
  }, []);

  const openCreateModal = () => {
    setCreateForm(EMPTY_FORM);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (drone: BackendDrone) => {
    setEditForm({
      droneId: drone.droneId,
      name: drone.name,
      model: drone.model ?? "",
      serialNumber: drone.serialNumber ?? ""
    });
    setEditError(null);
    setEditingDrone(drone);
  };

  const handleCreate = async () => {
    if (!createForm.droneId.trim() || !createForm.name.trim()) {
      setCreateError("El ID del dron y el nombre son obligatorios.");
      return;
    }

    setIsSavingCreate(true);
    setCreateError(null);
    try {
      await createDrone({
        droneId: createForm.droneId.trim(),
        name: createForm.name.trim(),
        model: createForm.model.trim() || null,
        serialNumber: createForm.serialNumber.trim() || null
      });
      setIsCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      loadDrones();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "No se pudo crear el dron.");
    } finally {
      setIsSavingCreate(false);
    }
  };

  const handleEdit = async () => {
    if (!editingDrone) return;
    if (!editForm.droneId.trim() || !editForm.name.trim()) {
      setEditError("El ID del dron y el nombre son obligatorios.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      await updateDrone(editingDrone.idDrone, {
        droneId: editForm.droneId.trim(),
        name: editForm.name.trim(),
        model: editForm.model.trim() || null,
        serialNumber: editForm.serialNumber.trim() || null
      });
      setEditingDrone(null);
      loadDrones();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "No se pudo editar el dron.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDrone) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDrone(deletingDrone.idDrone);
      setDeletingDrone(null);
      loadDrones();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar el dron.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="drones-abm-dashboard">
      <header className="drones-abm-header">
        <div>
          <h1>Gestión de Drones</h1>
          <p>Alta, edición y baja de los drones de la flota.</p>
        </div>
        <AppTopActions />
      </header>

      <div className="drones-abm-actions">
        <button className="drones-abm-new-button" onClick={openCreateModal} type="button">
          <Plus size={16} aria-hidden="true" />
          Nuevo dron
        </button>
      </div>

      {loadError && <p className="drones-abm-error">{loadError}</p>}

      <section className="drones-abm-table-card">
        <div className="drones-abm-table-wrap">
          {drones === null && !loadError && <p className="drones-abm-empty">Cargando drones...</p>}
          {drones !== null && drones.length === 0 && (
            <p className="drones-abm-empty">No hay drones registrados todavia. Empeza por crear uno desde &quot;Nuevo dron&quot;.</p>
          )}
          {drones !== null && drones.length > 0 && (
            <table className="drones-abm-table">
              <thead>
                <tr>
                  <th>Drone ID</th>
                  <th>Nombre</th>
                  <th>Modelo</th>
                  <th>N&deg; de serie</th>
                  <th>Fecha de alta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {drones.map((drone) => (
                  <tr key={drone.idDrone}>
                    <td>{drone.droneId}</td>
                    <td>{drone.name}</td>
                    <td>{drone.model || "-"}</td>
                    <td>{drone.serialNumber || "-"}</td>
                    <td>{formatDate(drone.createdAt)}</td>
                    <td className="drones-abm-row-actions">
                      <button aria-label={`Editar ${drone.name}`} onClick={() => openEditModal(drone)} type="button">
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        aria-label={`Eliminar ${drone.name}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingDrone(drone);
                        }}
                        type="button"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {isCreateOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="drones-abm-modal" role="dialog">
            <header className="drones-abm-modal-header">
              <h2>Nuevo dron</h2>
              <button aria-label="Cerrar creacion" className="drones-abm-modal-close" onClick={() => setIsCreateOpen(false)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="drones-abm-modal-body">
              <label className="drones-abm-field">
                <span>ID del dron *</span>
                <input onChange={(event) => setCreateForm((current) => ({ ...current, droneId: event.target.value }))} value={createForm.droneId} />
              </label>
              <label className="drones-abm-field">
                <span>Nombre *</span>
                <input onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} value={createForm.name} />
              </label>
              <label className="drones-abm-field">
                <span>Modelo</span>
                <input onChange={(event) => setCreateForm((current) => ({ ...current, model: event.target.value }))} value={createForm.model} />
              </label>
              <label className="drones-abm-field">
                <span>N&deg; de serie</span>
                <input onChange={(event) => setCreateForm((current) => ({ ...current, serialNumber: event.target.value }))} value={createForm.serialNumber} />
              </label>
            </div>

            <footer className="drones-abm-modal-footer">
              <button className="drones-abm-cancel" onClick={() => setIsCreateOpen(false)} type="button">
                Cancelar
              </button>
              {createError && <p className="drones-abm-error">{createError}</p>}
              <button className="drones-abm-save" disabled={isSavingCreate} onClick={handleCreate} type="button">
                {isSavingCreate ? "Guardando..." : "Guardar"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {editingDrone && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="drones-abm-modal" role="dialog">
            <header className="drones-abm-modal-header">
              <h2>Editar dron</h2>
              <button aria-label="Cerrar edicion" className="drones-abm-modal-close" onClick={() => setEditingDrone(null)} type="button">
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="drones-abm-modal-body">
              <label className="drones-abm-field">
                <span>ID del dron *</span>
                <input onChange={(event) => setEditForm((current) => ({ ...current, droneId: event.target.value }))} value={editForm.droneId} />
              </label>
              <label className="drones-abm-field">
                <span>Nombre *</span>
                <input onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} value={editForm.name} />
              </label>
              <label className="drones-abm-field">
                <span>Modelo</span>
                <input onChange={(event) => setEditForm((current) => ({ ...current, model: event.target.value }))} value={editForm.model} />
              </label>
              <label className="drones-abm-field">
                <span>N&deg; de serie</span>
                <input onChange={(event) => setEditForm((current) => ({ ...current, serialNumber: event.target.value }))} value={editForm.serialNumber} />
              </label>
            </div>

            <footer className="drones-abm-modal-footer">
              <button className="drones-abm-cancel" onClick={() => setEditingDrone(null)} type="button">
                Cancelar
              </button>
              {editError && <p className="drones-abm-error">{editError}</p>}
              <button className="drones-abm-save" disabled={isSavingEdit} onClick={handleEdit} type="button">
                {isSavingEdit ? "Guardando..." : "Guardar"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {deletingDrone && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="drones-abm-delete-modal" role="dialog">
            <span className="drones-abm-delete-icon" aria-hidden="true">
              <AlertTriangle size={31} />
            </span>
            <h2>Eliminar dron</h2>
            <p>
              ¿Esta seguro de que desea eliminar {deletingDrone.droneId}?<br />
              Esta accion no se puede deshacer.
            </p>
            {deleteError && <p className="drones-abm-error">{deleteError}</p>}
            <div className="drones-abm-delete-actions">
              <button className="drones-abm-cancel" onClick={() => setDeletingDrone(null)} type="button">
                Cancelar
              </button>
              <button className="drones-abm-delete-confirm" disabled={isDeleting} onClick={handleDelete} type="button">
                {isDeleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
