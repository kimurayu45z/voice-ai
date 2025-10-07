export async function getAiNews() {
  const res = await fetch(
    "https://api.apitube.io/v1/news/everything?language.code=en&topic.id=industry.ai_news",
    {
      headers: {
        Authorization: `Bearer ${process.env.APITUBE_API_KEY}`,
      },
    }
  );

  return await res.json();
}
