import { FileAppender } from "../utils/FileAppender";
import { generateRandomText } from "../utils/generateRandomText";
import { generateWavHeader } from "../utils/generateWavHeader";
import { AudioCodec, AudioStreamConverter } from "./AudioStreamConverter";
import { Conversation } from "./Conversation";
import { RealTimeTranscriber } from "./RealTimeTranscriber";
import { SpeechSynthesizer } from "./SpeechSynthsizer";
import { VoiceActivityDetector } from "./VoiceActivityDetector";
import fs from 'fs';

export class Agent {
  private responseHandler?: (response: Buffer) => void;
  private audioStreamConverter: AudioStreamConverter;

  constructor(
    private sessionId: string,
    private instructions: string,
    private context: {
      data: Buffer,
      mimeType: string
    } | null,
    audioSettings: { encoding: AudioCodec; sampleRate: number; numChannels: number }
  ) {
    // Inicializamos el detector de actividad de voz con la tasa de muestreo especificada
    const voiceActivityDetector = new VoiceActivityDetector(audioSettings.sampleRate);

    let fileAppender: FileAppender
    let i = 1

    let transcriber = new RealTimeTranscriber()
    let conversation = new Conversation(this.instructions, this.context)
    let speechSynth = new SpeechSynthesizer()
    voiceActivityDetector.onSpeechStart(async () => {
      try {
        const filename = `data/${this.sessionId}_${generateRandomText(30)}_${String(i).padStart(3, '0')}`
        console.log("El cliente dice: ", filename)
        fileAppender = new FileAppender(filename + '.wav')
        fileAppender.append(generateWavHeader(audioSettings.sampleRate))

        const pendingTranscript = transcriber.start();
        const response = await conversation.sendDeferredMessage(pendingTranscript);
        const speech = await speechSynth.synthesize(response)
        fs.writeFile(filename + '.mp3', speech, () => { })

        this.responseHandler?.(speech)
      }
      catch (e) {
        console.error(e)
      }
    });

    voiceActivityDetector.onSpeech((chunk: Buffer) => {
      fileAppender.append(chunk)
      transcriber.pushAudioChunk(chunk)
    });

    voiceActivityDetector.onSpeechEnd(() => {
      transcriber.getResult()
      i++
    });

    // Inicializamos el convertidor de flujo de audio con los ajustes de audio
    this.audioStreamConverter = new AudioStreamConverter({
      sessionId: sessionId,
      mediaFormat: audioSettings,
      onData: async (data) => {
        voiceActivityDetector.processAudio(data)
      },
      onClose: () => {
        transcriber.cancel()
      }
    });

    // // Conectamos el evento del chunk de audio convertido con el detector de actividad de voz
    // this.audioStreamConverter.onOutput((chunk: Buffer) => {
    //   voiceActivityDetector.processAudioChunk(chunk);
    // });
  }

  onResponse(callback: (response: Buffer) => void) {
    this.responseHandler = callback;
  }

  writeAudioStream(audioStream: Buffer) {
    this.audioStreamConverter.write(audioStream)
  }
}
