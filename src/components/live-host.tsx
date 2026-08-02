"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The live shopping "host": a speaking voice (browser Speech Synthesis) plus an
// animated presenter avatar. This is the talk-today layer — a photoreal AI
// presenter (e.g. HeyGen) can slot in later behind the same speak() calls.

export function useVoice() {
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!supported) return;
    try { const v = localStorage.getItem("pd_host_voice"); if (v === "off") setMuted(true); } catch {}
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      voiceRef.current =
        vs.find((v) => /en-AU/i.test(v.lang) && /female|zira|google|natural/i.test(v.name)) ||
        vs.find((v) => /en-AU/i.test(v.lang)) ||
        vs.find((v) => /en-GB/i.test(v.lang)) ||
        vs.find((v) => /female|zira|samantha|google us/i.test(v.name)) ||
        vs.find((v) => /^en/i.test(v.lang)) ||
        vs[0] || null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); } catch {} };
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || mutedRef.current || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 1.03; u.pitch = 1.06; u.volume = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch { setSpeaking(false); }
  }, [supported]);

  const stop = useCallback(() => { if (supported) { try { window.speechSynthesis.cancel(); } catch {} setSpeaking(false); } }, [supported]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem("pd_host_voice", next ? "off" : "on"); } catch {}
      if (next && supported) { try { window.speechSynthesis.cancel(); } catch {} setSpeaking(false); }
      return next;
    });
  }, [supported]);

  return { speak, stop, speaking, muted, toggleMute, supported };
}

// Friendly, gender-neutral presenter with a headset. The mouth animates while
// speaking and sound-waves pulse beside it.
export function HostAvatar({ speaking, accent, size = 56 }: { speaking: boolean; accent: string; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <style>{`
        @keyframes pdTalk { 0%,100% { transform: scaleY(.4) } 50% { transform: scaleY(1) } }
        @keyframes pdBlink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(.1) } }
        @keyframes pdWave { 0%,100% { opacity:.3; transform: scaleY(.6) } 50% { opacity:1; transform: scaleY(1) } }
      `}</style>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <clipPath id="pdHead"><circle cx="50" cy="46" r="30" /></clipPath>
        </defs>
        <circle cx="50" cy="50" r="48" fill={`${accent}22`} />
        <circle cx="50" cy="50" r="48" fill="none" stroke={`${accent}66`} strokeWidth="2" />
        {/* head + hair */}
        <g clipPath="url(#pdHead)">
          <circle cx="50" cy="46" r="30" fill="#f0c8a8" />
          <path d="M20 44 Q50 6 80 44 L80 30 Q50 12 20 30 Z" fill="#4b3b2f" />
        </g>
        {/* eyes (blink) */}
        <g style={{ transformOrigin: "50px 44px", animation: "pdBlink 5s ease-in-out infinite" }}>
          <circle cx="42" cy="44" r="2.6" fill="#2b2320" />
          <circle cx="58" cy="44" r="2.6" fill="#2b2320" />
        </g>
        {/* mouth */}
        <g style={{ transformOrigin: "50px 58px", animation: speaking ? "pdTalk .26s ease-in-out infinite" : "none" }}>
          <ellipse cx="50" cy="58" rx="6" ry={speaking ? 4 : 1.6} fill="#7a3b3b" />
        </g>
        {/* headset band + mic */}
        <path d="M22 46 A28 28 0 0 1 78 46" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
        <rect x="16" y="44" width="8" height="14" rx="3" fill={accent} />
        <rect x="76" y="44" width="8" height="14" rx="3" fill={accent} />
        <path d="M20 58 Q20 74 44 74" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <circle cx="46" cy="74" r="3.4" fill={accent} />
      </svg>
      {speaking ? (
        <div className="absolute -right-1 bottom-1 flex items-end gap-[2px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-[3px] rounded-full" style={{ height: 12, background: accent, transformOrigin: "bottom", animation: `pdWave .5s ease-in-out ${i * 0.12}s infinite` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function VoiceButton({ muted, toggle, accent }: { muted: boolean; toggle: () => void; accent: string }) {
  return (
    <button onClick={toggle} aria-label={muted ? "Unmute host voice" : "Mute host voice"} title={muted ? "Host voice: off" : "Host voice: on"}
      className="rounded-full bg-white/10 px-3 py-2 text-sm text-white backdrop-blur transition hover:bg-white/20"
      style={!muted ? { boxShadow: `0 0 0 1px ${accent}66` } : undefined}>
      {muted ? "🔈" : "🗣️"}
    </button>
  );
}
