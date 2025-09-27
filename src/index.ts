import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { combineAudioFiles, textToSpeech } from "./tts.js";
import { createReport, createTextToRead } from "./prompt.js";
import { crypto, mcp, yuukiHarumi } from "./template.js";

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

// console.log(await elevenlabs.models.list());
// console.log(await elevenlabs.voices.getAll());
// throw Error();

// await createReport(
//   openai,
//   crypto,
//   "Binance CZが関わるASTERに関するニュースを調べてブログ記事を作って。"
// );
// await createTextToRead(openai);

await textToSpeech(elevenlabs);
await combineAudioFiles();
