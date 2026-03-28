import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

export async function analyzeJob(job: any) {
  try {
    const res = await client.messages.create({
      model: "claude-3-haiku-20241022",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Return ONLY JSON:
{
  "score": number,
  "relevant": boolean
}

Job:
${job.title}
${job.company_name}
${job.description?.slice(0, 200)}
`,
        },
      ],
    });

    const textContent = res.content?.[0];
    const text = textContent && textContent.type === "text" ? textContent.text : "";

    console.log("AI RAW:", text);

    return JSON.parse(text);
  } catch (err: any) {
    console.error("AI ERROR FULL:", err);
    return { score: 0, relevant: false };
  }
}
