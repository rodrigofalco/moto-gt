const MUTE_KEY = 'moto-gt-muted';

export class SoundEngine {
  private ctx!: AudioContext;
  private muted = false;
  private engineGain!: GainNode;            // persistent master gain for the engine hum (fades, never clicks)
  private engineOsc: OscillatorNode | null = null;

  constructor() {
    this.muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === 'true';
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    this.engineGain = this.ctx.createGain();
    this.engineGain.connect(this.ctx.destination);
    this.engineGain.gain.value = 0;
    }

  toggleMute(): void {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, String(this.muted));
    if (this.muted) this.stopEngine();
  }

  isMuted(): boolean { return this.muted; }

  private resume(): void { if (this.ctx.state === 'suspended') this.ctx.resume(); }

  // Engine hum: one persistent oscillator through a lowpass filter (tames the raw sawtooth's
  // harsh upper harmonics), started once per race and re-pitched smoothly as speed changes.
  // Previously this was called every animation frame and restarted the oscillator each time —
  // stopping and starting with no fade produced a click roughly 60 times a second.
  private startEngine(speed: number): void {
    this.resume();
    if (this.muted || this.engineOsc) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = 55 + speed * 25;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    osc.connect(filter); filter.connect(this.engineGain);
    osc.start();
    this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, this.ctx.currentTime);
    this.engineGain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.15); // fade in
    this.engineOsc = osc;
  }

  playEngine(speed: number): void {
    if (this.muted) return;
    if (!this.engineOsc) { this.startEngine(speed); return; }
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 25, this.ctx.currentTime, 0.08); // smooth re-pitch, no click
  }

  stopEngine(): void {
    if (!this.engineOsc) return;
    const osc = this.engineOsc;
    this.engineOsc = null;
    this.engineGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, this.ctx.currentTime);
    this.engineGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1); // fade out
    try { osc.stop(this.ctx.currentTime + 0.15); } catch { /* already stopped */ }
  }

  playCrash(): void {
    this.resume();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buf; src.connect(gain); gain.connect(this.ctx.destination);
    gain.gain.value = this.muted ? 0 : 0.5;
    src.start();
  }

  playPodium(): void {
    this.resume();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      osc.connect(gain); gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.18 + 0.4);
      osc.start(this.ctx.currentTime + i * 0.18);
      osc.stop(this.ctx.currentTime + i * 0.18 + 0.5);
    });
  }

  playCheckeredFlag(): void {
    this.resume();
    [783.99, 987.77, 783.99, 987.77, 1174.66].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      osc.connect(gain); gain.connect(this.ctx.destination);
      gain.gain.setValueAtTime(this.muted ? 0 : 0.2, this.ctx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.15);
      osc.start(this.ctx.currentTime + i * 0.1);
      osc.stop(this.ctx.currentTime + i * 0.1 + 0.2);
    });
  }

  playClick(): void {
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 800;
    osc.connect(gain); gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.muted ? 0 : 0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.start(); osc.stop(this.ctx.currentTime + 0.08);
  }

  playOvertake(): void {
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.2);
    osc.connect(gain); gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.start(); osc.stop(this.ctx.currentTime + 0.3);
  }

  destroy(): void {
    this.stopEngine();
    this.ctx.close();
  }
}
