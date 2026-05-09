"use client";

import { useCallback, useRef } from "react";

type BrowserWindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export function useGameAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    const browserWindow = window as BrowserWindowWithWebkitAudio;
    const AudioContextCtor = browserWindow.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContextCtor();
    return audioCtxRef.current;
  }, []);

  const playTone = useCallback((freq: number, duration: number, type: OscillatorType = "sine", vol = 0.15) => {
    try {
      const ctx = getAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Sound is enhancement-only; ignore browser audio failures.
    }
  }, [getAudioCtx]);

  const playCorrect = useCallback(() => {
    playTone(880, 0.15);
    setTimeout(() => playTone(1100, 0.2), 150);
  }, [playTone]);

  const playWrong = useCallback(() => {
    playTone(200, 0.3, "sawtooth", 0.1);
  }, [playTone]);

  const playTick = useCallback(() => {
    playTone(600, 0.08, "sine", 0.08);
  }, [playTone]);

  const playFanfare = useCallback(() => {
    [523, 659, 784, 1047].forEach((freq, index) => {
      setTimeout(() => playTone(freq, 0.3, "sine", 0.12), index * 150);
    });
  }, [playTone]);

  return { playCorrect, playWrong, playTick, playFanfare };
}
