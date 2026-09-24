param(
  [string]$BackendPath = (Join-Path $PSScriptRoot '../../general-monolith'),
  [string]$JavaHome = (Join-Path $env:USERPROFILE '.jdks/corretto-25.0.4')
)
$ErrorActionPreference = 'Stop'
$backendDirectory = (Resolve-Path -LiteralPath $BackendPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/java.exe'))) {
  throw 'No se encontró JDK 25. Indicá su carpeta con -JavaHome.'
}
foreach ($container in @('aeroinspect-db', 'aeroinspect-mqtt', 'aeroinspect-rabbitmq')) {
  $running = docker inspect --format '{{.State.Running}}' $container
  if ($LASTEXITCODE -ne 0) { throw "No se encontró el contenedor local $container." }
  if ($running -ne 'true') {
    docker start $container
    if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar $container." }
  }
}
# A short native Windows path avoids the JVM's AF_UNIX loopback path failure.
$jvmTemp = Join-Path $env:SystemDrive 'Temp/aero-jvm'
New-Item -ItemType Directory -Force -Path $jvmTemp | Out-Null
$env:JAVA_HOME = $JavaHome
$env:DB_HOST = 'localhost'
$env:DB_PORT = '5432'
$env:MQTT_BROKER_URL = 'tcp://localhost:1883'
$env:RABBITMQ_HOST = 'localhost'
$env:SPRING_PROFILES_ACTIVE = 'no-auth'
$env:WEATHER_MOCK_ENABLED = 'true'
Push-Location -LiteralPath $backendDirectory
try {
  Write-Host 'API local en 127.0.0.1:8080; perfil no-auth y clima simulado de desarrollo.'
  & ./mvnw.cmd spring-boot:run '-Dspring-boot.run.arguments=--server.address=127.0.0.1' "-Dspring-boot.run.jvmArguments=-Djdk.net.unixdomain.tmpdir=$jvmTemp"
  if ($LASTEXITCODE -ne 0) { throw "El backend terminó con código $LASTEXITCODE." }
} finally { Pop-Location }
