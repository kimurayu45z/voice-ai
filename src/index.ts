import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { combineAudioFiles, textToSpeech } from "./tts.js";
import {
  combineVideos,
  generateVideosWithSubtitles,
  speechToText,
} from "./stt.js";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import {
  createReportOpenAi,
  createBlogGemini,
  createTextToReadOpenAi,
  createBlogClaude,
} from "./prompt.js";
import { crypto, mcp, yuukiHarumi, yuukiHarumiSpeech } from "./template.js";
import { fetchCoinTopic, fetchCoinTopics } from "./lunarcrush.js";
import * as fs from "fs";
import {
  checkVideoOpenAi,
  createVideoOpenAi,
  downloadVideoOpenAi,
} from "./video.js";
import { getAiNews } from "./apitube.js";
import { getAiNewsNewsApi } from "./newsapi.js";
import { checkMusicInstrumental, createMusicInstrumental } from "./mureka.js";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw Error("API key is required.");
}
if (!process.env.ELEVENLABS_API_KEY) {
  throw Error("API key is required.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const command = process.argv[2];

switch (command) {
  case "openai-report":
    await createReportOpenAi(
      openai,
      yuukiHarumi,
      process.argv[3] || "今日の株式市場ニュースを調べて台本を作って。"
    );
    break;

  case "openai-text":
    await createTextToReadOpenAi(openai, yuukiHarumiSpeech);
    break;

  case "blog-gemini":
    await createBlogGemini(gemini, "out/report-coin.md", "out/blog-gemini.md");
    break;

  case "blog-claude":
    await createBlogClaude(
      claude,
      "out/report-coin.md",
      "out/blog-gemini.md",
      "out/blog-claude.md"
    );
    break;

  case "tts":
    await textToSpeech(elevenlabs, "3VEofVNyr4k6BtjvBTfN");
    break;

  case "stt-srt":
    await speechToText(elevenlabs, claude);
    break;

  case "stt-mp4":
    await generateVideosWithSubtitles();
    await combineVideos();
    break;

  case "combine":
    await combineAudioFiles();
    break;

  case "ai-topics": {
    const json = await getAiNewsNewsApi();
    fs.writeFileSync("out/ai-topics.json", JSON.stringify(json, undefined, 2));
    break;
  }

  case "coin-topics":
    const json = await fetchCoinTopics();
    fs.writeFileSync(
      "out/coin-topics.json",
      JSON.stringify(
        json.data.map((d) => d.name),
        undefined,
        2
      )
    );
    break;

  case "coin-topic": {
    if (!process.argv[3]) {
      throw Error("coin topic must be specified");
    }
    const text = await fetchCoinTopic(process.argv[3]);
    fs.writeFileSync("out/report-coin.md", text);
    break;
  }

  case "video-gen": {
    if (!process.argv[3]) {
      throw Error("video prompt must be specified");
    }
    const res = await createVideoOpenAi(openai, process.argv[3]);
    console.log(res.id);
    break;
  }

  case "video-check": {
    if (!process.argv[3]) {
      throw Error("video id must be specified");
    }
    const res = await checkVideoOpenAi(openai, process.argv[3]);
    console.log(res);
    break;
  }

  case "video-download": {
    if (!process.argv[3]) {
      throw Error("video id must be specified");
    }
    await downloadVideoOpenAi(openai, process.argv[3]);
    break;
  }

  case "music-gen": {
    if (!process.argv[3]) {
      throw Error("music prompt must be specified");
    }
    const res = await createMusicInstrumental(process.argv[3]);
    console.log(res);
    break;
  }

  case "music-check": {
    if (!process.argv[3]) {
      throw Error("music id must be specified");
    }
    const res = await checkMusicInstrumental(process.argv[3]);
    console.log(res);
    break;
  }

  case "models":
    console.log(await elevenlabs.models.list());
    break;

  case "voices":
    console.log(await elevenlabs.voices.getAll());
    break;

  default:
    console.log(`
Usage: npx tsx src/index.ts <command> [args]

Commands:
  openai-report [prompt]  - Generate report using OpenAI
  openai-text             - Convert report to text for reading
  blog-gemini             - Convert report to blog post
  blog-claude             - Convert report to blog post
  tts                     - Convert text to speech
  stt                     - Convert speech to text (SRT)
  combine                 - Combine audio files
  hot-coins               - Fetch hot coins from LunarCrush
  ai-topics [query]       - Fetch AI topics from LunarCrush
  models                  - List ElevenLabs models
  voices                  - List ElevenLabs voices
`);
}
