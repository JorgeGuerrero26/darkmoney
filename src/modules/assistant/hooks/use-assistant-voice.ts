import { useEffect, useRef, useState } from "react";

type RecognitionEvent = { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null; onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type VoiceWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export const cleanSpokenReply = (text: string) => text.replace(/\*\*/g, "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, "").replace(/\s{2,}/g, " ").trim().slice(0, 12000);

/** Browser speech is opt-in, scoped and never executes a financial proposal. */
export function useAssistantVoice({ scopeKey, enabled, onText, onSubmit }: {
  scopeKey: string; enabled: boolean; onText: (text: string) => void; onSubmit: (text: string) => void;
}) {
  const browser = typeof window === "undefined" ? undefined : window as VoiceWindow;
  const constructor = browser?.SpeechRecognition ?? browser?.webkitSpeechRecognition;
  const synthesis = browser?.speechSynthesis;
  const canSpeak = Boolean(synthesis && typeof SpeechSynthesisUtterance !== "undefined");
  const [listening, setListening] = useState(false), [speaking, setSpeaking] = useState(false);
  const [mode, setMode] = useState(false), [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null), utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const latest = useRef({ scopeKey, enabled, onText, onSubmit, mode }); latest.current = { scopeKey, enabled, onText, onSubmit, mode };
  function abortRecognition() {
    const previous = recognition.current; recognition.current = null;
    if (previous) { previous.onresult = null; previous.onend = null; previous.onerror = null; try { previous.abort(); } catch { /* Already stopped. */ } }
    setListening(false);
  }
  function stopSpeaking() { utterance.current = null; synthesis?.cancel(); setSpeaking(false); }
  function cancel() { abortRecognition(); stopSpeaking(); }
  useEffect(() => {
    setMode(false); setError(""); cancel();
    return cancel;
    // Scope changes invalidate recognition and playback before any late result is used.
  }, [scopeKey]);
  useEffect(() => { if (!enabled) abortRecognition(); }, [enabled]);
  useEffect(() => {
    const hide = () => { if (document.hidden) cancel(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  function start() {
    if (!constructor || !latest.current.enabled || recognition.current) return;
    stopSpeaking(); setError("");
    const originalScope = latest.current.scopeKey;
    let current: Recognition;
    try { current = new constructor(); } catch { setError("No se pudo iniciar el dictado. Puedes seguir escribiendo."); return; }
    recognition.current = current;
    const isCurrent = () => recognition.current === current && latest.current.scopeKey === originalScope && latest.current.enabled;
    let finalText = "";
    current.lang = "es-PE"; current.continuous = false; current.interimResults = true;
    current.onresult = event => {
      if (!isCurrent()) return;
      const results = Array.from(event.results);
      const text = results.map(result => result[0]?.transcript ?? "").join(" ").trim().slice(0, 4000);
      finalText = results.filter(result => result.isFinal).map(result => result[0]?.transcript ?? "").join(" ").trim().slice(0, 4000);
      if (text) latest.current.onText(text);
    };
    current.onend = () => {
      if (!isCurrent()) return;
      recognition.current = null; setListening(false);
      if (latest.current.mode && finalText) latest.current.onSubmit(finalText);
    };
    current.onerror = event => {
      if (!isCurrent()) return;
      abortRecognition();
      setError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Sin permiso de micrófono. Puedes seguir escribiendo." : "El dictado no pudo completarse. Revisa el texto antes de enviarlo.");
    };
    try { setListening(true); current.start(); }
    catch { abortRecognition(); setError("El navegador no pudo iniciar el dictado. Puedes seguir escribiendo."); }
  }
  function stop() { try { recognition.current?.stop(); } catch { abortRecognition(); } }
  function speak(text: string) {
    const clean = cleanSpokenReply(text); if (!canSpeak || !clean) return;
    stopSpeaking();
    const current = new SpeechSynthesisUtterance(clean); current.lang = "es-PE"; utterance.current = current;
    current.onend = current.onerror = () => { if (utterance.current === current) { utterance.current = null; setSpeaking(false); } };
    try { setSpeaking(true); synthesis!.speak(current); } catch { utterance.current = null; setSpeaking(false); setError("No se pudo leer la respuesta. El texto sigue disponible."); }
  }
  function toggleMode() { if (mode) stopSpeaking(); setMode(previous => !previous); }
  function speakReply(text: string) { if (latest.current.mode) speak(text); }
  return { canDictate: Boolean(constructor), canSpeak, listening, speaking, mode, error, start, stop, cancel, stopSpeaking, speak, speakReply, toggleMode };
}
