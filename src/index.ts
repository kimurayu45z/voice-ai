import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import fs from "fs";
import { pipeline } from "stream/promises";
import { voices } from "./voices.js";

dotenv.config();

if (!process.env.ELEVENLABS_API_KEY) {
  throw Error("API key is required.");
}

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// console.log(await elevenlabs.models.list());
// console.log(await elevenlabs.voices.getAll());
// throw Error();

const res = await elevenlabs.textToSpeech.convert(
  voices.find((v) => (v.name = "Sarah"))?.voiceId!,
  {
    text: `みなさんこんにちは。本日九月二十六日、金曜日の株式市場ニュースをお伝えします。

本日の日本株市場は、前日のアメリカ株安を受けて下落しました。日経平均株価は三百九十九円安と、四日ぶりの反落です。半導体関連を中心に、これまで買われてきた銘柄に利益確定の売りが出ました。またアジア市場全体でも株価が軟調で、特に医薬品関連の株に売りが集まっています。

下落の背景には、アメリカ政府が発表した新たな関税があります。十月一日から、医薬品に百パーセント、家具やキッチン用品に五十パーセント、トラックに二十五パーセントの関税が課される見通しです。これにより輸出入企業や関連セクターへの影響が懸念されています。

さらに、アメリカの経済指標が堅調だったことから、連邦準備制度理事会による利下げ観測が後退しています。長期金利が上昇しており、資金調達コストが重くなることで、ハイテク株や人工知能関連への投資が鈍化するのではないかとの見方も出ています。

一方、資源市場では銅の価格が急騰しています。インドネシアの大型鉱山で事故が発生し、供給懸念が広がったためです。資源や素材関連の株には追い風となる可能性があります。

今後の注目点は、アメリカで発表される個人消費支出、いわゆるPCE物価指数と、連邦準備制度理事会の高官の発言です。関税の具体的な範囲や例外措置がどうなるかによっても、市場の反応が大きく変わるでしょう。

以上、本日の株式市場ニュースでした。
`,
    modelId: "eleven_v3",
  }
);

// ReadableStreamを直接ファイルに書き込み
await pipeline(res as any, fs.createWriteStream("out/output.mp3"));
console.log("音声ファイルが output.mp3 として保存されました");
