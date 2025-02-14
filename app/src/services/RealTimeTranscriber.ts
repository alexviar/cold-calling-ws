import { ClientRequest, IncomingMessage } from 'http';
import { request, RequestOptions } from 'https';

export class RealTimeTranscriber {
  private req: ClientRequest | null = null;
  private responsePromise: Promise<any> | null = null;
  private requestStarted = false;

  /**
   * Inicia la solicitud HTTPS y prepara el request para recibir datos.
   */
  start(): Promise<string> {
    this.responsePromise = new Promise((resolve, reject) => {
      const options: RequestOptions = {
        hostname: 'eastus.stt.speech.microsoft.com',
        path: '/speech/recognition/conversation/cognitiveservices/v1?language=es-ES',
        method: 'POST',
        headers: {
          'Transfer-Encoding': 'chunked',
          'Expect': '100-continue',
          'Content-Type': 'audio/wav',
          'Ocp-Apim-Subscription-Key': process.env.NODE_AZURE_SUBSCRIPTION_KEY || '',
        },
      };

      this.req = request(options, (res: IncomingMessage) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(data);
              resolve(json);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`RealTimeTranscriber HTTP Error: ${res.statusCode}`));
          }
        });
      });

      this.req.on('error', (err: any) => {
        reject(err);
      });

      this.requestStarted = true;
    });

    return this.responsePromise.then((json) => json.DisplayText);
  }

  /**
   * Escribe un chunk de audio directamente en el request.
   * @param chunk Un Uint8Array con los datos del chunk.
   */
  pushAudioChunk(chunk: Uint8Array): void {
    if (!this.requestStarted || !this.req) {
      throw new Error('La solicitud no ha sido iniciada. Llama a start() primero.');
    }
    this.req.write(chunk);
  }

  /**
   * Finaliza el request y espera la respuesta del servidor.
   * @returns Una promesa que se resuelve con la transcripción.
   */
  async getResult(): Promise<string> {
    if (!this.req) {
      throw new Error('La solicitud no ha sido iniciada. Llama a start() primero.');
    }
    this.req.end();
    if (!this.responsePromise) {
      throw new Error('La respuesta no está disponible.');
    }
    const json = await this.responsePromise;
    return json.transcription;
  }

  /**
   * Aborta la solicitud en curso.
   */
  cancel(): void {
    if (this.req) {
      this.req.destroy();
    }
  }
}
