# syntax=docker/dockerfile:1

# ---------- Stage 1 : builder ----------
# Base epinglee pour des builds reproductibles.
FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Cree un virtualenv isole que l'on copiera dans l'image finale.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install -r requirements.txt

# ---------- Stage 2 : runtime ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

# Utilisateur non-root.
RUN groupadd --system app && useradd --system --gid app --create-home app

WORKDIR /app

# Dependances pre-installees depuis le builder.
COPY --from=builder /opt/venv /opt/venv

# Code applicatif.
COPY app ./app

USER app

# Informatif pour le dev local (docker-compose). En production, l'hebergeur (Railway)
# attribue le port dynamiquement via la variable $PORT — voir le CMD ci-dessous.
EXPOSE 8000

# Sonde interne tolerante au port dynamique ($PORT si present, sinon 8000).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.environ.get('PORT', '8000') + '/health')" || exit 1

# Forme shell (sh -c) pour que ${PORT} soit INTERPRETE a l'execution : Railway injecte
# $PORT dynamiquement ; en local (docker-compose) on retombe sur 8000. NE PAS coder un
# port fixe ici.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
