// types/node-vad.d.ts
declare module 'node-vad' {
  export interface VadOptions {
    /**
     * Modo de operación (por ejemplo, 0: muy agresivo, 3: menos agresivo).
     */
    mode?: number;
    audioFrequency?: number,
    debounceTime?: number
  }

  /**
   * Posibles resultados del procesamiento de audio.
   */
  export type VadStatus = 'SILENCE' | 'SPEECH' | 'ERROR';

  /**
   * Clase para realizar detección de actividad de voz.
   */
  export class Vad {

    static Event = {
      ERROR: -1,
      SILENCE: 0,
      VOICE: 1,
      NOISE: 2
    }

    static Mode = {
      NORMAL: 0,
      LOW_BITRATE: 1,
      AGGRESIVE: 2,
      VERY_AGGRESSIVE: 3
    }

    constructor(options?: VadOptionss);

    /**
     * Procesa un buffer de audio y retorna el estado.
     * @param buffer - Buffer con datos de audio.
     * @returns Un estado que indica si hay voz, silencio, o un error.
     */
    processAudio(buffer: Buffer, sampleRate: number): VadStatus;

    // Si existen más métodos, agrégalos aquí.
  }

  // Si la librería se exporta con `module.exports = Vad;`
  export default Vad;
}
