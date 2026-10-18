import { useEffect, useState } from "react";
import { Download, Video } from "lucide-react";
import { getMissionVideos } from "../api/client";
import type { BackendMissionVideo } from "../api/types";

// El dron baja el video de la cámara y lo sube recién después de aterrizar, y un vuelo largo
// pesa más de un GB: puede tardar varios minutos en aparecer. Mientras no llegue se vuelve a
// preguntar cada tanto, hasta un tope.
const POLL_INTERVAL_MS = 20_000;
const MAX_POLLS = 45;

function formatSize(bytes: number | null) {
  if (bytes == null) return null;
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

function formatClock(seconds: number | null) {
  if (seconds == null) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Video del vuelo, para una misión que ya terminó. La cámara graba en H.265: Chrome y Edge lo
// reproducen en Windows con aceleración por hardware, pero no todos los navegadores pueden, así
// que siempre queda el enlace para descargarlo.
export function MissionVideoCard({ missionId, finished }: { missionId: string; finished: boolean }) {
  const [videos, setVideos] = useState<BackendMissionVideo[]>([]);
  const [gaveUp, setGaveUp] = useState(false);
  const [unplayable, setUnplayable] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVideos([]);
    setGaveUp(false);
    setUnplayable(new Set());
    if (!finished) return;

    let cancelled = false;
    let polls = 0;
    let timeoutId: number | undefined;
    const load = () => {
      polls += 1;
      getMissionVideos(missionId)
        .catch(() => [] as BackendMissionVideo[])
        .then((loaded) => {
          if (cancelled) return;
          setVideos(loaded);
          if (loaded.length > 0) return;
          if (polls >= MAX_POLLS) setGaveUp(true);
          else timeoutId = window.setTimeout(load, POLL_INTERVAL_MS);
        });
    };
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [missionId, finished]);

  if (!finished) return null;

  return (
    <article className="monitor-side-card monitor-video-card">
      <h2 className="monitor-card-header">
        <span className="monitor-card-header-icon"><Video size={15} /></span>
        Video del vuelo
      </h2>
      {videos.length === 0 ? (
        <p className="monitor-empty-media">
          {gaveUp
            ? "Este vuelo no tiene video."
            : "Todavía no llegó el video. Si el dron grabó el vuelo, aparece acá unos minutos después de aterrizar."}
        </p>
      ) : (
        videos.map((video, index) => {
          const details = [formatClock(video.durationSeconds), formatSize(video.sizeBytes)].filter(Boolean).join(" · ");
          return (
            <div className="monitor-video-item" key={video.idMissionVideo}>
              {unplayable.has(video.idMissionVideo) ? (
                <p className="monitor-empty-media">Este navegador no puede reproducir el video (H.265). Descargalo para verlo.</p>
              ) : (
                <video
                  controls
                  preload="metadata"
                  src={video.videoUrl}
                  onError={() => setUnplayable((previous) => new Set(previous).add(video.idMissionVideo))}
                />
              )}
              <div className="monitor-video-meta">
                <span>{videos.length > 1 ? `Parte ${index + 1}` : video.fileName ?? "Video"}{details ? ` · ${details}` : ""}</span>
                <a href={video.videoUrl} download={video.fileName ?? undefined} target="_blank" rel="noreferrer">
                  <Download size={13} /> Descargar
                </a>
              </div>
            </div>
          );
        })
      )}
    </article>
  );
}
