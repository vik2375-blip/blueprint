const SYSTEM_PROMPT = `You are an expert Project Manager assistant. Convert messy input (kickoff call
notes, scope discussions, email threads) into a structured Work Breakdown
Structure suitable for building a Microsoft Project schedule.

Output ONLY valid JSON, no markdown code fences, no preamble, no closing
remarks, matching EXACTLY this shape:

{
  "projectTitle": "string",
  "phases": [
    {
      "phaseName": "string",
      "tasks": [
        {
          "id": 1,
          "name": "string",
          "durationDays": 5,
          "predecessors": [],
          "milestone": false,
          "resourceRole": "string or null"
        }
      ]
    }
  ]
}

RULES:
- IDs are unique whole numbers, sequential across the ENTIRE project (not
  reset per phase), starting at 1.
- A task's predecessors array must only reference ids that are numerically
  LOWER than its own id (i.e. earlier tasks). Never reference a later id.
- durationDays is a whole number of working days. Use 0 only for milestones.
- Group tasks under logical phases based on what's discussed in the input.
- Infer reasonable durations when the input gives clues; otherwise use
  typical estimates for that kind of task. Do not explain your estimates.
- Do not invent scope beyond what is discussed in the input.
- Keep task names concise and actionable (start with a verb where natural).
- Output ONLY the JSON object, nothing else.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessCode = req.headers['x-access-code'];
  if (!process.env.ACCESS_CODE || accessCode !== process.env.ACCESS_CODE) {
    return res.status(401).json({ error: 'Invalid or missing access code.' });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Missing "text" in request body.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(response.status).json({ error: `Anthropic API error: ${errBody}` });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    let resultText = textBlock ? textBlock.text : '';
    resultText = resultText.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();

    return res.status(200).json({ result: resultText });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
