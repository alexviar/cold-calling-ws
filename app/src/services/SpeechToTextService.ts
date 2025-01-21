
import { ClientRequest } from 'http';
import http from 'https';
import { FileAppender } from '../utils/FileAppender';

function generarCadenaAleatoria(longitud = 10) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let resultado = '';
  for (let i = 0; i < longitud; i++) {
    const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
    resultado += caracteres[indiceAleatorio];
  }
  return resultado;
}

function generateWavHeader() {
  const numChannels = 1,
    sampleRate = 8000,
    bitsPerSample = 16

  const byteRate = sampleRate * numChannels * bitsPerSample / 8
  const blockAlign = numChannels * bitsPerSample / 8
  const header = Buffer.alloc(44)

  header.write('RIFF', 0)
  header.writeUInt32LE(0Xffffffff, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(0xffffffff, 40)

  return header
}

export class SpeechToTextService {
  private pendingRequest: ReturnType<typeof createSpeechToTextPendingRequest>
  public key = Math.random()
  userInputFilename: string;
  fileAppender: FileAppender;

  constructor(onTranscript: (transcript: string) => void) {
    this.pendingRequest = createSpeechToTextPendingRequest()
    this.pendingRequest.then(onTranscript)

    this.userInputFilename = generarCadenaAleatoria(40) + '.wav'
    this.fileAppender = new FileAppender('data/' + this.userInputFilename);

    const wavHeader = generateWavHeader()
    this.pendingRequest.write(wavHeader)
    this.fileAppender.append(wavHeader);
  }

  write(data: Buffer) {
    this.fileAppender.append(data)
    this.pendingRequest.write(data)
  }

  end() {
    console.log("Client says", this.userInputFilename)
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
        if (res.statusCode !== 200) {
          reject(res.statusMessage);
          return;
        }
        try {
          resolve(JSON.parse(data).DisplayText);
        }
        catch (e: any) {
          reject(e);
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
      pendingRequest.then(next).catch(console.error)
    }
  };
}