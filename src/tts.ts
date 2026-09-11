import { TTS_LANG } from './types';
import type { Lang } from './types';

export function speak(text: string, lang: Lang): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = TTS_LANG[lang];
  const voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').startsWith(TTS_LANG[lang]))
    ?? speechSynthesis.getVoices().find(v => v.lang.startsWith(lang));
  if (voice) u.voice = voice;
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

// některé prohlížeče načítají hlasy asynchronně
if ('speechSynthesis' in window) speechSynthesis.getVoices();
