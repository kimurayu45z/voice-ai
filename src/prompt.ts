import type OpenAI from "openai";
import fs from "fs";

export async function createReport(
  client: OpenAI,
  systemPrompt: string,
  prompt: string
) {
  const resp = await client.responses.create({
    model: "gpt-5-2025-08-07",
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  fs.writeFileSync("out/report.md", resp.output_text);
}

export async function createTextToRead(client: OpenAI) {
  const report = fs.readFileSync("out/report.md");

  const resp2 = await client.responses.create({
    model: "gpt-5-2025-08-07",
    input: [
      {
        role: "user",
        content: `
以下は、AIが作ったレポート。これを、読み上げる台本にしたい。
マークダウン用の記号とか、括弧や、リファレンスURL、「以上、台本でした」と言った文言など、台本としてふさわしくない要素を取り除いて、プレーンテキストとして出力してください。
そのまま出力をプログラムで音声化APIに使いたいので、セクションごとのタイトルとかも要りません。台本のみ出力してください。

\`\`\`
${report}
\`\`\`
`,
      },
    ],
  });

  fs.writeFileSync("out/speech.txt", resp2.output_text);
}
