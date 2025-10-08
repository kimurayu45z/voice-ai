import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "fs";
import { pipeline } from "stream/promises";
import type { TextToSpeechRequest } from "@elevenlabs/elevenlabs-js/api/index.js";

function splitTextIntoChunks(
  text: string,
  maxChunkSize: number = 500
): string[] {
  // テキストを文単位（句点）で分割
  const sentences = text.split(/(?<=[。．！？])/);

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const potentialLength = currentChunk.length + sentence.length;

    if (potentialLength > maxChunkSize && currentChunk) {
      // maxChunkSizeを超える場合は現在のチャンクを保存
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      // maxChunkSize以内なら現在のチャンクに追加
      currentChunk += sentence;
    }
  }

  // 最後のチャンクを追加
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export async function textToSpeech(
  client: ElevenLabsClient,
  voiceId = "RZ7g88QZqj5QobZ3Y0Ok"
) {
  const text = fs.readFileSync("out/speech.txt").toString();
  const chunks = splitTextIntoChunks(text, 500);

  console.log(`チャンク数: ${chunks.length}`);
  chunks.forEach((chunk, i) => {
    console.log(`チャンク${i}: ${chunk.length}文字`);
  });

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

    const res = await client.textToSpeech.convert(voiceId, requestOptions);

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
