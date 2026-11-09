FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dépendances d'abord (couche mise en cache), puis le code.
COPY pyproject.toml ./
RUN python -c "import tomllib; d = tomllib.load(open('pyproject.toml', 'rb')); print(chr(10).join(d['project']['dependencies']))" > /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

# En développement (docker compose), on ajoute pytest, ruff, mypy… pour `make test`.
ARG INSTALL_DEV=false
RUN if [ "$INSTALL_DEV" = "true" ]; then       python -c "import tomllib; d = tomllib.load(open('pyproject.toml', 'rb')); print(chr(10).join(d['project']['optional-dependencies']['dev']))" > /tmp/dev.txt       && pip install -r /tmp/dev.txt;     fi

COPY . .

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# En production (Render, Fly.io) : migrations, données de départ (idempotent, seulement si
# ADMIN_PASSWORD est défini), puis le serveur. $PORT est fourni par l'hébergeur.
CMD ["sh", "-c", "alembic upgrade head && if [ -n \"$ADMIN_PASSWORD\" ]; then python scripts/seed.py; fi && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
