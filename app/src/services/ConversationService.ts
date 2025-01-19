import fs from "fs";
import { GenAiService } from "./GenAiService";
import { MediaStreamConverter } from "./MediaStreamConverter";
import { SpeechToTextService } from "./SpeechToTextService";
import { TextToSpeechService } from "./TextToSpeechService";

function generarCadenaAleatoria(longitud = 10) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let resultado = '';
  for (let i = 0; i < longitud; i++) {
    const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
    resultado += caracteres[indiceAleatorio];
  }
  return resultado;
}

export class ConversationService {
  private mediaStreamConverter: MediaStreamConverter
  private genAiService: GenAiService
  private silence = {
    start: null as number | null,
    lastTimestamp: null as number | null,
  }
  private responseHandler: (response: Buffer) => void
  private userIsSpeaking: boolean = false

  constructor(onResponse: (response: Buffer) => void) {
    this.responseHandler = onResponse
    this.mediaStreamConverter = this._prepareSpeechToSpeechPipe()
    this.genAiService = new GenAiService()
  }

  private _prepareSpeechToSpeechPipe() {
    const speechToTextService = new SpeechToTextService(async (transcript) => {
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
      catch (e) {
        console.log("Error en la conversación", e)
      }
    })

    const userInputFilename = generarCadenaAleatoria(40) + '.wav'
    return new MediaStreamConverter(
      (data) => {
        speechToTextService.write(data)
        fs.appendFileSync('data/' + userInputFilename, data)
      },
      () => {
        speechToTextService.end()
        console.log("Client says", userInputFilename)
      }
    )
  }

  write(stream: Buffer, timestamp: number) {
    [stream.subarray(0, 10), stream.subarray(10)].forEach((subStream, index) => {
      if (subStream.toString('hex').endsWith('c20007d6')) {
        if (this.silence.start === null) {
          this.silence.start = timestamp + index * 80;
        }
        this.silence.lastTimestamp = timestamp + index * 80;
      }
      else {
        if (this.silence.lastTimestamp !== null && (timestamp + index * 80 - this.silence.lastTimestamp) / 8 > 300) {
          this.userIsSpeaking = true;
          this.silence.start = null;
          this.silence.lastTimestamp = null;
        }
      }
    })

    const silenceDuration = this.silence.start !== null ? timestamp + 80 - this.silence.start : 0;
    // console.log("Silence duration", silenceDuration, timestamp + 80, this.silence, this.userIsSpeaking);

    if (this.userIsSpeaking && silenceDuration / 8 > 1000) {
      this.userIsSpeaking = false;
      this.silence.start = null;
      this.silence.lastTimestamp = null;
      this.mediaStreamConverter.end();
      this.mediaStreamConverter = this._prepareSpeechToSpeechPipe();

    }
    else {
      this.mediaStreamConverter.write(stream);
    }
  }
}