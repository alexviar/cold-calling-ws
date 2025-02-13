import VAD from 'node-vad'
import { generateRandomText } from '../utils/generateRandomText';
import { generateWavHeader } from '../utils/generateWavHeader';
interface VADState {
  energyHistory: number[];
  noiseFloor: number;
  voiceDuration: number; // Tiempo acumulado de voz en segundos
  silenceDuration: number; // Tiempo acumulado de silencio en segundos
  isSpeaking: boolean; // Estado actual de voz detectada
}

// // @ts-ignore
// const vadStream = VAD.createStream({
//   mode: VAD.Mode.NORMAL,
//   audioFrequency: 8000,
//   debounceTime: 500
// }).on('data', (data: any) => console.log(data));

export class VADProcessor {
  private vadStream: any

  constructor({
    sampleRate,
    onSpeechStarted,
    onSpeechReceived,
    onSpeechEnded
  }: {
    sampleRate: number
    onSpeechStarted(): void
    onSpeechReceived(audioData: Buffer): void
    onSpeechEnded(): void
  }) {
    let i = 0;
    const delay = 250
    let isStarting = false
    let isEnding = false
    let buffer = Buffer.alloc(0)
    let padding = Buffer.alloc(0)

    // @ts-ignore
    this.vadStream = VAD.createStream({
      mode: 3,
      audioFrequency: sampleRate,
      debounceTime: 0
    }).on('data', (data: any) => {
      if (data.speech.state) {
        if (data.speech.start) {
          isStarting = true
        }
        if (data.speech.duration > delay) {
          if (isStarting) {
            if (!isEnding) {
              i++
              onSpeechStarted()
              buffer = Buffer.concat([generateWavHeader(sampleRate), padding, buffer])
            }
            else {
              isEnding = false
            }
            onSpeechReceived(buffer)
            padding = Buffer.alloc(0)
            isStarting = false
          }
          onSpeechReceived(data.audioData)
        }
        else {
          buffer = Buffer.concat([buffer, data.audioData])
        }
      }
      else {
        if (data.speech.end) {
          if (!isStarting) {
            isEnding = true
          }
          else {
            padding = Buffer.concat([padding, buffer])
          }
        }
        isStarting = false
        buffer = Buffer.alloc(0)
        padding = Buffer.concat([padding, data.audioData])
        const paddingDuration = padding.length / 16 // ms
        if (paddingDuration > 500) {
          if (isEnding) {
            onSpeechReceived(padding.subarray(0, 500 * 16))
            onSpeechEnded()
            isEnding = false
          }
          padding = padding.subarray(padding.length - 500 * 16)
        }
      }
    })
  }

  processAudio(stream: Buffer) {
    this.vadStream.write(stream)
  }
}
