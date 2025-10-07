export async function getAiNewsNewsApi() {
  const res = await fetch(
    `https://newsapi.org/v2/everything?q=ai&apiKey=${process.env.NEWSAPI_API_KEY}`
  );

  return await res.json();
}
