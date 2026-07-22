# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-venv \
       ffmpeg \
       mediainfo \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir \
    yt-dlp \
    pymediainfo==7.0.1 \
    edge-tts==7.2.3 \
    websockets==15.0.1

RUN npm install -g @openai/codex@latest \
    && codex --version

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV CODEX_HOME=/root/.codex

RUN mkdir -p /root/.codex

RUN cat > /usr/local/bin/world-cup-entrypoint.sh <<'EOF'
#!/bin/sh
set -eu

export CODEX_HOME="${CODEX_HOME:-/root/.codex}"
mkdir -p "$CODEX_HOME"

if [ -z "${CODEX_BASE_URL:-}" ]; then
  echo "警告：缺少 CODEX_BASE_URL，Codex 中转站不可用。" >&2
elif [ -z "${CODEX_RELAY_API_KEY:-}" ]; then
  echo "警告：缺少 CODEX_RELAY_API_KEY，Codex 中转站不可用。" >&2
elif [ -z "${CODEX_CREATIVE_MODEL:-}" ]; then
  echo "警告：缺少 CODEX_CREATIVE_MODEL，Codex 中转站不可用。" >&2
else
  export CODEX_PUBLISH_MODEL="${CODEX_PUBLISH_MODEL:-$CODEX_CREATIVE_MODEL}"

  cat > "$CODEX_HOME/config.toml" <<CONFIG
model = "${CODEX_CREATIVE_MODEL}"
model_provider = "relay"

[model_providers.relay]
name = "GPT Relay"
base_url = "${CODEX_BASE_URL}"
env_key = "CODEX_RELAY_API_KEY"
wire_api = "responses"
supports_websockets = false
request_max_retries = 2
stream_max_retries = 1
stream_idle_timeout_ms = 180000
CONFIG

  echo "Codex GPT 中转配置已加载"
  echo "Base URL: ${CODEX_BASE_URL}"
  echo "Creative model: ${CODEX_CREATIVE_MODEL}"
  echo "Publish model: ${CODEX_PUBLISH_MODEL}"
fi

exec npm run api
EOF

RUN chmod +x /usr/local/bin/world-cup-entrypoint.sh

EXPOSE 4317

CMD ["/usr/local/bin/world-cup-entrypoint.sh"]
