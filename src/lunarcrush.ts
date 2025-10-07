export const topics = [
  "coins defi",
  "coins ai",
  "coins real world assets",
  "coins depin",
  "coins ai agents",
  "coins sui",
  "stablecoins",
  "coins",
] as const;

export type Topic = (typeof topics)[number];

export async function fetchCoinTopics(): Promise<{ data: { name: string }[] }> {
  const response = await fetch(
    `https://lunarcrush.com/api4/public/coins/list/v1?sort=social_volume_24h`,
    {
      headers: {
        Authorization: `Bearer ${process.env.LUNARCRUSH_API_KEY}`,
      },
    }
  ).then((res) => res.json());

  return response;
}

export async function fetchCoinTopic(topic: string): Promise<string> {
  const response = await fetch(`https://lunarcrush.ai/topic/${topic}`, {
    headers: {
      Authorization: `Bearer ${process.env.LUNARCRUSH_API_KEY}`,
    },
  }).then((res) => res.text());

  return response;
}
