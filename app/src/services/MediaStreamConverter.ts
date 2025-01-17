import { spawn } from 'child_process';

export class MediaStreamConverter {
  protected ffmepgProcess

  constructor(onData: (data: Buffer) => void, onClose: () => void) {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'g729', // Formato de entrada
      '-i', 'pipe:0', // Leer desde stdin
      '-ar', '8000', // Frecuencia de muestreo de salida
      '-ac', '1', // Mono
      '-f', 'wav', // Formato de salida

      //silent mode
      '-hide_banner',
      '-loglevel', 'error',

      'pipe:1', // Escribir en stdout
    ]);

    ffmpeg.stdout.on('data', (data) => {
      // Llama al callback con los datos procesados
      onData(data);
    });

    ffmpeg.stderr.on('data', (data) => {
      console.error(`FFmpeg error: ${data}`);
    });

    ffmpeg.on('close', () => {
      onClose()
    });

    this.ffmepgProcess = ffmpeg;
  }

  write(buffer: Buffer) {
    this.ffmepgProcess.stdin.write(buffer);
  }

  end() {
    this.ffmepgProcess.stdin.end();
  }
}

