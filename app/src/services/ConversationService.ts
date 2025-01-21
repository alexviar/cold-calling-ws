import fs from "fs";
import { GenAiService } from "./GenAiService";
import { AudioCodec, MediaStreamConverter } from "./MediaStreamConverter";
import { SpeechToTextService } from "./SpeechToTextService";
import { TextToSpeechService } from "./TextToSpeechService";
import { VADProcessor } from "./VADProcessor";
import { FileAppender } from "../utils/FileAppender";

function generarCadenaAleatoria(longitud = 10) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let resultado = '';
  for (let i = 0; i < longitud; i++) {
    const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
    resultado += caracteres[indiceAleatorio];
  }
  return resultado;
}

interface VoiceBuffer {
  chunks: Buffer[];
  totalDuration: number;
}

export class ConversationService {
  private mediaStreamConverter: MediaStreamConverter
  private genAiService: GenAiService
  private vadProcessor: VADProcessor
  private responseHandler: (response: Buffer) => void
  private startSpeakingHandler!: () => void
  private userIsSpeaking: boolean = false
  private voiceBuffer: VoiceBuffer | null = null;
  private readonly MIN_VOICE_DURATION = 500; // milliseconds

  constructor({ onResponse, mediaFormat }: { mediaFormat: { numChannels: number, encoding: AudioCodec, sampleRate: number }, onResponse: (response: Buffer) => void }) {
    this.responseHandler = onResponse
    // fs.writeFile('data/output.wav', this.mediaStreamConverter.generateWavHeader(), () => { });
    this.genAiService = new GenAiService()
    this.vadProcessor = new VADProcessor();

    // let userInputFilename = generarCadenaAleatoria(40) + '.wav'
    // let fileAppender = new FileAppender('data/' + userInputFilename);
    let stsPipe = this._prepareSpeechToSpeechPipe()

    this.mediaStreamConverter = new MediaStreamConverter({
      mediaFormat,
      onData: (data) => {
        // fileAppender.append(data);
        // return
        const pcmData = new Int16Array(data.buffer);
        const isSpeaking = this.vadProcessor.processAudio(pcmData, 8000);
        const chunkDuration = (data.buffer.byteLength / 16); // ms

        if (isSpeaking) {
          if (!this.voiceBuffer) {
            this.voiceBuffer = {
              chunks: [],
              totalDuration: 0
            };
          }

          this.voiceBuffer.chunks.push(data);
          this.voiceBuffer.totalDuration += chunkDuration;

          // If we pass threshold, process buffered chunks
          if (!this.userIsSpeaking && this.voiceBuffer.totalDuration >= this.MIN_VOICE_DURATION) {
            this.userIsSpeaking = true;
            this.startSpeakingHandler?.()
            // Process buffered chunks
            const mergedChunks = Buffer.concat(this.voiceBuffer.chunks);
            stsPipe.write(mergedChunks)
            // fileAppender.append(mergedChunks);
          } else if (this.userIsSpeaking) {
            // Already validated voice, process directly
            stsPipe.write(data);
            // fileAppender.append(data);
          }
        } else if (this.userIsSpeaking) {
          this.userIsSpeaking = false;
          this.voiceBuffer = null;
          stsPipe.end()
          stsPipe = this._prepareSpeechToSpeechPipe();

          // userInputFilename = generarCadenaAleatoria(40) + '.wav'
          // fileAppender = new FileAppender('data/' + userInputFilename);
          // fileAppender.append(this.mediaStreamConverter.generateWavHeader());
          // this.mediaStreamConverter.end();
          // this.mediaStreamConverter = this._prepareSpeechToSpeechPipe();
        } else {
          // Discard buffer if voice stopped before threshold
          this.voiceBuffer = null;
        }
      },
      onClose: () => {
        // console.log("Client says", userInputFilename)
      }
    })

    // fileAppender.append(this.mediaStreamConverter.generateWavHeader());

  }

  onUserStartsSpeaking(handler: () => void) {
    this.startSpeakingHandler = handler
  }

  private _prepareSpeechToSpeechPipe() {
    return new SpeechToTextService(async (transcript) => {
      try {
        console.log("Speech to text", transcript)
        if (transcript === '') return
        let startsAt
        startsAt = Date.now()
        const textResponse = await this.genAiService.generateResponse(transcript)
        console.log("Text response", textResponse, "Duration", (Date.now() - startsAt) / 1000)

        startsAt = Date.now()
        const textToSpeechService = new TextToSpeechService()
        const speechResponse = await textToSpeechService.send(textResponse)
        const filename = generarCadenaAleatoria(40) + '.mp3';
        console.log("Text to speech", filename, "Duration", (Date.now() - startsAt) / 1000)
        fs.writeFile('data/' + filename, speechResponse, () => { })

        this.responseHandler(speechResponse)
      }
      catch (e: any) {
        console.log("Error en la conversación", e.message)
      }
    })
  }

  write(stream: Buffer, timestamp: number) {
    this.mediaStreamConverter.write(stream);
  }

  async text(text: string) {
    console.log("Text", text)
    let startsAt

    try {
      startsAt = Date.now()
      const textResponse = await this.genAiService.generateResponse(text)
      console.log("Text response", textResponse, "Duration", (Date.now() - startsAt) / 1000)

      startsAt = Date.now()
      const textToSpeechService = new TextToSpeechService()
      const speechResponse = await textToSpeechService.send(textResponse)
      const filename = generarCadenaAleatoria(40) + '.mp3';
      console.log("Text to speech", filename, "Duration", (Date.now() - startsAt) / 1000)
      fs.writeFile('data/' + filename, speechResponse, () => { })

      this.responseHandler(speechResponse)
    } catch (e) {

    }
  }
}