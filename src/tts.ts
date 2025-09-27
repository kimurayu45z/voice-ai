import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";
import { pipeline } from "stream/promises";
import { voices } from "./voices.js";
import type { TextToSpeechRequest } from "@elevenlabs/elevenlabs-js/api/index.js";

function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 3000
): string[] {
  // テキストを段落（改行2つ）で分割
  const paragraphs = text.split(/\n\n+/);

  // 3000文字制限を考慮して段落を結合
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // 現在のチャンクに段落を追加した場合の長さを計算
    const separator = currentChunk ? "\n\n" : "";
    const potentialLength =
      currentChunk.length + separator.length + paragraph.length;

    if (potentialLength > maxChunkSize) {
      // 3000文字を超える場合は現在のチャンクを保存して新しいチャンクを開始
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = paragraph;
    } else {
      // 3000文字以内なら現在のチャンクに追加
      currentChunk += separator + paragraph;
    }
  }

  // 最後のチャンクを追加
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export async function textToSpeech(client: ElevenLabsClient) {
  const text = fs.readFileSync("out/speech.txt").toString();
  const chunks = splitTextIntoChunks(text, 3000);

  // 各チャンクごとにconvertリクエストを送信
  const audioStreams: ReadableStream<Uint8Array>[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const requestOptions: TextToSpeechRequest = {
      text: chunks[i] || "",
      modelId: "eleven_v3",
    };

    // 前後のテキストを設定
    if (i > 0) {
      requestOptions.previousText = chunks[i - 1]?.slice(-500) || ""; // 前のチャンクの最後500文字
    }
    if (i < chunks.length - 1) {
      requestOptions.nextText = chunks[i + 1]?.slice(0, 500) || ""; // 次のチャンクの最初500文字
    }

    const res = await client.textToSpeech.convert(
      voices.find((v) => (v.name = "Sarah"))?.voiceId!,
      requestOptions
    );

    audioStreams.push(res);
  }

  // すべての音声ストリームを結合して1つのファイルに保存
  const outputStream = fs.createWriteStream("out/output.mp3");

  for (let i = 0; i < audioStreams.length; i++) {
    await pipeline(audioStreams[i]!, outputStream, {
      end: i === audioStreams.length - 1,
    });
  }

  console.log("音声ファイルが output.mp3 として保存されました");
}
