import { useState } from "react";
import { Package, AlertTriangle, CheckCircle, Clock, ArrowRight, TrendingUp, Activity } from "lucide-react";
import type { Asset, Plant, InspectionMission, Anomaly } from "../types";
import { MOCK_ANOMALIES } from "../data/mockAnomalies";

export function JefePlantaView({
  assets,
  missions,
  onRegisterAsset,
  onViewAnomalies,
  plant
}: {
  assets: Asset[];
  missions: InspectionMission[];
  onRegisterAsset: () => void;
  onViewAnomalies?: () => void;
  plant: Plant;
}) {
  const [anomalies] = useState<Anomaly[]>(MOCK_ANOMALIES);

  // Statistics
  const totalAssets = assets.filter((a) => a.plantId === plant.id).length;
  const totalMissions = missions.length;
  const completedMissions = missions.filter((m) => m.status === "Finalizada").length;
  const pendingMissions = missions.filter((m) => m.status === "Pendiente").length;
  
  // Anomalies stats
  const totalAnomalies = anomalies.length;
  const highSeverity = anomalies.filter((a) => a.severity === "Alta").length;
  const mediumSeverity = anomalies.filter((a) => a.severity === "Media").length;
  const pendingAnomalies = anomalies.filter((a) => a.status === "Pendiente").length;
  const validatedAnomalies = anomalies.filter((a) => a.status === "Validada").length;

  // Recent anomalies (without images)
  const recentAnomalies = anomalies.slice(0, 5);

  return (
    <section className="jefe-dashboard-clean">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Dashboard del Jefe de Planta</p>
          <h1>{plant.name}</h1>
          <p className="dashboard-subtitle">{plant.province}</p>
        </div>
      </header>

      {/* Main Stats Grid - 4 columns */}
      <div className="stats-grid-clean">
        <div className="stat-card-clean primary">
          <div className="stat-icon-clean">
            <Package size={24} />
          </div>
          <div className="stat-content-clean">
            <span className="stat-label-clean">Activos</span>
            <strong className="stat-value-clean">{totalAssets}</strong>
          </div>
        </div>

        <div className="stat-card-clean success">
          <div className="stat-icon-clean">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content-clean">
            <span className="stat-label-clean">Misiones Completadas</span>
            <strong className="stat-value-clean">{completedMissions}/{totalMissions}</strong>
          </div>
        </div>

        <div className="stat-card-clean warning">
          <div className="stat-icon-clean">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content-clean">
            <span className="stat-label-clean">Anomalías Totales</span>
            <strong className="stat-value-clean">{totalAnomalies}</strong>
          </div>
        </div>

        <div className="stat-card-clean info">
          <div className="stat-icon-clean">
            <Clock size={24} />
          </div>
          <div className="stat-content-clean">
            <span className="stat-label-clean">Pendientes</span>
            <strong className="stat-value-clean">{pendingAnomalies}</strong>
          </div>
        </div>
      </div>

      {/* Content Grid - 2 columns */}
      <div className="content-grid-clean">
        {/* Anomalies Summary */}
        <div className="info-card-clean">
          <div className="card-header-clean">
            <div>
              <h2>Resumen de Anomalías</h2>
              <p className="card-subtitle">Estado actual de hallazgos</p>
            </div>
            {onViewAnomalies && (
              <button className="view-all-btn" onClick={onViewAnomalies} type="button">
                Ver detalle
                <ArrowRight size={16} />
              </button>
            )}
          </div>

          <div className="metrics-grid">
            <div className="metric-item">
              <div className="metric-header">
                <span className="metric-label">Alta Severidad</span>
                <AlertTriangle size={18} className="text-danger" />
              </div>
              <strong className="metric-value text-danger">{highSeverity}</strong>
              <div className="metric-bar">
                <div className="metric-fill danger" style={{ width: `${(highSeverity / totalAnomalies) * 100}%` }} />
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-header">
                <span className="metric-label">Media Severidad</span>
                <AlertTriangle size={18} className="text-warning" />
              </div>
              <strong className="metric-value text-warning">{mediumSeverity}</strong>
              <div className="metric-bar">
                <div className="metric-fill warning" style={{ width: `${(mediumSeverity / totalAnomalies) * 100}%` }} />
              </div>
            </div>

            <div className="metric-item">
              <div className="metric-header">
                <span className="metric-label">Validadas</span>
                <CheckCircle size={18} className="text-success" />
              </div>
              <strong className="metric-value text-success">{validatedAnomalies}</strong>
              <div className="metric-bar">
                <div className="metric-fill success" style={{ width: `${(validatedAnomalies / totalAnomalies) * 100}%` }} />
              </div>
            </div>
          </div>

          {pendingAnomalies > 0 && (
            <div className="alert-box">
              <AlertTriangle size={20} />
              <span>
                <strong>{pendingAnomalies}</strong> {pendingAnomalies === 1 ? 'anomalía requiere' : 'anomalías requieren'} validación
              </span>
            </div>
          )}
        </div>

        {/* Missions Summary */}
        <div className="info-card-clean">
          <div className="card-header-clean">
            <div>
              <h2>Estado de Misiones</h2>
              <p className="card-subtitle">Progreso de inspecciones</p>
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-item">
              <div className="progress-header">
                <span>Completadas</span>
                <strong>{completedMissions}</strong>
              </div>
              <div className="progress-bar-large">
                <div 
                  className="progress-fill-large completed"
                  style={{ width: `${totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="progress-item">
              <div className="progress-header">
                <span>Pendientes</span>
                <strong>{pendingMissions}</strong>
              </div>
              <div className="progress-bar-large">
                <div 
                  className="progress-fill-large pending"
                  style={{ width: `${totalMissions > 0 ? (pendingMissions / totalMissions) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="summary-stats">
            <div className="summary-stat">
              <TrendingUp size={20} />
              <div>
                <span className="summary-label">Tasa de Completitud</span>
                <strong>{totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0}%</strong>
              </div>
            </div>
            <div className="summary-stat">
              <Activity size={20} />
              <div>
                <span className="summary-label">Total de Misiones</span>
                <strong>{totalMissions}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Anomalies List */}
        <div className="info-card-clean full-width">
          <div className="card-header-clean">
            <div>
              <h2>Anomalías Recientes</h2>
              <p className="card-subtitle">Últimos hallazgos detectados</p>
            </div>
          </div>

          {recentAnomalies.length === 0 ? (
            <div className="empty-state-clean">
              <CheckCircle size={32} />
              <p>No hay anomalías detectadas</p>
            </div>
          ) : (
            <div className="table-clean">
              <div className="table-header">
                <span>Tipo</span>
                <span>Activo</span>
                <span>Severidad</span>
                <span>Estado</span>
                <span>Fecha</span>
              </div>
              {recentAnomalies.map((anomaly) => (
                <div key={anomaly.id} className="table-row">
                  <span className="table-cell-main">{anomaly.type}</span>
                  <span className="table-cell">{anomaly.assetName}</span>
                  <span className="table-cell">
                    <span className={`badge-severity severity-${anomaly.severity.toLowerCase()}`}>
                      {anomaly.severity}
                    </span>
                  </span>
                  <span className="table-cell">
                    <span className={`badge-status status-${anomaly.status.toLowerCase()}`}>
                      {anomaly.status}
                    </span>
                  </span>
                  <span className="table-cell-date">
                    {new Date(anomaly.detectedAt).toLocaleDateString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Made with Bob
