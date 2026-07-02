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

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
