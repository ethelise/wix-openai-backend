export default async function handler(req, res) {
  // Allow requests from any origin (for now)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'No message provided' });
    }

    // Call OpenAI API here — example with fetch or your preferred method
    // Replace with your OpenAI key from environment variables
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      return res.status(openaiResponse.status).json({ error: errorText });
    }

    const data = await openaiResponse.json();
    const reply = data.choices?.[0]?.message?.content || 'No reply from OpenAI';

    res.status(200).json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
