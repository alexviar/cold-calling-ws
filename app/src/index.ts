import dotenv from 'dotenv';
import http from 'http';
import websocketServer from './websocket/server';
import app from './app';

dotenv.config();

// Configura el servidor HTTP
const server = http.createServer(app);

// Inicializa el servidor WebSocket
websocketServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
