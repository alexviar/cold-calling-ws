interface VADState {
  energyHistory: number[];
  noiseFloor: number;
  silenceCounter: number;
  lastEnergy: number;
}

export class VADProcessor {
  private readonly HISTORY_SIZE = 50;
  private readonly SILENCE_THRESHOLD = 0.3;
  private readonly VOICE_THRESHOLD = 0.6;
  private readonly MIN_VOICE_DURATION = 0.2; // seconds
  private readonly SILENCE_DURATION = 0.5; // seconds
  private state: VADState = {
    energyHistory: [],
    noiseFloor: 0,
    silenceCounter: 0,
    lastEnergy: 0
  };

  processAudio(pcmData: Int16Array, sampleRate: number): boolean {
    // Calculate RMS energy
    const energy = Math.sqrt(
      pcmData.reduce((sum, sample) => sum + Math.pow(sample, 2), 0) / pcmData.length
    );

    // Update energy history
    this.state.energyHistory.push(energy);
    if (this.state.energyHistory.length > this.HISTORY_SIZE) {
      this.state.energyHistory.shift();
    }

    // Calculate noise floor (using lowest 10% of energies)
    const sortedEnergies = [...this.state.energyHistory].sort((a, b) => a - b);
    this.state.noiseFloor = sortedEnergies[Math.floor(sortedEnergies.length * 0.1)];

    // Normalize energy relative to noise floor
    const normalizedEnergy = energy / (this.state.noiseFloor + 1e-6);

    // Apply smoothing
    const smoothedEnergy = 0.7 * this.state.lastEnergy + 0.3 * normalizedEnergy;
    this.state.lastEnergy = smoothedEnergy;

    let isSpeaking = false;

    if (smoothedEnergy > this.VOICE_THRESHOLD) {
      this.state.silenceCounter = 0;
      isSpeaking = true;
    } else if (smoothedEnergy < this.SILENCE_THRESHOLD) {
      this.state.silenceCounter += pcmData.length / sampleRate;
      isSpeaking = this.state.silenceCounter < this.SILENCE_DURATION;
    } else {
      // Hysteresis zone - maintain previous state
      isSpeaking = this.state.silenceCounter < this.SILENCE_DURATION;
    }

    // console.log("Energy", smoothedEnergy, this.state.silenceCounter, isSpeaking);

    return isSpeaking;
  }
}