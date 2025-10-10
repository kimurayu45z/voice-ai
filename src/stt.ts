import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { SpeechToTextChunkResponseModel } from "@elevenlabs/elevenlabs-js/api/index.js";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import kuromoji from "kuromoji";
import { promisify } from "util";
import Anthropic from "@anthropic-ai/sdk";

// --- Speech-to-Text (SRT generation) ---

let tokenizerInstance: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null =
  null;

async function getTokenizer(): Promise<
  kuromoji.Tokenizer<kuromoji.IpadicFeatures>
> {
  if (tokenizerInstance) {
    return tokenizerInstance;
  }

  const builder = kuromoji.builder({
    dicPath: "node_modules/kuromoji/dict",
  });

  const buildAsync = promisify(builder.build.bind(builder));
  tokenizerInstance = await buildAsync();
  return tokenizerInstance;
}

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

function isSentenceEnd(token: kuromoji.IpadicFeatures): boolean {
  // 句点（。）で文末を判定
  return token.pos === "記号" && token.surface_form === "。";
}

async function generateSrtFromWords(
  words: Array<{ text: string; start?: number; end?: number }>
): Promise<string> {
  const tokenizer = await getTokenizer();

  // words配列から全テキストを結合
  const fullText = words.map((w) => w.text).join("");

  // 形態素解析
  const tokens = tokenizer.tokenize(fullText);

  let srtContent = "";
  let index = 1;
  let currentSentence: string[] = [];
  let sentenceStartChar = 0;
  let processedChars = 0;

  // 文字数からwords配列のインデックスを取得するマップを作成
  const charToWordMap: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const wordText = words[i]?.text || "";
    for (let j = 0; j < wordText.length; j++) {
      charToWordMap.push(i);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    currentSentence.push(token.surface_form);
    processedChars += token.surface_form.length;

    const shouldBreak = isSentenceEnd(token);

    if (shouldBreak) {
      if (currentSentence.length > 0) {
        // 開始と終了のwordsインデックスを取得
        const startWordIndex = charToWordMap[sentenceStartChar] ?? 0;
        const endWordIndex =
          charToWordMap[
            Math.min(processedChars - 1, charToWordMap.length - 1)
          ] ?? words.length - 1;

        const startTime = words[startWordIndex]?.start ?? 0;
        const endTime = words[endWordIndex]?.end ?? startTime;

        const text = currentSentence.join("");
        srtContent += `${index}\n`;
        srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(
          endTime
        )}\n`;
        srtContent += `${text}\n\n`;
        index++;

        currentSentence = [];
        sentenceStartChar = processedChars;
      }
    }
  }

  // 残りのテキストがあれば追加
  if (currentSentence.length > 0) {
    const startWordIndex = charToWordMap[sentenceStartChar] ?? 0;
    const endWordIndex =
      charToWordMap[charToWordMap.length - 1] ?? words.length - 1;

    const startTime = words[startWordIndex]?.start ?? 0;
    const endTime = words[endWordIndex]?.end ?? startTime;

    const text = currentSentence.join("");
    srtContent += `${index}\n`;
    srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(
      endTime
    )}\n`;
    srtContent += `${text}\n\n`;
  }

  return srtContent;
}

// Helper function to delay execution
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function speechToText(
  client: ElevenLabsClient,
  claudeClient: Anthropic
) {
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

  // Step 1: 各ファイルを並列で文字起こし
  await Promise.all(
    files.map(async (file) => {
      const audioFilePath = `out/${file}`;
      const srtFilePath = audioFilePath.replace(".mp3", ".srt");
      console.log(`${audioFilePath} の文字起こしを開始...`);

      try {
        const audioFileStream = fs.createReadStream(audioFilePath);

        const res = await client.speechToText.convert({
          file: audioFileStream,
          modelId: "scribe_v1",
        });
        const transcriptionId = res.transcriptionId || "";

        console.log(`Transcription job started with ID: ${transcriptionId}`);

        let finalResult: SpeechToTextChunkResponseModel | null = null;
        while (true) {
          console.log(`Checking status for job ${transcriptionId}...`);
          const response = await client.speechToText.transcripts.get(
            transcriptionId
          );

          if ("text" in response && response.text) {
            finalResult = response;
            console.log("Transcription completed.");
            break;
          }

          await sleep(5000);
        }

        const srtContent = finalResult?.words
          ? await generateSrtFromWords(finalResult.words)
          : "";

        fs.writeFileSync(srtFilePath, srtContent);
        console.log(`字幕ファイルが ${srtFilePath} として保存されました`);
      } catch (error) {
        console.error(
          `${audioFilePath} の文字起こし中にエラーが発生しました:`,
          error
        );
      }
    })
  );

  // Step 2: Claude APIで訂正
  console.log("\nClaude APIで文字起こしを訂正します...");
  const speechText = fs.readFileSync("out/speech.txt", "utf-8");

  await Promise.all(
    files.map(async (file) => {
      const srtPath = `out/${file.replace(".mp3", ".srt")}`;
      const correctedSrtPath = `out/${file.replace(".mp3", "-corrected.srt")}`;

      if (!fs.existsSync(srtPath)) {
        console.log(`${srtPath} が見つかりません。スキップします。`);
        return;
      }

      const srtContent = fs.readFileSync(srtPath, "utf-8");
      console.log(`${file} の訂正を開始...`);

      try {
        const message = await claudeClient.messages.create({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 8000,
          system: `あなたは文字起こしの訂正専門家です。音声認識で生成されたSRTファイルの文字起こしを、元の台本を参照して訂正してください。

重要な注意事項：
1. タイムスタンプは絶対に変更しないでください
2. 文字起こしの誤認識（同音異義語の間違い、聞き間違いなど）を訂正してください
3. 元の台本と照らし合わせて、正しい表現に修正してください
4. SRTファイルのフォーマットを保持してください
5. 字幕テキストは7文字超えたあと最初の自然な位置（文節の区切りまたは"、"の後）に半角スペースを絶対に挿入してください
6. 漢数字は使わずアラビア数字に置き換え、1,000のように3桁ごとに,を入れてください
7. 結城晴美などの漢字名は間違いで、「結城はるみ」が絶対です
`,
          messages: [
            {
              role: "user",
              content: `以下の元の台本を参照して、SRTファイルの文字起こしを訂正してください。

元の台本：
\`\`\`
${speechText}
\`\`\`

訂正するSRTファイル：
\`\`\`
${srtContent}
\`\`\`

訂正後のSRTファイルをそのまま出力してください（説明文などは不要です）。`,
            },
          ],
        });

        const textBlock = message.content.find(
          (block) => block.type === "text"
        );
        const correctedText =
          textBlock && textBlock.type === "text" ? textBlock.text : "";

        const cleanedText = correctedText
          .replace(/^```[\s\S]*?\n/, "")
          .replace(/\n```$/, "");

        fs.writeFileSync(correctedSrtPath, cleanedText);
        console.log(`${file} の訂正が完了しました`);
      } catch (error) {
        console.error(`${file} の訂正中にエラーが発生しました:`, error);
      }
    })
  );

  console.log("\nすべての文字起こしと訂正が完了しました");
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
      .input("background.png")
      .inputOptions(["-loop 1"])
      .input(audioFilePath)
      .outputOptions([
        "-c:v libx264",
        "-tune stillimage",
        "-c:a aac",
        "-b:a 192k",
        "-pix_fmt yuv420p",
        "-shortest",
        `-vf subtitles=${srtFilePath}:force_style='FontSize=24,PrimaryColour=&HFFFFFF,BackColour=&H80000000,BorderStyle=4,Outline=0,Shadow=0,MarginV=20,MarginL=10,MarginR=10'`,
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

  // 各ファイルを並列処理
  await Promise.all(
    files.map(async (file) => {
      const audioFilePath = `out/${file}`;
      // 訂正版のSRTファイルを優先的に使用
      const correctedSrtPath = audioFilePath.replace(".mp3", "-corrected.srt");
      const originalSrtPath = audioFilePath.replace(".mp3", ".srt");
      const srtFilePath = fs.existsSync(correctedSrtPath)
        ? correctedSrtPath
        : originalSrtPath;
      const videoFilePath = audioFilePath.replace(".mp3", ".mp4");

      console.log(`${videoFilePath} の生成を開始...`);
      await generateVideoWithSubtitle(
        audioFilePath,
        srtFilePath,
        videoFilePath
      );
    })
  );
}

async function concatVideosWithFfmpeg(
  files: string[],
  outputPath: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cmd = ffmpeg();

    // 各ファイルを入力として追加
    files.forEach((file) => {
      cmd.input(`out/${file}`);
    });

    // filter_complexを使用して動画と音声を同期させながら結合
    const filterComplex =
      files.map((_, i) => `[${i}:v][${i}:a]`).join("") +
      `concat=n=${files.length}:v=1:a=1[outv][outa]`;

    cmd
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[outv]", "-map", "[outa]"])
      .outputOptions(["-movflags", "+faststart"])
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
