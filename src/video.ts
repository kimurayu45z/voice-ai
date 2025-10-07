import type OpenAI from "openai";
import fs from "fs";

export async function createVideoOpenAi(client: OpenAI, prompt: string) {
  const res = await client.videos.create({
    model: "sora-2",
    prompt,
  });

  return res;
}

export async function checkVideoOpenAi(client: OpenAI, videoId: string) {
  const res = await client.videos.retrieve(videoId);

  return res;
}

export async function downloadVideoOpenAi(client: OpenAI, videoId: string) {
  const res = await client.videos.downloadContent(videoId);

  const body = res.arrayBuffer();
  const buffer = Buffer.from(await body);

  fs.writeFileSync("out/video.mp4", buffer);
}
