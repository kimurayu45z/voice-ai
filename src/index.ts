import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import OpenAI from "openai";
import { textToSpeech } from "./tts.js";
import { createTextToRead } from "./prompt.js";
import { mcp } from "./template.js";

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

// await createTextToRead(
//   openai,
//   mcp,
//   "今日の株式市場のニュースを調べて、アナウンサーが読む台本にして。"
// );

await textToSpeech(elevenlabs);
