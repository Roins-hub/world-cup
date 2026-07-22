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

# Claude Code 原生安装器默认安装到 /root/.local/bin
ENV PATH="/root/.local/bin:/opt/venv/bin:$PATH"

# 安装项目需要的 Python 包
RUN pip install --no-cache-dir \
    yt-dlp \
    pymediainfo==7.0.1 \
    edge-tts==7.2.3 \
    websockets==15.0.1

# 安装 Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash \
    && claude --version

WORKDIR /app

# 先复制依赖清单，利用 Docker 缓存
COPY package.json package-lock.json ./

RUN npm ci

# 复制项目源码
COPY . .

# 构建 React 前端
RUN npm run build

ENV NODE_ENV=production
ENV DISABLE_AUTOUPDATER=1
ENV CLAUDE_CODE_SKIP_PROMPT_HISTORY=1
ENV CLAUDE_CODE_DISABLE_AUTO_MEMORY=1

EXPOSE 4317

CMD ["npm", "run", "api"]
