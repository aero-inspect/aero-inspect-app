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
    $jar,
    "ia-module/Dockerfile",
    "ia-module/.dockerignore",
    "ia-module/requirements-inference.lock.txt",
    "ia-module/requirements-training.lock.txt",
    "ia-module/src",
    "ia-module/scripts/run_worker.py",
    "ia-module/evaluation",
    "ia-module/configs"
) + $models

$outDir = Join-Path $PSScriptRoot "..\out"
New-Item -ItemType Directory -Force $outDir | Out-Null
$tarball = Join-Path (Resolve-Path $outDir).Path "aeroinspect-deploy.tar.gz"

# tar.exe de Windows (bsdtar). Las barras normales se conservan dentro del paquete.
& tar.exe -czf $tarball -C $ReposRoot --exclude "__pycache__" --exclude "*.pyc" @items
if ($LASTEXITCODE -ne 0) { throw "tar termino con error $LASTEXITCODE" }

$sizeMb = [math]::Round((Get-Item $tarball).Length / 1MB, 1)
Write-Host "Paquete listo: $tarball ($sizeMb MB)"
