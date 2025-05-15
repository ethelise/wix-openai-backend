let jobs = {}; // Store jobId -> { status, imageBase64, error }

function generateJobId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

    const jobId = generateJobId();
    jobs[jobId] = { status: 'pending' };

    // Start async image generation
    (async () => {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            output_format: 'jpeg',
            quality: 'low'
          }),
        });

        if (!openaiResponse.ok) {
          jobs[jobId] = { status: 'error', error: await openaiResponse.text() };
          return;
        }

        const data = await openaiResponse.json();
        const base64Image = data.data?.[0]?.b64_json;

        if (!base64Image) {
          jobs[jobId] = { status: 'error', error: 'No image returned from OpenAI' };
          return;
        }

        jobs[jobId] = { status: 'done', imageBase64: base64Image };
      } catch (error) {
        jobs[jobId] = { status: 'error', error: error.message || 'Unknown error' };
      }
    })();

    // Return jobId immediately for polling
    res.status(202).json({ jobId });
  }
  else if (req.method === 'GET') {
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
