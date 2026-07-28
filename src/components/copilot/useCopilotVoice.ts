/**
 * Voice layer for Aegis Copilot™.
 *
 * Uses the browser's Web Speech API where available. The interface is
 * provider-agnostic so a server-side speech service can be swapped in later
 * without touching the UI.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "listening" | "unsupported";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

export function useCopilotVoice(options: {
  language: string;
  onResult: (transcript: string) => void;
}) {
  const { language, onResult } = options;
  const [state, setState] = useState<VoiceState>("idle");
  const [interim, setInterim] = useState("");
  const [level, setLevel] = useState(0);
  const recognitionRef = useRef<Recognition | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setState("unsupported");
      return;
    }
    const recognition: Recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      setLevel(Math.min(1, (interimText.length % 20) / 20 + 0.2));
      if (finalText.trim()) {
        setInterim("");
        onResultRef.current(finalText.trim());
      }
    };
    recognition.onend = () => {
      setState("idle");
      setInterim("");
      setLevel(0);
    };
    recognition.onerror = () => {
      setState("idle");
      setInterim("");
    };

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.abort();
      } catch {
        /* recognition already stopped */
      }
      recognitionRef.current = null;
    };
  }, [language]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.start();
      setState("listening");
    } catch {
      /* already listening */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* not listening */
    }
    setState("idle");
  }, []);

  const speak = useCallback(
    (text: string, rate = 1) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = rate;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [language],
  );

  return { state, interim, level, start, stop, speak, supported: state !== "unsupported" };
}
