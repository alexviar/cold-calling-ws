import http from 'https'

export class SpeechSynthesizer {
  synthesize(text: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {

      const url = new URL('https://eastus.tts.speech.microsoft.com/cognitiveservices/v1');

      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-32kbitrate-mono-mp3',
          "Ocp-Apim-Subscription-Key": process.env.NODE_AZURE_SUBSCRIPTION_KEY,
          'User-Agent': 'ColdCallingBot'
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(res.statusMessage);
            return;
          }
          const audioData = Buffer.concat(chunks);
          resolve(audioData);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(`<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-MX'><voice name='es-MX-DaliaNeural' style="friendly">${text}</voice></speak>`);
      req.end();
    })
  }
}