import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { SpeechToTextChunkResponseModel } from "@elevenlabs/elevenlabs-js/api/index.js";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";

// --- Speech-to-Text (SRT generation) ---

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000)
    .toString()
    .padStart(3, "0");
  return `${h}:${m}:${s},${ms}`;
}

function generateSrtFromWords(
  words: Array<{ text: string; start?: number; end?: number }>
): string {
  let srtContent = "";
  let index = 1;
  const maxWordsPerSubtitle = 10;
  const maxDuration = 5;

  for (let i = 0; i < words.length; ) {
    const chunkWords: string[] = [];
    const startTime = words[i]?.start || 0;
    let endTime = words[i]?.end || 0;

    while (i < words.length && chunkWords.length < maxWordsPerSubtitle) {
      const word = words[i];
      const currentEnd = word?.end || 0;

      if (currentEnd - startTime > maxDuration && chunkWords.length > 0) {
        break;
      }

      chunkWords.push(word?.text || "");
      endTime = currentEnd;
      i++;
    }

    const text = chunkWords.join(" ");
    srtContent += `${index}\n`;
    srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(endTime)}\n`;
    srtContent += `${text}\n\n`;
    index++;
  }

  return srtContent;
}

// Helper function to delay execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function speechToText(client: ElevenLabsClient) {
  const files = fs
    .readdirSync("out")
    .filter((file) => file.match(/^output-\d+\.mp3$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0]);
      const numB = parseInt(b.match(/\d+/)![0]);
      return numA - numB;
    });

  if (files.length === 0) {
    console.log("文字起こし対象の音声ファイルが見つかりませんでした");
    return;
  }

  for (const file of files) {
    const audioFilePath = `out/${file}`;
    const srtFilePath = audioFilePath.replace(".mp3", ".srt");
    console.log(`${audioFilePath} の文字起こしを開始...`);

    try {
      const audioFileStream = fs.createReadStream(audioFilePath);

      // Step 1: Submit the audio file for transcription and get the ID
      const res = await client.speechToText.convert({
        file: audioFileStream,
        modelId: "scribe_v1",
      });
      const transcriptionId = res.transcriptionId || "";

      console.log(`Transcription job started with ID: ${transcriptionId}`);

      // Step 2: Poll for the result using the transcription ID
      let finalResult: SpeechToTextChunkResponseModel | null = null;
      while (true) {
        console.log(`Checking status for job ${transcriptionId}...`);
        const response = await client.speechToText.transcripts.get(
          transcriptionId
        );

        // Check if response is completed (has text property)
        if ("text" in response && response.text) {
          finalResult = response;
          console.log("Transcription completed.");
          break;
        }

        // Wait for 5 seconds before checking again
        await sleep(5000);
      }

      // Step 3: Generate SRT content from the words
      const srtContent = finalResult?.words
        ? generateSrtFromWords(finalResult.words)
        : "";

      fs.writeFileSync(srtFilePath, srtContent);
      console.log(`字幕ファイルが ${srtFilePath} として保存されました`);
    } catch (error) {
      console.error(
        `${audioFilePath} の文字起こし中にエラーが発生しました:`,
        error
      );
    }
  }
}

function getAudioFiles(): string[] {
  return fs
    .readdirSync("out")
    .filter((file) => file.match(/^output-\d+\.mp3$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0]);
      const numB = parseInt(b.match(/\d+/)![0]);
      return numA - numB;
    });
}

function getVideoFiles(): string[] {
  return fs
    .readdirSync("out")
    .filter((file) => file.match(/^output-\d+\.mp4$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0]);
      const numB = parseInt(b.match(/\d+/)![0]);
      return numA - numB;
    });
}

async function generateVideoWithSubtitle(
  audioFilePath: string,
  srtFilePath: string,
  videoFilePath: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input("background.jpg")
      .loop(1)
      .input(audioFilePath)
      .outputOptions([
        "-c:v libx264",
        "-tune stillimage",
        "-c:a aac",
        "-b:a 192k",
        "-pix_fmt yuv420p",
        "-shortest",
        `-vf subtitles=${srtFilePath}`,
      ])
      .output(videoFilePath)
      .on("end", () => {
        console.log(`${videoFilePath} の生成が完了しました`);
        resolve();
      })
      .on("error", (err) => {
        console.error(`${videoFilePath} の生成中にエラーが発生しました:`, err);
        reject(err);
      })
      .run();
  });
}

export async function generateVideosWithSubtitles() {
  const files = getAudioFiles();

  if (files.length === 0) {
    console.log("動画生成対象のファイルが見つかりませんでした");
    return;
  }

  for (const file of files) {
    const audioFilePath = `out/${file}`;
    const srtFilePath = audioFilePath.replace(".mp3", ".srt");
    const videoFilePath = audioFilePath.replace(".mp3", ".mp4");

    console.log(`${videoFilePath} の生成を開始...`);
    await generateVideoWithSubtitle(audioFilePath, srtFilePath, videoFilePath);
  }
}

async function concatVideosWithFfmpeg(
  files: string[],
  outputPath: string
): Promise<void> {
  const fileListPath = "out/filelist.txt";
  const fileListContent = files.map((file) => `file '${file}'`).join("\n");
  fs.writeFileSync(fileListPath, fileListContent);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions(["-c copy"])
        .output(outputPath)
        .on("end", () => {
          console.log(`${outputPath} の生成が完了しました`);
          resolve();
        })
        .on("error", (err) => {
          console.error("動画結合中にエラーが発生しました:", err);
          reject(err);
        })
        .run();
    });
  } finally {
    if (fs.existsSync(fileListPath)) {
      fs.unlinkSync(fileListPath);
    }
  }
}

export async function combineVideos() {
  const files = getVideoFiles();

  if (files.length === 0) {
    console.log("結合対象の動画ファイルが見つかりませんでした");
    return;
  }

  console.log("動画ファイルの結合を開始...");
  await concatVideosWithFfmpeg(files, "out/output-final.mp4");
}
