FROM jrottenberg/ffmpeg as ffmpeg_build

FROM node:22-slim

COPY --from=ffmpeg_build /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg_build /usr/local/bin/ffprobe /usr/local/bin/ffprobe

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY . .
