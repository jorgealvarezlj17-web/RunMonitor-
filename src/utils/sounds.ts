class SoundEffects {
  private ctx: AudioContext | null = null;
  private iosHapticLabel: HTMLLabelElement | null = null;
  private lastVibrateTime = 0;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Activa la respuesta háptica en iOS (Safari/WebKit) mediante el control nativo switch
  private triggerIosHaptic() {
    if (typeof document === 'undefined') return;
    try {
      if (!this.iosHapticLabel || !document.body.contains(this.iosHapticLabel)) {
        const label = document.createElement('label');
        label.id = 'ios-haptic-trigger-label';
        label.htmlFor = 'ios-haptic-trigger-input';
        label.setAttribute('aria-hidden', 'true');
        label.style.position = 'fixed';
        label.style.bottom = '-9999px';
        label.style.right = '-9999px';
        label.style.width = '1px';
        label.style.height = '1px';
        label.style.opacity = '0.001';
        label.style.pointerEvents = 'none';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.id = 'ios-haptic-trigger-input';
        input.style.position = 'absolute';
        input.style.opacity = '0.001';
        input.tabIndex = -1;

        label.appendChild(input);
        document.body.appendChild(label);
        this.iosHapticLabel = label;
      }
      this.iosHapticLabel.click();
    } catch (_) {}
  }

  // Activa la vibración táctil del dispositivo con fallback multicapa
  vibrate(pattern: number | number[]) {
    const now = Date.now();
    if (now - this.lastVibrateTime < 150) return;
    this.lastVibrateTime = now;

    // 1. Web Vibration API estándar (Android Chrome, Firefox, Opera, Edge, Samsung Internet)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        const accepted = navigator.vibrate(pattern);
        // Si el patrón en array no fue aceptado o retornó false, aplicar pulso único contundente
        if (!accepted && Array.isArray(pattern)) {
          const totalMs = pattern.reduce((a, b) => a + b, 0);
          navigator.vibrate(Math.min(300, Math.max(120, totalMs)));
        }
      } catch (e) {
        try {
          if (Array.isArray(pattern)) {
            navigator.vibrate(180);
          }
        } catch (_) {}
      }
    }

    // 2. Taptic Engine en iOS Safari / Chrome iOS (iOS 17.4+ y 18+)
    this.triggerIosHaptic();
  }

  // Pulso acústico sub-grave (bombo háptico) que genera vibración física en los altavoces del móvil
  private playAcousticHaptic(frequency: number = 60, duration: number = 0.06, volume: number = 0.75) {
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + duration);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration);
    } catch (_) {}
  }

  // Clic suave, nítido y moderno
  private playSoftPop(freqStart: number, freqEnd: number, duration: number, volume: number = 0.4) {
    this.init();
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, t);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.001);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + duration);
    } catch (_) {}
  }

  // Clic sutil al tocar opciones del menú o botones
  playClick() {
    this.playSoftPop(800, 160, 0.02, 0.35);
    this.vibrate(35);
  }

  // Vibración y sonido enérgico y satisfactorio al Encender (Switch ON)
  playPowerOn() {
    this.playSoftPop(600, 1200, 0.035, 0.55);
    this.playAcousticHaptic(68, 0.06, 0.8);
    // Doble pulso vibratorio ascendente contundente (120ms vibra, 50ms pausa, 150ms vibra)
    this.vibrate([120, 50, 150]);
    // Doble golpe en iOS Taptic Engine
    setTimeout(() => this.triggerIosHaptic(), 90);
  }

  // Vibración y sonido firme y contundente al Apagar (Switch OFF)
  playPowerOff() {
    this.playSoftPop(900, 240, 0.035, 0.5);
    this.playAcousticHaptic(50, 0.07, 0.85);
    // Pulso único de corte firme y duradero (180ms)
    this.vibrate(180);
  }

  // Clic y vibración de advertencia para Falla de Corpoelec
  playFalla() {
    this.playSoftPop(450, 120, 0.04, 0.55);
    this.playAcousticHaptic(45, 0.08, 0.85);
    setTimeout(() => {
      this.playSoftPop(350, 90, 0.05, 0.55);
    }, 60);
    this.vibrate([140, 50, 140, 50, 180]);
  }

  // Clic y vibración de corte eléctrico
  playCorte() {
    this.playSoftPop(500, 100, 0.04, 0.55);
    this.playAcousticHaptic(50, 0.08, 0.85);
    this.vibrate([140, 50, 150]);
  }

  // Clic y vibración de confirmación para reportes
  playSuccess() {
    this.playSoftPop(700, 1400, 0.03, 0.4);
    setTimeout(() => {
      this.playSoftPop(1000, 1800, 0.04, 0.45);
    }, 70);
    this.vibrate([80, 50, 100]);
  }

  playDisable() {
    this.playPowerOff();
  }

  playEnable() {
    this.playPowerOn();
  }

  playError() {
    this.playFalla();
  }

  // Comprueba si el navegador actual soporta vibración nativa directa
  isNativeVibrateSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  }
}

export const sounds = new SoundEffects();


