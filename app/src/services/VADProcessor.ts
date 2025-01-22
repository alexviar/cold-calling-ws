interface VADState {
  energyHistory: number[];
  noiseFloor: number;
  voiceDuration: number; // Tiempo acumulado de voz en segundos
  silenceDuration: number; // Tiempo acumulado de silencio en segundos
  isSpeaking: boolean; // Estado actual de voz detectada
}

export class VADProcessor {
  private readonly HISTORY_SIZE = 50; // Número de muestras para el historial de energía
  private readonly NOISE_ADAPT_RATE = 0.1; // Tasa de adaptación del piso de ruido
  private readonly SILENCE_THRESHOLD = 600; // Umbral para silencio relativo al piso de ruido
  private readonly VOICE_THRESHOLD = 1200; // Umbral para voz relativo al piso de ruido
  private readonly MIN_VOICE_DURATION = 0.2; // Duración mínima para confirmar voz (segundos)
  private readonly MAX_SILENCE_DURATION = 0.75; // Duración máxima de silencio antes de detener la voz (segundos)

  private timestamp = 0
  private state: VADState = {
    energyHistory: [],
    noiseFloor: 0.01, // Piso de ruido inicial
    voiceDuration: 0,
    silenceDuration: 0,
    isSpeaking: false,
  };

  /**
   * Procesa un segmento de audio para determinar si hay actividad de voz.
   * @param pcmData - Datos PCM del audio como Int16Array
   * @param sampleRate - Frecuencia de muestreo del audio (Hz)
   * @returns True si se detecta voz, False en caso contrario
   */
  processAudio(pcmData: Int16Array, sampleRate: number): boolean {
    // Paso 1: Calcular energía RMS
    const energy = Math.sqrt(
      pcmData.reduce((sum, sample) => sum + sample ** 2, 0) / pcmData.length
    );

    // Paso 2: Actualizar historial de energía
    this.state.energyHistory.push(energy);
    if (this.state.energyHistory.length > this.HISTORY_SIZE) {
      this.state.energyHistory.shift();
    }

    // // Paso 3: Estimar piso de ruido adaptativo
    // const sortedEnergies = [...this.state.energyHistory].sort((a, b) => a - b);
    // const newNoiseFloor = sortedEnergies[Math.floor(sortedEnergies.length * 0.1)];
    // this.state.noiseFloor =
    //   this.state.noiseFloor * (1 - this.NOISE_ADAPT_RATE) + newNoiseFloor * this.NOISE_ADAPT_RATE;

    // // Paso 4: Normalizar energía
    // const normalizedEnergy = energy / (this.state.noiseFloor + 1e-6);

    // Paso 5: Determinar actividad de voz
    const frameDuration = pcmData.length / sampleRate; // Duración del frame en segundos
    this.timestamp += frameDuration
    if (energy > this.VOICE_THRESHOLD) {
      this.state.voiceDuration += frameDuration;
      this.state.silenceDuration = 0;
      if (this.state.voiceDuration >= this.MIN_VOICE_DURATION) {
        this.state.isSpeaking = true;
      }
    } else if (energy < this.SILENCE_THRESHOLD) {
      this.state.silenceDuration += frameDuration;
      if (this.state.silenceDuration >= this.MAX_SILENCE_DURATION) {
        this.state.isSpeaking = false;
        this.state.voiceDuration = 0;
      }
    }

    // Debugging opcional
    // console.log(
    //   `Timestamp: ${this.timestamp.toFixed(2)}, ` +
    //   `Energy: ${energy.toFixed(4)}, ` +
    //   `Noise Floor: ${this.state.noiseFloor.toFixed(4)}, Voice: ${this.state.isSpeaking}, ` +
    //   `Voice Duration: ${this.state.voiceDuration.toFixed(2)}, Silence Duration: ${this.state.silenceDuration.toFixed(2)}`
    // );

    return this.state.isSpeaking;
  }
}
