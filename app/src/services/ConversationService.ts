import fs from "fs";
import { GenAiService } from "./GenAiService";
import { AudioCodec, MediaStreamConverter } from "./MediaStreamConverter";
import { SpeechToTextService } from "./SpeechToTextService";
import { TextToSpeechService } from "./TextToSpeechService";
import { VADProcessor } from "./VADProcessor";
import { FileAppender } from "../utils/FileAppender";
import Vad from "node-vad";
import { generateRandomText } from "../utils/generateRandomText";
import { generateWavHeader } from "../utils/generateWavHeader";

interface VoiceBuffer {
  chunks: Buffer;
  totalDuration: number;
}

export class ConversationService {
  private mediaStreamConverter: MediaStreamConverter
  private responseHandler: (response: Buffer) => void
  private startSpeakingHandler!: () => void


  constructor({ onResponse, mediaFormat }: { mediaFormat: { numChannels: number, encoding: AudioCodec, sampleRate: number }, onResponse: (response: Buffer) => void }) {
    this.responseHandler = onResponse
    let id = generateRandomText(10)

    let genAiService = new GenAiService()
    let stt: SpeechToTextService

    let i = 1;
    let fileAppender: FileAppender
    let vadProcessor = new VADProcessor({
      sampleRate: mediaFormat.sampleRate,
      onSpeechStarted: () => {
        const filename = `data/${id}_${generateRandomText(30)}_${i}`
        console.log("El cliente dice: ", filename)
        fileAppender = new FileAppender(filename + '.wav')
        fileAppender.append(generateWavHeader(mediaFormat.sampleRate))

        genAiService.initialize()
        stt = new SpeechToTextService(async (transcript) => {
          console.log("Speech to text", filename, transcript)
          if (transcript === '') return
          let startsAt
          startsAt = Date.now()
          const textResponse = await genAiService.generateResponse(transcript)
          console.log("Text response", filename, textResponse, "Duration", (Date.now() - startsAt) / 1000)

          startsAt = Date.now()
          const textToSpeechService = new TextToSpeechService()
          const speechResponse = await textToSpeechService.send(textResponse)
          console.log("Text to speech", filename, "Duration", (Date.now() - startsAt) / 1000)
          fs.writeFile(filename + '.mp3', speechResponse, () => { })

          this.responseHandler(speechResponse)
        })
      },
      onSpeechReceived(audioData) {
        fileAppender.append(audioData)

        stt.write(audioData)
      },
      onSpeechEnded() {
        stt.end()
        i++
      }
    })


    this.mediaStreamConverter = new MediaStreamConverter({
      sessionId: id,
      mediaFormat,
      onData: async (data) => {
        vadProcessor.processAudio(data)
      },
      onClose: () => {
        stt.end()
      }
    })
  }

  onUserStartsSpeaking(handler: () => void) {
    this.startSpeakingHandler = handler
  }

  write(stream: Buffer) {
    this.mediaStreamConverter.write(stream);
  }

  // async text(text: string) {
  //   console.log("Text", text)
  //   let startsAt

  //   try {
  //     startsAt = Date.now()
  //     const textResponse = await this.genAiService.generateResponse(text)
  //     console.log("Text response", textResponse, "Duration", (Date.now() - startsAt) / 1000)

  //     startsAt = Date.now()
  //     const textToSpeechService = new TextToSpeechService()
  //     const speechResponse = await textToSpeechService.send(textResponse)
  //     const filename = generarCadenaAleatoria(40) + '.mp3';
  //     console.log("Text to speech", filename, "Duration", (Date.now() - startsAt) / 1000)
  //     fs.writeFile('data/' + filename, speechResponse, () => { })

  //     this.responseHandler(speechResponse)
  //   } catch (e) {

  //   }
  // }
}