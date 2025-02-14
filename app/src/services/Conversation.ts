import { ClientRequest, IncomingMessage } from 'http';
import { request, RequestOptions } from 'https';

export class Conversation {
  private req: ClientRequest | null = null;
  private history: any[];

  /**
   * @param instructions Instrucciones o configuración inicial.
   * @param context Objeto con el MIME type y los datos (en Buffer) a incluir en el historial.
   */
  constructor(
    private instructions: string,
    context: { mimeType: string; data: Buffer } | null
  ) {
    this.history = context ? [
      {
        parts: [
          {
            inline_data: {
              mime_type: context.mimeType,
              data: context.data.toString('base64'),
            },
          },
        ],
        role: "user",
      },
    ] : [];
  }

  /**
   * Envía un mensaje diferido. Se escribe el cuerpo del request de forma progresiva:
   * primero se envía el inicio del JSON (con las instrucciones y el historial inicial)
   * y luego, cuando se resuelve el mensaje diferido, se agrega el mensaje y se cierra el JSON.
   *
   * @param deferredMessage Una promesa que se resolverá con el mensaje a enviar.
   * @returns Una promesa que se resuelve con la respuesta del servidor.
   */
  sendDeferredMessage(deferredMessage: Promise<string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const apiKey = process.env.GOOGLE_API_KEY || '';
      if (!apiKey) {
        return reject(new Error('Falta la variable de entorno GOOGLE_API_KEY'));
      }

      const url = new URL('https://generativelanguage.googleapis.com');
      url.pathname = '/v1beta/models/gemini-1.5-flash:generateContent';
      url.searchParams.append('key', process.env.GOOGLE_API_KEY!);

      const options: RequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      this.req = request(url, options, (res: IncomingMessage) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(data);
              // Se asume que la respuesta tiene la propiedad "candidates"
              const candidates = json.candidates;
              if (candidates && candidates.length > 0) {
                const historyEntry = candidates[0].content;
                this.history.push(historyEntry);
                console.dir(this.history, { depth: null })
                resolve(historyEntry.parts[0].text);
              } else {
                reject(new Error('No se encontraron candidatos en la respuesta.'));
              }
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`HTTP Error: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      this.req.on('error', (err: any) => {
        reject(err);
      });

      // Construir el inicio del payload.
      // Se genera el JSON con las instrucciones y el historial y se remueven los dos últimos caracteres ("]}")
      // para dejar el array "contents" abierto y poder agregar el mensaje diferido.
      let payloadStart = JSON.stringify({
        system_instruction: { parts: { text: this.instructions } },
        contents: this.history,
      });
      payloadStart = payloadStart.slice(0, -2); // Remueve el cierre final

      // Escribimos el inicio del JSON directamente en el request.
      this.req.write(payloadStart);

      // Cuando se resuelva el mensaje diferido, se agrega al JSON y se cierra.
      deferredMessage
        .then((message) => {
          if (!this.req) return;
          console.log('Mensaje diferido:', message);
          if (!message) {
            this.req.destroy();
            return reject(new Error('Solicitud cancelada: mensaje vacío'));
          }
          // Si ya hay elementos en "contents", se agrega una coma antes del nuevo mensaje.
          const separator = this.history.length > 0 ? ',' : '';
          const userEntry = {
            "parts": [
              {
                "text": message
              }
            ],
            "role": "user"
          }
          this.history.push(userEntry);
          const messageJson = separator + JSON.stringify(userEntry) + "]}";
          this.req.write(messageJson);
          this.req.end();
        })
        .catch((err) => {
          if (this.req) {
            this.req.destroy();
          }
          reject(err);
        });
    });
  }
}
