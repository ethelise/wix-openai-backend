let jobs = {}; // Store jobId -> { status, imageUrl, error }

function generateJobId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

module.exports = async function handler(req, res) {
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

    (async () => {
      try {
        // Step 1: Generate image with OpenAI
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
            output_format: 'jpeg', // corrected property name from output_format
            quality: 'medium'
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
        console.log("Uploading base64:", base64Image.slice(0, 30)); // just first part
        // Step 2: Upload to Cloudinary
        const publicId = '0e336c68-ccc6-49ca-8690-d57e031ccd54'; // your chosen ID
        const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/djsc8h3ra/image/upload`, {
          method: 'POST',
          body: new URLSearchParams({
            file: `data:image/jpeg;base64,${base64Image}`,
            upload_preset: 'unsigned_preset',
            public_id: publicId,
          }),
        });

        const cloudinaryData = await cloudinaryResponse.json();
        console.log('Cloudinary response:', cloudinaryData);

        if (!cloudinaryData.secure_url) {
          jobs[jobId] = { status: 'error', error: 'Failed to upload to Cloudinary' };
          return;
        }

        jobs[jobId] = { status: 'done', imageUrl: cloudinaryData.secure_url };

      } catch (err) {
        jobs[jobId] = { status: 'error', error: err.message || 'Unknown error' };
      }
    })();

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
};
