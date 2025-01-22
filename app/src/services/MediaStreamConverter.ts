import { spawn } from 'child_process';
import { generarCadenaAleatoria } from './ConversationService';
import { FileAppender } from '../utils/FileAppender';

export type AudioCodec = 'g729' | 'g722' | 'mulaw' | 'alaw';

export class MediaStreamConverter {
  protected ffmepgProcess

  constructor({ onData, onClose, mediaFormat }: {
    onData: (data: Buffer) => void,
    onClose: () => void,
    mediaFormat: { encoding: AudioCodec, sampleRate: number, numChannels: number }
  }) {
    console.log(mediaFormat)
    const outputFilename = generarCadenaAleatoria(40) + '.wav'
    console.log('Output', outputFilename)
    const fileAppender = new FileAppender('data/' + outputFilename);
    fileAppender.append(this.generateWavHeader())

    const ffmpegArgs = [
      '-f', mediaFormat.encoding, // Formato de entrada
      '-ar', String(mediaFormat.sampleRate), // Frecuencia de muestreo de entrada
      '-ac', String(mediaFormat.numChannels), // Canales
      '-i', 'pipe:0',             // Leer desde stdin
      '-ar', String(mediaFormat.sampleRate), // Frecuencia de muestreo de salida
      '-ac', String(mediaFormat.numChannels), // Canales
      '-f', 's16le',              // Formato PCM sin firmar
      '-hide_banner',             // Modo silencioso
      '-loglevel', 'error',       // Nivel de registro
      'pipe:1',                   // Escribir en stdout
    ];

    // Ajustar dinámicamente los parámetros según el códec
    if (mediaFormat.encoding === 'g729') {
      // G.729 no requiere `-ar` ni `-ac`
      ffmpegArgs.splice(2, 4); // Elimina `-ar` y `-ac` de la lista
    }
    console.log(ffmpegArgs)

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stdout.on('data', (data) => {
      // Llama al callback con los datos procesados
      fileAppender.append(data)
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

