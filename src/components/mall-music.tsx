"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shopping-mall ambience for the live shop.
//
// Browsers block audio from starting with sound until the visitor interacts with
// the page (iOS Safari is strictest), so there is no true "autoplay on load". We
// get the same feel by ARMING on the first tap anywhere — and the whole experience
// is tap-driven, so music kicks in the moment someone enters the mall.
//
// Sound source, in order of preference:
//   1. A licensed loop dropped at /public/music/mall-loop.mp3 (best — real muzak).
//   2. A soft generated Web Audio pad fallback, so there's always something playing
//      even before a track is added.
const TRACK_URL = "/music/mall-loop.mp3";
const PREF_KEY = "pd_mall_music";

export function useMallMusic() {
  const [on, setOn] = useState(true); // visitor preference; default on
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const genRef = useRef<{ stop: () => void } | null>(null);
  const armedRef = useRef(false);
  const onRef = useRef(on);
  onRef.current = on;

  // Restore the visitor's earlier choice.
  useEffect(() => {
    try { if (localStorage.getItem(PREF_KEY) === "off") setOn(false); } catch {}
    const a = new Audio(TRACK_URL);
    a.loop = true;
    a.preload = "auto";
    a.volume = 0.35;
    audioRef.current = a;
    return () => { a.pause(); genRef.current?.stop(); };
  }, []);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch {} }, [on]);

  // Soft major-chord pad through a lowpass with a slow swell — calm and inoffensive.
  const startGenerated = useCallback(() => {
    if (genRef.current) return;
    try {
      const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const master = ctx.createGain(); master.gain.value = 0.05; master.connect(ctx.destination);
      const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 850; filter.connect(master);
      const notes = [220, 277.18, 329.63]; // A major pad
      const oscs = notes.map((f, i) => {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.value = 0.22 / (i + 1);
        o.connect(g); g.connect(filter); o.start(); return o;
      });
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.02;
      lfo.connect(lfoGain); lfoGain.connect(master.gain); lfo.start();
      genRef.current = { stop: () => { try { oscs.forEach((o) => o.stop()); lfo.stop(); ctx.close(); } catch {} genRef.current = null; } };
    } catch {}
  }, []);

  const stopAll = useCallback(() => { audioRef.current?.pause(); genRef.current?.stop(); }, []);

  // Try the real track; if it's missing/blocked, fall back to the generated pad.
  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) { startGenerated(); return; }
    a.play().then(() => { genRef.current?.stop(); }).catch(() => startGenerated());
  }, [startGenerated]);

  // Arm on the first user gesture anywhere on the page.
  useEffect(() => {
    const arm = () => {
      if (armedRef.current) return;
      armedRef.current = true;
      if (onRef.current) play();
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
    window.addEventListener("pointerdown", arm, { once: false });
    window.addEventListener("keydown", arm, { once: false });
    return () => { window.removeEventListener("pointerdown", arm); window.removeEventListener("keydown", arm); };
  }, [play]);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      if (next) { armedRef.current = true; play(); } else { stopAll(); }
      return next;
    });
  }, [play, stopAll]);

  return { on, toggle };
}

export function MusicButton({ on, toggle, accent }: { on: boolean; toggle: () => void; accent: string }) {
  return (
    <button
      onClick={toggle}
      aria-label={on ? "Mute mall music" : "Play mall music"}
      title={on ? "Mall music: on" : "Mall music: off"}
      className="relative rounded-full bg-white/10 px-3 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
      style={on ? { boxShadow: `0 0 0 1px ${accent}66` } : undefined}
    >
      {on ? "🔊" : "🔇"}
    </button>
  );
}
