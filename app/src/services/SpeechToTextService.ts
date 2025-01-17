
import { ClientRequest } from 'http';
import http from 'https';

export class SpeechToTextService {
  private pendingRequest: ReturnType<typeof createSpeechToTextPendingRequest>

  constructor(onTranscript: (transcript: string) => void) {
    this.pendingRequest = createSpeechToTextPendingRequest()
    this.pendingRequest.then(onTranscript)
  }

  write(data: Buffer) {
    this.pendingRequest.write(data)
  }

  end() {
    this.pendingRequest.end()
  }
}

export function createSpeechToTextPendingRequest() {

  let req: ClientRequest
  const pendingRequest = new Promise<string>((resolve, reject) => {
    const options = {
      hostname: 'eastus.stt.speech.microsoft.com',
      // port: 443,
      path: '/speech/recognition/conversation/cognitiveservices/v1?language=es-ES',
      method: 'POST',
      // search: "",
      headers: {
        'Transfer-Encoding': 'chunked',
        'Expect': '100-continue',
        'Content-Type': 'audio/wav', // Cambia según el tipo de contenido que envíes
        "Ocp-Apim-Subscription-Key": process.env.NODE_AZURE_SUBSCRIPTION_KEY
      },
    };

    req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) resolve('')
        try {

          resolve(JSON.parse(data).DisplayText);
        }
        catch (e) {
          console.log('Error en la transcripción', e);
          resolve('');
        }
      });
    });

    // Manejar errores
    req.on('error', (error) => {
      console.error(`Error en la solicitud: ${error.message}`, error);
      reject(error)
    });
  })

  return {
    write(chunk: Buffer) {
      req.write(chunk)
    },
    end() {
      req.end()
    },
    then(next: (text: string) => void) {
      pendingRequest.then(next)
    }
  };
}