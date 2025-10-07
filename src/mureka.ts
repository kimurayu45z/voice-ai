export async function createMusicInstrumental(prompt: string) {
  const res = await fetch("https://api.mureka.ai/v1/instrumental/generate", {
    headers: {
      Authorization: `Bearer ${process.env.MUREKA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mureka-7.5",
      prompt,
    }),
    method: "POST",
  });

  return await res.json();
}

export async function checkMusicInstrumental(musicId: string) {
  const res = await fetch(
    `https://api.mureka.ai/v1/instrumental/query/${musicId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.MUREKA_API_KEY}`,
      },
    }
  );

  return await res.json();
}
