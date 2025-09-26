import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";
import { pipeline } from "stream/promises";
import { voices } from "./voices.js";

export async function textToSpeech(client: ElevenLabsClient, text: string) {
  const res = await client.textToSpeech.convert(
    voices.find((v) => (v.name = "Sarah"))?.voiceId!,
    {
      text,
      modelId: "eleven_v3",
    }
  );

  // ReadableStreamを直接ファイルに書き込み
  await pipeline(res as any, fs.createWriteStream("out/output.mp3"));
  console.log("音声ファイルが output.mp3 として保存されました");
}
