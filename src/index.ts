import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { combineAudioFiles, textToSpeech } from "./tts.js";
import { GoogleGenAI } from "@google/genai";
import {
  createReportOpenAi,
  createTextBlogGemini,
  createTextToReadOpenAi,
} from "./prompt.js";
import { crypto, mcp, yuukiHarumi } from "./template.js";
import { fetchAiTopics, fetchHotCoins } from "./lunarcrush.js";
import * as fs from "fs";

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

// console.log(await elevenlabs.models.list());
// console.log(await elevenlabs.voices.getAll());
// throw Error();

// await createReport(
//   openai,
//   yuukiHarumi,
//   "今日の株式市場ニュースを調べて台本を作って。"
// );
// await createTextToRead(openai);

// await textToSpeech(elevenlabs);
// await combineAudioFiles();

// const json = await fetchHotCoins();
// fs.writeFileSync("out/hot-coins.json", JSON.stringify(json, undefined, 2));

const text = await fetchAiTopics("metamask");
fs.writeFileSync("out/report.md", text);

await createTextBlogGemini(gemini);
