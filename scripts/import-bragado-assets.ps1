param([string]$DatabaseContainer = 'aeroinspect-db')
$ErrorActionPreference = 'Stop'
$catalog = Get-Content -Raw (Join-Path $PSScriptRoot '../frontend/src/data/bragado-assets.json') | ConvertFrom-Json
$rows = foreach ($asset in $catalog) {
  # Satellite layout: x is east, z is south. Coordinates are approximate, not surveyed.
  $lat = (-35.140583 - $asset.z / 111320).ToString('F7', [cultureinfo]::InvariantCulture)
  $lon = (-60.458067 + $asset.x / (111320 * [math]::Cos(-35.140583 * [math]::PI / 180))).ToString('F7', [cultureinfo]::InvariantCulture)
  $name = $asset.name.Replace("'", "''")
  $code = $asset.code.Replace("'", "''")
  $type = $asset.type.Replace("'", "''")
  "('$name','$code','$type',$lat,$lon)"
}
$values = $rows -join ",`n"
$sql = @"
BEGIN;
LOCK TABLE asset IN SHARE ROW EXCLUSIVE MODE;
WITH catalog(name,code,type,latitude,longitude) AS (VALUES $values)
INSERT INTO asset (name,code,type,status,latitude,longitude,created_at,last_maintenance_at,location_detail,description)
SELECT c.name,c.code,c.type,'ACTIVE',c.latitude,c.longitude,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
  'Planta Bragado - ' || c.name,
  'Activo del mapa 3D Bragado. Coordenadas aproximadas del modelo satelital. Fecha de mantenimiento inicial indicada por el usuario al importar.'
FROM catalog c
WHERE NOT EXISTS (SELECT 1 FROM asset a WHERE lower(a.code)=lower(c.code) OR lower(a.name)=lower(c.name))
RETURNING id_asset,name,code,type,status,last_maintenance_at;
COMMIT;
"@
$sql | docker exec -i $DatabaseContainer psql -U postgres -d aeroinspect -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'No se pudo importar el catalogo de Bragado.' }
