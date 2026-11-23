class MagicAudioEngine {
  constructor() {
    this.ctx = null;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.isPlayingMusic = false;
    this.musicTimer = null;
    this.currentWorld = 'rainbow';
    this.stepIndex = 0;

    this.worldMelodies = {
      rainbow: [523.25, 587.33, 659.25, 783.99, 880.00, 783.99, 659.25, 587.33],
      bakery:  [587.33, 659.25, 739.99, 880.00, 987.77, 880.00, 739.99, 659.25],
      clouds:  [659.25, 783.99, 987.77, 1174.66, 987.77, 783.99, 659.25, 587.33],
      cafe:    [440.00, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25],
      crystal: [783.99, 987.77, 1174.66, 1318.51, 1567.98, 1318.51, 1174.66, 987.77]
    };
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setWorld(worldId) {
    this.currentWorld = worldId || 'rainbow';
  }

  startMusic() {
    this.init();
    if (this.isPlayingMusic || !this.musicEnabled) return;
    this.isPlayingMusic = true;
    this.stepIndex = 0;

    const playNextNote = () => {
      if (!this.isPlayingMusic || !this.musicEnabled) return;
      const scale = this.worldMelodies[this.currentWorld] || this.worldMelodies.rainbow;
      const freq = scale[this.stepIndex % scale.length];
      this.playSoftBell(freq, 0.45, 0.04);
      if (this.stepIndex % 4 === 0) {
        this.playSoftBell(freq * 0.5, 0.9, 0.03);
      }
      this.stepIndex++;
      this.musicTimer = setTimeout(playNextNote, 700);
    };

    playNextNote();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  playSoftBell(freq, duration = 0.4, volume = 0.08) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  playSFX(type) {
    if (!this.sfxEnabled) return;
    this.init();
    const now = this.ctx.currentTime;

    if (type === 'button') {
      this.playSoftBell(784, 0.15, 0.08);
      setTimeout(() => this.playSoftBell(1046.5, 0.18, 0.08), 55);
    } else if (type === 'pickup' || type === 'place') {
      this.playSoftBell(523.25, 0.14, 0.09);
      setTimeout(() => this.playSoftBell(659.25, 0.18, 0.09), 55);
    } else if (type === 'drop') {
      this.playSoftBell(440, 0.14, 0.08);
      setTimeout(() => this.playSoftBell(349.23, 0.16, 0.08), 55);
    } else if (type === 'chop') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(270, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.08);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'mix' || type === 'cook') {
      this.playSoftBell(392 + Math.random() * 200, 0.18, 0.08);
    } else if (type === 'magic' || type === 'celebrate') {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((n, idx) => {
        setTimeout(() => this.playSoftBell(n, 0.42, 0.1), idx * 80);
      });
    }
  }
}

window.magicAudio = new MagicAudioEngine();
