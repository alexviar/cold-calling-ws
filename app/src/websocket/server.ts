import { Server as HTTPServer, IncomingMessage } from 'http';
import fs from 'fs'
import { parse } from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import { ConversationService } from '../services/ConversationService';
import path from 'path';
import { AudioCodec } from '../services/MediaStreamConverter';
import { systemInstruction, textData } from '../services/textData';
import { Agent } from '../services/Agent';

const codecMap: Record<string, AudioCodec> = {
  'g729': 'g729',
  'g722': 'g722',
  'pcmu': 'mulaw',
  'pcma': 'alaw'
};

function websocketServer(server: HTTPServer): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('Cliente conectado', parse(req.url || '', true).query);
    const urlParams = parse(req.url || '', true).query
    const campaign_id = urlParams['campaign_id']

    let campaign: any = null;
    console.log(`${process.env.API_URL}/campaigns/${campaign_id}`)
    let pendingTask = fetch(`${process.env.API_URL}/campaigns/${campaign_id}`, {
      headers: {
        'Accept': 'application/json',
      }
    })
      .then(response => response.json())
      .then(data => {
        campaign = data
        console.log(campaign)
      })
    // .catch(error => {
    //   console.error('Error fetching campaign:', error);
    //   ws.close()
    // })

    let conversationService: Agent

    try {
      const greetingsPath = path.join(__dirname, '..', 'assets', 'greetings.mp3');
      const greetings = fs.readFileSync(greetingsPath, { encoding: 'base64' });
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          payload: greetings
        }
      }));
    } catch (error) {
      console.error('Error loading greetings.mp3:', error);
      console.log('Attempted path:', path.join(__dirname, '..', 'assets', 'greetings.mp3'));
    }

    ws.on('open', () => {
      console.log('Conection open')
    })

    // Escucha mensajes del cliente
    ws.on('message', (message: string) => {
      // console.log("Message receibed", String(message))
      pendingTask = pendingTask.then(() => {

        const event = JSON.parse(message);
        if (event.event == 'start') {
          const { channels, encoding, sample_rate } = event.start.media_format
          conversationService = new Agent(
            event.stream_id,
            campaign.prompt,
            {
              mimeType: 'text/plain',
              data: Buffer.from(campaign.information)
            },
            { numChannels: channels, encoding: codecMap[(encoding as string).toLowerCase()], sampleRate: sample_rate },
          )
          conversationService.onResponse((payload: Buffer) => {
            ws.send(JSON.stringify({
              event: 'media',
              media: {
                payload: payload.toString('base64')
              }
            }))
          })
        } else if (event.event == 'media') {
          if (event.media.payload == 'QQA=') {
            console.log('Skipping QQA= Media payload')
            return;
          }
          const buffer = Buffer.from(event.media.payload, 'base64');
          conversationService!.writeAudioStream(buffer);
        }
        else if (event.event == 'stop') {
          // mediaCoverter.end();
        }
      })
    });

    // Maneja la desconexión del cliente
    ws.on('close', () => {
      console.log('Cliente desconectado');
    });
  });

  console.log('Servidor WebSocket inicializado');
}

export default websocketServer;
