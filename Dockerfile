FROM node:22-bookworm-slim

# 安装 Python、FFmpeg、MediaInfo 等系统工具
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 \
       python3-venv \
       ffmpeg \
       mediainfo \
       ca-certificates \
       curl \
    && rm -rf /var/lib/apt/lists/*

# 建立独立 Python 环境
RUN python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

# 安装项目需要的 Python 包和 yt-dlp
RUN pip install --no-cache-dir \
    yt-dlp \
    pymediainfo==7.0.1 \
    edge-tts==7.2.3 \
    websockets==15.0.1

WORKDIR /app

# 先复制依赖文件，利用 Docker 构建缓存
COPY package.json package-lock.json ./

RUN npm ci

# 复制项目源码
COPY . .

# 构建 React 前端
RUN npm run build

ENV NODE_ENV=production

EXPOSE 4317

CMD ["npm", "run", "api"]
