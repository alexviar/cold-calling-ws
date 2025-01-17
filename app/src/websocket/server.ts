import { Server as HTTPServer, IncomingMessage } from 'http';
import { parse } from 'url';
import WebSocket, { WebSocketServer } from 'ws';
import { ConversationService } from '../services/ConversationService';

const fs = require('fs')


function websocketServer(server: HTTPServer): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    console.log('Cliente conectado', parse(req.url || '', true).query);

    let conversationService = new ConversationService((payload: Buffer) => {
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          payload: payload.toString('base64')
        }
      }))
    })

    ws.on('open', () => {
      console.log('Conection open')
    })

    // Escucha mensajes del cliente
    ws.on('message', (message: string) => {
      // console.log("Message receibed", String(message))

      const event = JSON.parse(message);
      if (event.event == 'media') {
        const buffer = Buffer.from(event.media.payload, 'base64');
        if (buffer.length !== 20) {
          console.log('Media payload length is not 20')
          return;
        }
        conversationService.write(buffer, Number(event.media.timestamp));
      }
      else if (event.event == 'stop') {
        // mediaCoverter.end();
      }
    });

    // Maneja la desconexión del cliente
    ws.on('close', () => {
      console.log('Cliente desconectado');
    });
  });

  console.log('Servidor WebSocket inicializado');
}

export default websocketServer;
