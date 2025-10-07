import type OpenAI from "openai";
import fs from "fs";

export async function createVideoOpenAi(client: OpenAI, prompt: string) {
  prompt = `{
  "Prompt": {
    "タイトル": "ナイアガラの滝で元気玉を放つ",
    "言語": "日本語",
    "長さ": "10秒",
    "シーン": [
      {
        "時間": "0s-4s",
        "内容": "壮大なナイアガラの滝の前。主人公が両手を天に掲げ、光の粒が集まってくる。",
        "セリフ": "オラに力をわけてくれ！！",
        "カメラの動き": "下から煽るように上昇し、滝と主人公の両方をダイナミックに捉える",
        "効果音": "滝の轟音とエネルギーが集まる低い唸り音",
        "雰囲気": "緊張感と高揚感に満ちたエネルギッシュな瞬間"
      },
      {
        "時間": "4s-7s",
        "内容": "空から無数の光が降り注ぎ、元気玉がどんどん大きく膨らんでいく。",
        "セリフ": "（無言で気を高め続ける）",
        "カメラの動き": "元気玉を中心に周囲を回り込むようなダイナミックなカメラワーク",
        "効果音": "エネルギーの共鳴音と滝のしぶきが混ざるサウンド",
        "雰囲気": "壮大で神秘的な高まり"
      },
      {
        "時間": "7s-10s",
        "内容": "巨大な元気玉を両手で構え、滝の光とともに放つ瞬間。",
        "セリフ": "元気玉だーーー！！",
        "カメラの動き": "正面からズームインし、放つ瞬間に強烈な閃光でフェードアウト",
        "効果音": "爆発的なエネルギー音と爽快な風の音",
        "雰囲気": "解放と達成のエネルギーに満ちたクライマックス"
      }
    ]
  }
}}`;
  const res = await client.videos.create({
    model: "sora-2",
    prompt,
  });

  return res.id;
}

export async function checkVideoOpenAi(client: OpenAI, videoId: string) {
  const res = await client.videos.retrieve(videoId);

  return res;
}

export async function downloadVideoOpenAi(client: OpenAI, videoId: string) {
  const res = await client.videos.downloadContent(videoId);

  const body = res.arrayBuffer();
  const buffer = Buffer.from(await body);

  fs.writeFileSync("out/video.mp4", buffer);
}
