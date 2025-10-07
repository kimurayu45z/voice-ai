import type OpenAI from "openai";
import type { GoogleGenAI } from "@google/genai";
import fs from "fs";

export async function createReportOpenAi(
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

export async function createTextToReadOpenAi(client: OpenAI) {
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

export async function createReportGemini(
  client: GoogleGenAI,
  systemPrompt: string,
  prompt: string,
  filePath: string
) {
  const response = await client.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: systemPrompt,
      tools: [{ googleSearch: {} }],
    },
  });
  const text = response.text || "";

  fs.writeFileSync(filePath, text);
}

export async function createTextToReadGemini(client: GoogleGenAI) {
  const report = fs.readFileSync("out/report.md", "utf-8");

  await createReportGemini(
    client,
    "",
    `
以下は、AIが作ったレポート。これを、読み上げる台本にしたい。
マークダウン用の記号とか、括弧や、リファレンスURL、「以上、台本でした」と言った文言など、台本としてふさわしくない要素を取り除いて、プレーンテキストとして出力してください。
そのまま出力をプログラムで音声化APIに使いたいので、セクションごとのタイトルとかも要りません。台本のみ出力してください。

\`\`\`
${report}
\`\`\`
`,
    "out/speech.txt"
  );
}

export async function createTextBlogGemini(client: GoogleGenAI) {
  const report = fs.readFileSync("out/report.md", "utf-8");

  await createReportGemini(
    client,
    "そのまま出力をプログラムでブログにポストしたいので、「承知しました」等も要りません。",
    `
以下は、AIが作ったレポート。これを、ファクトチェックしながら日本語のブログ記事にしてほしい。
ファクトチェックした事実や、このレポートの存在をユーザーは知らなくていいことに注意せよ。

\`\`\`
${report}
\`\`\`
`,
    "out/blog.md"
  );
}
