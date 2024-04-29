import bodyParser from 'body-parser';
import axios from 'axios';

import express from 'express';

const app = express();
const PORT = 8080;

const chunkData = (data: any) => {
  const chunks: string[] = [];
  for (const str of data) {
    const chunkSize = Buffer.byteLength(str, 'utf8').toString(16);
    chunks.push(`${chunkSize}\n`);
    chunks.push(`data: ${str}\n\n`);
  }
  chunks.push(`0\n\n`); // End of stream
  return chunks;
}

const ollamaGenerate = async (model: string, prompt: string) => {
  try {
    const response = await axios({
      method: 'post',
      url: 'http://127.0.0.1:11434/api/generate',
      data: { model, prompt, stream: false, raw: true },
    });
    return response.data;

  } catch (error: unknown) {
    console.log('Ollama generation failed', error);
    throw new Error('Ollama generation failed');
  }
};

app.use(bodyParser.json());
app.post('/v1/completions', async (req, res) => {
  console.log('Starting ollama generation');
  const response = await ollamaGenerate(
    'codellama:code',
    `${req.body.prompt}`
  );
  console.log('Finished ollama generation', response.response);

  res.set('Content-Type', 'text/event-stream');
  res.set('Transfer-Encoding', 'chunked');

  const data = [
    JSON.stringify({
      "id": "abcd-123456789",
      "object": "text_completion",
      "created": new Date(response.created_at).getTime(),
      "model": "gpt-3.5-turbo-instruct",
      "choices": [
        {
          "text": `${response.response.replace('<EOT>', '')}`,
          "index": 0,
          "logprobs": null,
          "finish_reason": "stop"
        }
      ],
      "usage": {
        "prompt_tokens": 6,
        "completion_tokens": 6,
        "total_tokens": 12
      }
    })
  ];

  for (const chunk of chunkData(data)) {
    res.write(chunk);
  }

  res.end();
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
