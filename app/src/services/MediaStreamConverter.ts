import { spawn } from 'child_process';

export class MediaStreamConverter {
  protected ffmepgProcess

  constructor(onData: (data: Buffer) => void, onClose: () => void) {
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'g729', // Formato de entrada
      '-i', 'pipe:0', // Leer desde stdin
      '-ar', '8000', // Frecuencia de muestreo de salida
      '-ac', '1', // Mono
      '-f', 's16le', //Formato PCM sin firmar

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

    // onData(this.generateWavHeader())

    this.ffmepgProcess = ffmpeg;
  }

  generateWavHeader() {
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

  write(buffer: Buffer) {
    this.ffmepgProcess.stdin.write(buffer);
  }

  end() {
    this.ffmepgProcess.stdin.end();
  }
}

