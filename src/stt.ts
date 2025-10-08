import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import type { SpeechToTextChunkResponseModel } from "@elevenlabs/elevenlabs-js/api/index.js";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import kuromoji from "kuromoji";
import { promisify } from "util";

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
  // 句点（。）や感嘆符、疑問符で文末を判定
  return (
    token.pos === "記号" &&
    (token.surface_form === "。" ||
      token.surface_form === "." ||
      token.surface_form === "!" ||
      token.surface_form === "！" ||
      token.surface_form === "?" ||
      token.surface_form === "？")
  );
}

function isParticle(token: kuromoji.IpadicFeatures): boolean {
  // 助詞かどうかを判定
  return token.pos === "助詞";
}

function isIndependentWord(token: kuromoji.IpadicFeatures): boolean {
  // 自立語かどうかを判定（新しい文節の開始となる品詞）
  const independentPOS = [
    "名詞",
    "動詞",
    "形容詞",
    "副詞",
    "接続詞",
    "連体詞",
    "感動詞",
    "接頭詞",
  ];
  return independentPOS.includes(token.pos);
}

async function generateSrtFromWords(
  words: Array<{ text: string; start?: number; end?: number }>
): Promise<string> {
  const tokenizer = await getTokenizer();
  const maxCharsPerSubtitle = 10; // 最大文字数

  // words配列から全テキストを結合
  const fullText = words.map((w) => w.text).join("");

  // 形態素解析
  const tokens = tokenizer.tokenize(fullText);

  let srtContent = "";
  let index = 1;
  let currentSentence: string[] = [];
  let currentBunsetsu: string[] = []; // 現在の文節
  let sentenceStartChar = 0;
  let processedChars = 0;

  // 文字数からwords配列のインデックスを取得するマップを作成
  const charToWordMap: number[] = [];
  let totalChars = 0;
  for (let i = 0; i < words.length; i++) {
    const wordText = words[i]?.text || "";
    for (let j = 0; j < wordText.length; j++) {
      charToWordMap.push(i);
    }
    totalChars += wordText.length;
  }

  let needsSpace = false; // 10文字を超えたかどうかのフラグ

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const prevToken = i > 0 ? tokens[i - 1] : null;

    // 現在の文節が空ではなく、かつ、トークンが自立語の場合
    // -> 新しい文節の始まりと判断
    // ただし、数字や記号、接尾辞が連続する場合は同じ文節として扱う
    const shouldStartNewBunsetsu =
      currentBunsetsu.length > 0 &&
      isIndependentWord(token) &&
      !(
        prevToken &&
        (prevToken.pos === "名詞" && prevToken.pos_detail_1 === "数") &&
        (token.pos === "名詞" || token.pos === "記号")
      ) &&
      !(
        prevToken &&
        prevToken.pos === "記号" &&
        (token.pos === "名詞" || token.pos === "記号")
      );

    if (shouldStartNewBunsetsu) {
      // 文節を完成させる
      const bunsetsuText = currentBunsetsu.join("");

      // 10文字を超えていてスペースが必要な場合、この文節の前にスペースを追加
      if (needsSpace) {
        currentSentence.push(" ");
        needsSpace = false;
      }

      currentSentence.push(bunsetsuText);

      // 最後のスペース以降が10文字を超えているかチェック
      const currentText = currentSentence.join("");
      const lastSpaceIndex = currentText.lastIndexOf(" ");
      const textSinceLastSpace =
        lastSpaceIndex === -1
          ? currentText
          : currentText.substring(lastSpaceIndex + 1);

      if (textSinceLastSpace.length > maxCharsPerSubtitle) {
        needsSpace = true;
      }

      currentBunsetsu = [];
    }

    currentBunsetsu.push(token.surface_form);
    processedChars += token.surface_form.length;

    const shouldBreak = isSentenceEnd(token);

    if (shouldBreak) {
      // 残りの文節を追加
      if (currentBunsetsu.length > 0) {
        currentSentence.push(currentBunsetsu.join(""));
        currentBunsetsu = [];
      }

      if (currentSentence.length > 0) {
        // 開始と終了のwordsインデックスを取得
        const startWordIndex = charToWordMap[sentenceStartChar] ?? 0;
        const endWordIndex =
          charToWordMap[
            Math.min(processedChars - 1, charToWordMap.length - 1)
          ] ?? words.length - 1;

        const startTime = words[startWordIndex]?.start ?? 0;
        const endTime = words[endWordIndex]?.end ?? startTime;

        // スペースはそのまま（改行に置き換えない）
        const text = currentSentence.join("");
        srtContent += `${index}\n`;
        srtContent += `${formatTimestamp(startTime)} --> ${formatTimestamp(
          endTime
        )}\n`;
        srtContent += `${text}\n\n`;
        index++;

        currentSentence = [];
        sentenceStartChar = processedChars;
        needsSpace = false; // 文の終わりでフラグをリセット
      }
    }
  }

  // 残りのテキストがあれば追加
  if (currentBunsetsu.length > 0) {
    currentSentence.push(currentBunsetsu.join(""));
  }

  if (currentSentence.length > 0) {
    const startWordIndex = charToWordMap[sentenceStartChar] ?? 0;
    const endWordIndex =
      charToWordMap[charToWordMap.length - 1] ?? words.length - 1;

    const startTime = words[startWordIndex]?.start ?? 0;
    const endTime = words[endWordIndex]?.end ?? startTime;

    // スペースはそのまま（改行に置き換えない）
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

  // 各ファイルを並列処理
  await Promise.all(
    files.map(async (file) => {
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
      const srtFilePath = audioFilePath.replace(".mp3", ".srt");
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
