# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

# 安装系统依赖
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-venv \
       ffmpeg \
       mediainfo \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/*

# 创建 Python 虚拟环境
RUN python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

# 安装 Python 依赖
RUN pip install --no-cache-dir \
    yt-dlp \
    pymediainfo==7.0.1 \
    edge-tts==7.2.3 \
    websockets==15.0.1

# 安装 Codex CLI
RUN npm install -g @openai/codex@latest \
    && codex --version

WORKDIR /app

# 先复制依赖清单，利用 Docker 缓存
COPY package.json package-lock.json ./

RUN npm ci

# 复制项目源码
COPY . .

# 移除 --ignore-user-config，让 Codex 能读取中转站配置。
# 容器没有 .git，因此加入 --skip-git-repo-check。
RUN node <<'NODE'
const fs = require("fs");

const file = "server/creative-agent.ts";
let source = fs.readFileSync(file, "utf8");
const original = source;

source = source.replace(
  /"exec"\s*,\s*"--ignore-user-config"\s*,/g,
  '"exec", "--skip-git-repo-check",'
);

if (source === original) {
  console.warn(
    "Warning: 未找到 --ignore-user-config；可能已经修改过，或源码格式发生变化。"
  );
}

fs.writeFileSync(file, source);
NODE

# 构建 React 前端
RUN npm run build

ENV NODE_ENV=production
ENV CODEX_HOME=/root/.codex

RUN mkdir -p /root/.codex

# 创建启动脚本
# 中转地址和密钥在容器运行时从 Railway Variables 读取
RUN cat > /usr/local/bin/world-cup-entrypoint.sh <<'EOF'
#!/bin/sh
set -eu

export CODEX_HOME="${CODEX_HOME:-/root/.codex}"
mkdir -p "$CODEX_HOME"

if [ -n "${CODEX_BASE_URL:-}" ] \
   && [ -n "${CODEX_RELAY_API_KEY:-}" ] \
   && [ -n "${CODEX_CREATIVE_MODEL:-}" ]; then

  export CODEX_PUBLISH_MODEL="${CODEX_PUBLISH_MODEL:-$CODEX_CREATIVE_MODEL}"

  cat > "$CODEX_HOME/config.toml" <<CONFIG
model = "${CODEX_CREATIVE_MODEL}"
model_provider = "relay"

[model_providers.relay]
name = "Relay"
base_url = "${CODEX_BASE_URL}"
env_key = "CODEX_RELAY_API_KEY"
wire_api = "responses"
CONFIG

  echo "Codex 中转配置已加载"
  echo "Base URL: ${CODEX_BASE_URL}"
  echo "Creative model: ${CODEX_CREATIVE_MODEL}"
  echo "Publish model: ${CODEX_PUBLISH_MODEL}"
else
  echo "警告：Codex 中转变量不完整，AI 将使用项目降级逻辑。"
fi

exec npm run api
EOF

RUN chmod +x /usr/local/bin/world-cup-entrypoint.sh

EXPOSE 4317

CMD ["/usr/local/bin/world-cup-entrypoint.sh"]
