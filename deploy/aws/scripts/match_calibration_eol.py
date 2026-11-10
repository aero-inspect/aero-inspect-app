"""Deja cada reporte de calibración de ia-module con el salto de línea (LF o CRLF) cuyo SHA-256
coincide con el que congeló su selección. Uso: python match_calibration_eol.py <ia-module>"""
import hashlib
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for selection in sorted((root / "evaluation").glob("*.json")):
    try:
        data = json.loads(selection.read_text(encoding="utf-8"))
    except (ValueError, UnicodeDecodeError):
        continue
    if not isinstance(data, dict):
        continue
    report, expected = data.get("calibration_report"), data.get("calibration_report_sha256")
    if not report or not expected:
        continue
    path = root / report.replace("\\", "/")
    if not path.is_file():
        continue
    lf = path.read_bytes().replace(b"\r\n", b"\n")
    for name, content in (("LF", lf), ("CRLF", lf.replace(b"\n", b"\r\n"))):
        if hashlib.sha256(content).hexdigest() == expected:
            path.write_bytes(content)
            print(f"{report}: {name}")
            break
    else:
        print(f"{report}: NINGUNO coincide", file=sys.stderr)
        sys.exit(1)
