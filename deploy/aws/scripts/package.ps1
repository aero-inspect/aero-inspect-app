# Arma deploy/aws/out/aeroinspect-deploy.tar.gz con lo que necesita la instancia, manteniendo
# la estructura de carpetas hermanas que espera compose.yml. No compila nada: antes hay que
# correr el build del monolito, el del frontend y `git lfs pull` en ia-module (ver README).
#
#   .\scripts\package.ps1                                      # repos hermanos de aero-inspect-app
#   .\scripts\package.ps1 -ReposRoot C:\Users\luca\Documents\GitHub

param(
    [string]$ReposRoot = (Resolve-Path "$PSScriptRoot\..\..\..\..").Path
)

$ErrorActionPreference = "Stop"

$jar = "general-monolith/target/general-monolith-0.0.1-SNAPSHOT.jar"
$models = @(
    "ia-module/artifacts/models/aeroinspect-unet-v2-demo.pt",
    "ia-module/artifacts/models/aeroinspect-unet-crack-v1-dev.pt",
    "ia-module/artifacts/training/runs/unet_severity_v2_dev_cpu/best_macro_f1.pt",
    "ia-module/artifacts/training/runs/unet_deformation_v1_cpu/best.pt"
)

$required = @($jar, "aero-inspect-app/frontend/dist/index.html") + $models
foreach ($path in $required) {
    $full = Join-Path $ReposRoot $path
    if (-not (Test-Path $full)) { throw "Falta $path. Corriste el build / git lfs pull?" }
}
# Un puntero de Git LFS sin bajar pesa ~130 bytes; los checkpoints reales, ~23 MB.
foreach ($model in $models) {
    if ((Get-Item (Join-Path $ReposRoot $model)).Length -lt 1MB) {
        throw "$model es un puntero de Git LFS: correr 'git lfs pull' en ia-module."
    }
}

$items = @(
    "aero-inspect-app/deploy/aws/compose.yml",
    "aero-inspect-app/deploy/aws/Caddyfile",
    "aero-inspect-app/deploy/aws/.env.example",
    "aero-inspect-app/deploy/aws/rabbitmq",
    "aero-inspect-app/deploy/aws/mosquitto/mosquitto.conf",
    "aero-inspect-app/deploy/aws/mosquitto/acl",
    "aero-inspect-app/deploy/aws/mosquitto/entrypoint.sh",
    "aero-inspect-app/deploy/aws/scripts",
    "aero-inspect-app/frontend/dist",
    "general-monolith/Dockerfile",
    "general-monolith/.dockerignore",
    $jar
)

$outDir = Join-Path $PSScriptRoot "..\out"
New-Item -ItemType Directory -Force $outDir | Out-Null
$outDir = (Resolve-Path $outDir).Path
$tarball = Join-Path $outDir "aeroinspect-deploy.tar.gz"

# ia-module sale del commit actual (git archive) y no del disco: con core.autocrlf=true los
# JSON de evaluation/ quedan con CRLF en Windows y su SHA-256 deja de coincidir con el que
# congelaron las selecciones (el worker se niega a arrancar). Los .pt de Git LFS sí salen del
# disco, porque git archive solo trae los punteros. Lo que no esté commiteado no se sube.
$stage = Join-Path $outDir "stage"
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force (Join-Path $stage "ia-module") | Out-Null
$iaArchive = Join-Path $outDir "ia-module.tar"
$iaPaths = @("Dockerfile", ".dockerignore", "requirements-inference.lock.txt",
    "requirements-training.lock.txt", "src", "scripts/run_worker.py", "evaluation", "configs")
& git -C (Join-Path $ReposRoot "ia-module") -c core.autocrlf=false archive --format=tar -o $iaArchive HEAD @iaPaths
if ($LASTEXITCODE -ne 0) { throw "git archive de ia-module termino con error $LASTEXITCODE" }
& tar.exe -xf $iaArchive -C (Join-Path $stage "ia-module")
if ($LASTEXITCODE -ne 0) { throw "tar (extraer ia-module) termino con error $LASTEXITCODE" }
Remove-Item $iaArchive
foreach ($model in $models) {
    $dest = Join-Path $stage $model
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    Copy-Item (Join-Path $ReposRoot $model) $dest
}

# Los SHA-256 congelados en ia-module son inconsistentes: los de corrosión y fisuras se
# calcularon sobre reportes con CRLF y el de deformaciones sobre LF. Este paso deja cada
# reporte con el salto de línea que espera su selección (si ninguno coincide, falla).
& python (Join-Path $PSScriptRoot "match_calibration_eol.py") (Join-Path $stage "ia-module")
if ($LASTEXITCODE -ne 0) { throw "match_calibration_eol.py termino con error $LASTEXITCODE" }

# tar.exe de Windows (bsdtar). Las barras normales se conservan dentro del paquete.
& tar.exe -czf $tarball --exclude "__pycache__" --exclude "*.pyc" -C $ReposRoot @items -C $stage "ia-module"
if ($LASTEXITCODE -ne 0) { throw "tar termino con error $LASTEXITCODE" }
Remove-Item -Recurse -Force $stage

$sizeMb = [math]::Round((Get-Item $tarball).Length / 1MB, 1)
Write-Host "Paquete listo: $tarball ($sizeMb MB)"
