"""Écrit le schéma OpenAPI de l'API dans un fichier (pour générer les types du frontend).

Usage : python scripts/export_openapi.py ../frontend/openapi.json
"""

import json
import sys
from pathlib import Path

from app.main import app

if __name__ == "__main__":
    target = Path(sys.argv[1] if len(sys.argv) > 1 else "openapi.json")
    schema = json.dumps(app.openapi(), ensure_ascii=False, indent=2)
    target.write_text(schema + "\n", encoding="utf-8")
    print(f"Schéma OpenAPI écrit dans {target}")
