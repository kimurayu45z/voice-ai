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

  // 3000文字制限を考慮して段落を結合（SSMLのbreakタグを追加）
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // 現在のチャンクに段落を追加した場合の長さを計算
    // 段落間にポーズを追加
    const separator = currentChunk ? "..." : "";
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

  // 各チャンクごとにconvertリクエストを送信して個別ファイルに保存
  for (let i = 0; i < chunks.length; i++) {
    const requestOptions: TextToSpeechRequest = {
      text: chunks[i] || "",
      modelId: "eleven_v3",
    };

    // 前後のテキストを設定
    // if (i > 0) {
    //   requestOptions.previousText = chunks[i - 1]?.slice(-500) || ""; // 前のチャンクの最後500文字
    // }
    // if (i < chunks.length - 1) {
    //   requestOptions.nextText = chunks[i + 1]?.slice(0, 500) || ""; // 次のチャンクの最初500文字
    // }

    const res = await client.textToSpeech.convert(
      voices.find((v) => (v.name = "Sarah"))?.voiceId!,
      // "RZ7g88QZqj5QobZ3Y0Ok",
      requestOptions
    );

    // 各チャンクを個別のファイルに保存
    const outputFileName = `out/output-${i}.mp3`;
    const outputStream = fs.createWriteStream(outputFileName);
    await pipeline(res, outputStream);
    console.log(`チャンク ${i} が ${outputFileName} として保存されました`);
  }
}

export async function combineAudioFiles(
  outputFile: string = "out/output-final.mp3"
) {
  // output-*.mp3 ファイルを検索して番号順にソート
  const files = fs
    .readdirSync("out")
    .filter((file) => file.match(/^output-\d+\.mp3$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0]);
      const numB = parseInt(b.match(/\d+/)![0]);
      return numA - numB;
    });

  if (files.length === 0) {
    console.log("結合する音声ファイルが見つかりませんでした");
    return;
  }

  const outputStream = fs.createWriteStream(outputFile);

  for (let i = 0; i < files.length; i++) {
    const inputStream = fs.createReadStream(`out/${files[i]}`);
    await pipeline(inputStream, outputStream, {
      end: i === files.length - 1,
    });
  }

  console.log(
    `${files.length}個の音声ファイルが ${outputFile} として結合されました`
  );
}
