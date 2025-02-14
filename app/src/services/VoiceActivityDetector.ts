import VAD from 'node-vad'
import { generateWavHeader } from '../utils/generateWavHeader';

export class VoiceActivityDetector {
  private vadStream: any
  private speechStartHandler?: () => void
  private speechHandler?: (chunk: Buffer) => void
  private speechEndHandler?: () => void

  constructor(sampleRate: number) {
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
              this.speechStartHandler?.()
              buffer = Buffer.concat([generateWavHeader(sampleRate), padding, buffer])
            }
            else {
              isEnding = false
            }
            this.speechHandler?.(buffer)
            padding = Buffer.alloc(0)
            isStarting = false
          }
          this.speechHandler?.(data.audioData)
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
            this.speechHandler?.(padding.subarray(0, 500 * 16))
            this.speechEndHandler?.()
            isEnding = false
          }
          padding = padding.subarray(padding.length - 500 * 16)
        }
      }
    })
  }

  onSpeechStart(handler: () => void) {
    this.speechStartHandler = handler
  }

  onSpeech(handler: (chunk: Buffer) => void) {
    this.speechHandler = handler
  }

  onSpeechEnd(handler: () => void) {
    this.speechEndHandler = handler
  }

  processAudio(stream: Buffer) {
    this.vadStream.write(stream)
  }
}
