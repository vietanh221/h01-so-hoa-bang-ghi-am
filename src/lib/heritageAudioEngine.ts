import type { AudioRecordItem, SynthPreset } from '../types/archive';
import { loadAudioBlob } from './audioBlobStore';

export interface PlaybackSnapshot {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  noiseReduction: boolean;
  volume: number;
  sourceNotice: string | null;
}

type Listener = (snapshot: PlaybackSnapshot) => void;

const PRESET_SCALES: Record<SynthPreset, number[]> = {
  lullaby_1992: [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66],
  radio_broadcast_1986: [220.0, 261.63, 329.63, 392.0, 329.63, 293.66, 261.63, 220.0],
  village_festival_1998: [293.66, 349.23, 392.0, 440.0, 523.25, 440.0, 392.0, 349.23],
  tet_letter_1995: [246.94, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 246.94],
  folk_strings_1989: [196.0, 220.0, 293.66, 329.66, 392.0, 329.66, 293.66, 220.0],
  custom_tape: [261.63, 311.13, 392.0, 466.16, 392.0, 311.13, 261.63, 196.0],
};

class HeritageAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private highPass: BiquadFilterNode | null = null;
  private lowPass: BiquadFilterNode | null = null;
  private analyser: AnalyserNode | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private currentBlobUrl: string | null = null;

  private synthIntervalId: number | null = null;
  private tickIntervalId: number | null = null;
  private hissNode: AudioBufferSourceNode | null = null;
  private hissGain: GainNode | null = null;

  private activeRecord: AudioRecordItem | null = null;
  private usingRealBlob = false;
  private synthNoteStep = 0;

  private state: PlaybackSnapshot = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    noiseReduction: true,
    volume: 0.85,
    sourceNotice: null,
  };

  private listeners = new Set<Listener>();

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn({ ...this.state });
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const copy = { ...this.state };
    this.listeners.forEach((fn) => fn(copy));
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.highPass = this.ctx.createBiquadFilter();
      this.highPass.type = 'highpass';
      this.highPass.frequency.value = this.state.noiseReduction ? 95 : 20;

      this.lowPass = this.ctx.createBiquadFilter();
      this.lowPass.type = 'lowpass';
      this.lowPass.frequency.value = this.state.noiseReduction ? 5400 : 16000;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.state.volume;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.highPass.connect(this.lowPass);
      this.lowPass.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private applyFilterState(): void {
    if (this.highPass && this.lowPass && this.ctx) {
      this.highPass.frequency.setTargetAtTime(
        this.state.noiseReduction ? 95 : 20,
        this.ctx.currentTime,
        0.04
      );
      this.lowPass.frequency.setTargetAtTime(
        this.state.noiseReduction ? 5400 : 16000,
        this.ctx.currentTime,
        0.04
      );
    }
    if (this.hissGain && this.ctx) {
      this.hissGain.gain.setTargetAtTime(
        this.state.noiseReduction ? 0.004 : 0.022,
        this.ctx.currentTime,
        0.06
      );
    }
  }

  private stopAllGenerators(): void {
    if (this.synthIntervalId !== null) {
      window.clearInterval(this.synthIntervalId);
      this.synthIntervalId = null;
    }
    if (this.tickIntervalId !== null) {
      window.clearInterval(this.tickIntervalId);
      this.tickIntervalId = null;
    }
    if (this.hissNode) {
      try {
        this.hissNode.stop();
      } catch {
        // Ignore already stopped
      }
      this.hissNode.disconnect();
      this.hissNode = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  async loadRecord(record: AudioRecordItem, autoPlay = true): Promise<void> {
    this.stopAllGenerators();
    this.activeRecord = record;
    this.usingRealBlob = false;
    this.synthNoteStep = 0;

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    let notice: string | null = null;

    if (record.audioMode === 'local_blob' && record.audioStorageKey) {
      try {
        const blob = await loadAudioBlob(record.audioStorageKey);
        if (blob) {
          this.usingRealBlob = true;
          this.currentBlobUrl = URL.createObjectURL(blob);
          this.setupMediaElement(this.currentBlobUrl);
        } else {
          notice =
            'Tệp âm thanh gốc được lưu cục bộ trên thiết bị đã tạo bản ghi. Đang phát luồng mô phỏng băng từ lưu trữ.';
        }
      } catch {
        notice =
          'Không đọc được bộ nhớ tệp cục bộ; chuyển sang phát luồng mô phỏng băng từ.';
      }
    }

    this.state = {
      ...this.state,
      isPlaying: false,
      currentTime: 0,
      duration: record.durationSeconds,
      sourceNotice: notice,
    };
    this.emit();

    if (autoPlay) {
      await this.play();
    }
  }

  private setupMediaElement(url: string): void {
    const ctx = this.ensureContext();
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.mediaSource = ctx.createMediaElementSource(this.audioEl);
      if (this.highPass) {
        this.mediaSource.connect(this.highPass);
      }
      this.audioEl.addEventListener('timeupdate', () => {
        if (this.audioEl && this.usingRealBlob) {
          this.state.currentTime = this.audioEl.currentTime;
          if (!Number.isNaN(this.audioEl.duration) && Number.isFinite(this.audioEl.duration)) {
            this.state.duration = this.audioEl.duration;
          }
          this.emit();
        }
      });
      this.audioEl.addEventListener('ended', () => {
        if (this.usingRealBlob) {
          this.state.isPlaying = false;
          this.state.currentTime = 0;
          this.emit();
        }
      });
    }
    this.audioEl.src = url;
    this.audioEl.playbackRate = this.state.playbackRate;
    this.audioEl.load();
  }

  async play(): Promise<void> {
    if (!this.activeRecord) return;
    const ctx = this.ensureContext();
    this.applyFilterState();

    if (this.usingRealBlob && this.audioEl) {
      this.audioEl.playbackRate = this.state.playbackRate;
      try {
        await this.audioEl.play();
        this.state.isPlaying = true;
        this.emit();
      } catch {
        this.state.isPlaying = false;
        this.emit();
      }
      return;
    }

    this.startHeritageSynth(ctx, this.activeRecord.synthPreset);
    this.state.isPlaying = true;
    this.emit();
  }

  pause(): void {
    this.stopAllGenerators();
    this.state.isPlaying = false;
    this.emit();
  }

  togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      void this.play();
    }
  }

  seek(timeSec: number): void {
    const clamped = Math.max(0, Math.min(this.state.duration || 0, timeSec));
    this.state.currentTime = clamped;
    if (this.usingRealBlob && this.audioEl) {
      this.audioEl.currentTime = clamped;
    }
    this.emit();
  }

  setPlaybackRate(rate: number): void {
    this.state.playbackRate = rate;
    if (this.audioEl) {
      this.audioEl.playbackRate = rate;
    }
    this.emit();
  }

  toggleNoiseReduction(): void {
    this.state.noiseReduction = !this.state.noiseReduction;
    this.applyFilterState();
    this.emit();
  }

  setVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.state.volume = clamped;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.03);
    }
    this.emit();
  }

  getFrequencyBins(binCount = 24): number[] {
    if (!this.analyser || !this.state.isPlaying) {
      return new Array(binCount).fill(0.08);
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const out: number[] = [];
    for (let i = 0; i < binCount; i++) {
      const idx = Math.min(data.length - 1, Math.floor((i / binCount) * data.length));
      out.push(Math.max(0.08, data[idx] / 255));
    }
    return out;
  }

  private startHeritageSynth(ctx: AudioContext, preset: SynthPreset): void {
    this.stopAllGenerators();

    // Soft analog magnetic tape noise floor
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = output[i];
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const hissGain = ctx.createGain();
    hissGain.gain.value = this.state.noiseReduction ? 0.004 : 0.022;
    this.hissGain = hissGain;
    this.hissNode = noise;

    if (this.highPass) {
      noise.connect(hissGain);
      hissGain.connect(this.highPass);
    }
    noise.start();

    const scale = PRESET_SCALES[preset] || PRESET_SCALES.lullaby_1992;

    const triggerNote = () => {
      if (!this.ctx || !this.highPass) return;
      const now = this.ctx.currentTime;
      const freq = scale[this.synthNoteStep % scale.length];
      this.synthNoteStep++;

      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = preset === 'radio_broadcast_1986' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      // Subtle analog tape wow/flutter pitch drift
      osc.frequency.linearRampToValueAtTime(freq * 1.003, now + 0.45);
      osc.frequency.linearRampToValueAtTime(freq * 0.998, now + 0.9);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 0.5, now);

      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.11, now + 0.08);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 1.05);

      osc.connect(env);
      subOsc.connect(env);
      env.connect(this.highPass);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 1.1);
      subOsc.stop(now + 1.1);
    };

    triggerNote();
    this.synthIntervalId = window.setInterval(triggerNote, 820);

    this.tickIntervalId = window.setInterval(() => {
      const next = this.state.currentTime + 0.25 * this.state.playbackRate;
      if (next >= this.state.duration) {
        this.pause();
        this.state.currentTime = 0;
        this.emit();
      } else {
        this.state.currentTime = next;
        this.emit();
      }
    }, 250);
  }
}

export const audioEngine = new HeritageAudioEngine();
