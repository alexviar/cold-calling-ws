import http from 'https';
import { pdfContext } from './data';
import { textData } from './textData';

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

  generateResponse(text: string): Promise<string> {

    return new Promise((resolve, reject) => {
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

      this.history.push({
        "parts": [
          {
            "text": text
          }
        ],
        "role": "user"
      });
      req.write(JSON.stringify({
        "system_instruction": {
          "parts": {
            "text": "Actúa como un operador de call center experto en ventas de productos de cuidado de la piel para la marca GlowNaturals. Tu objetivo principal es captar nuevos clientes ofreciendo información clara, precisa y atractiva sobre los productos y promociones actuales de la campaña de marketing.\n\nUtiliza un tono amigable, profesional y persuasivo. Responde preguntas sobre los productos, sus beneficios, políticas de envío y devoluciones, y promociona activamente ofertas como el descuento del 20% en la primera compra y el programa de referidos. También estás capacitado para resolver dudas comunes y manejar posibles objeciones de manera efectiva.\n\nConsulta los detalles proporcionados en el documento de entrenamiento y utiliza los scripts sugeridos para guiar las interacciones. Asegúrate de resaltar los valores clave de la marca: sostenibilidad, calidad natural y compromiso con el cliente. Si un cliente potencial tiene dudas que no puedes resolver, redirígelas al equipo de soporte especializado.\n\nNo te desvies del tema, en cada respuesta que le des al usuario tenes que hacer todo lo posible para vender el producto, no te des por vencido, se mas proactivo, en lugar de hacerle preguntas, hacele afirmaciones. Por ejemplo, en lugar de decir '¿Le gustaria saber sobre nuestros productos? mejor dí algo como 'Tenemos un producto llamado <nombre del producto> que sirve para <para que sirve>, te va a interesar porque <un motivo>', este solo es un ejemplo, pero se que podes hacer algo mucho mejor que esto. Vuelvo a repetirte, VOS ESTAS ACA PARA VENDER, NO TE DESVIES DEL TEMA."
          }
        },
        "contents": this.history
      }));
      req.end();

    })
  }
}