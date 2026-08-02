"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shopping-mall ambience for the live shop.
//
// Browsers block audio from starting with sound until the visitor interacts with
// the page (iOS Safari is strictest), so there is no true "autoplay on load". We
// get the same feel by ARMING on the first tap anywhere — and the whole experience
// is tap-driven, so music kicks in the moment someone enters the mall.
//
// Music only plays when a REAL licensed track exists at /public/music/mall-loop.mp3.
// Until then it stays silent and the 🔊 control is hidden — no synthesized tones
// (a generated pad just sounds like an annoying drone on real speakers).
const TRACK_URL = "/music/mall-loop.mp3";
const PREF_KEY = "pd_mall_music";

export function useMallMusic() {
  const [on, setOn] = useState(true); // visitor preference; default on
  const [available, setAvailable] = useState(false); // is there a real track?
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const armedRef = useRef(false);
  const onRef = useRef(on);
  onRef.current = on;

  // Restore preference + probe for a real track. Only set up audio if one exists.
  useEffect(() => {
    try { if (localStorage.getItem(PREF_KEY) === "off") setOn(false); } catch {}
    let cancelled = false;
    fetch(TRACK_URL, { method: "HEAD" })
      .then((r) => {
        if (cancelled || !r.ok) return;
        const a = new Audio(TRACK_URL);
        a.loop = true; a.preload = "auto"; a.volume = 0.35;
        audioRef.current = a;
        setAvailable(true);
      })
      .catch(() => {});
    return () => { cancelled = true; audioRef.current?.pause(); };
  }, []);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, on ? "on" : "off"); } catch {} }, [on]);

  const play = useCallback(() => { audioRef.current?.play().catch(() => {}); }, []);

  // Arm on the first user gesture — only when a real track is available.
  useEffect(() => {
    if (!available) return;
    const arm = () => {
      if (armedRef.current) return;
      armedRef.current = true;
      if (onRef.current) play();
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => { window.removeEventListener("pointerdown", arm); window.removeEventListener("keydown", arm); };
  }, [available, play]);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      if (next) { armedRef.current = true; play(); } else { audioRef.current?.pause(); }
      return next;
    });
  }, [play]);

  return { on, toggle, available };
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
