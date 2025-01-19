import http from 'https';
import { pdfContext } from './data';
import { systemInstruction, textData } from './textData';

export class GenAiService {

  private history: any[] = [{
    // "parts": [
    //   {
    //     "inline_data": {
    //       "mime_type": "application/pdf",
    //       "data": pdfContext
    //     }
    //   }
    // ],
    // "role": "user"

    "parts": [
      {
        "inline_data": {
          "mime_type": "text/plain",
          "data": Buffer.from(textData).toString('base64')
        }
      }
    ],
    "role": "user"
  }];
  private pendingRequest!: Promise<string>;
  private finalizeRequest!: (text: string) => void;

  constructor() {
    this.initialize()
  }

  private initialize() {
    this.pendingRequest = new Promise((resolve, reject) => {
      const url = new URL('https://generativelanguage.googleapis.com');
      url.pathname = '/v1beta/models/gemini-1.5-flash:generateContent';
      url.searchParams.append('key', process.env.GOOGLE_API_KEY!);

      const req = http.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(data);
            return;
          }
          const response = JSON.parse(data);
          const content = response.candidates[0].content;
          this.history.push(content);
          resolve(content.parts[0].text);
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      const body = JSON.stringify({
        "system_instruction": {
          "parts": {
            "text": systemInstruction
          }
        },
        "contents": this.history
      })
      req.write(body.substring(0, body.length - 2));

      this.finalizeRequest = (text: string) => {
        console.log("History length", this.history.length)
        this.history.push({
          "parts": [
            {
              "text": text
            }
          ],
          "role": "user"
        })
        const body = JSON.stringify({
          "parts": [
            {
              "text": text
            }
          ],
          "role": "user"
        })
        req.write("," + body + "]}");
        req.end()
      }

    })
  }

  generateResponse(text: string): Promise<string> {
    this.finalizeRequest(text);
    const pendingRequest = this.pendingRequest
    this.initialize()
    return pendingRequest
  }
}