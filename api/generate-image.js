let jobs = {}; // store jobId -> result

// Simple unique ID generator (not cryptographically secure, but good enough for job IDs)
function generateJobId() {
  return (
    Math.random().toString(36).substring(2, 10) +
    Date.now().toString(36)
  );
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    // Start job
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    const jobId = generateJobId();
    jobs[jobId] = { status: 'pending' };

    // Start OpenAI call async (don’t await here)
    (async () => {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (!openaiResponse.ok) {
          jobs[jobId] = { status: 'error', error: await openaiResponse.text() };
          return;
        }

        const data = await openaiResponse.json();
        const reply = data.choices?.[0]?.message?.content || 'No reply';

        jobs[jobId] = { status: 'done', reply };
      } catch (err) {
        jobs[jobId] = { status: 'error', error: err.message };
      }
    })();

    // Immediately respond with jobId
    res.status(202).json({ jobId });
  }
  else if (req.method === 'GET') {
    // Check job status: expect jobId as query param
    const { jobId } = req.query;
    if (!jobId) return res.status(400).json({ error: 'No jobId provided' });

    const job = jobs[jobId];
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.status(200).json(job);
  }
  else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}

