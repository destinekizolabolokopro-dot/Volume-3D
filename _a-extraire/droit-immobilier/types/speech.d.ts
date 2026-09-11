/**
 * La dictée du navigateur, déclarée à la main.
 *
 * `SpeechRecognition` ne figure pas dans les types du DOM fournis avec
 * TypeScript : la spécification n'a jamais quitté l'état de brouillon, alors
 * que Chrome, Edge et Safari l'implémentent depuis des années sous le préfixe
 * `webkit`. On déclare donc le strict nécessaire — ce que components/Voix.tsx
 * utilise réellement, et rien de plus.
 *
 * Une déclaration incomplète vaut mieux qu'un `any` : elle laisse le
 * compilateur attraper une faute de frappe sur `interimResults`, et elle
 * documente au passage la surface sur laquelle ce code s'appuie.
 */

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

/** `not-allowed` est le seul cas qu'on distingue : le micro a été refusé. */
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
}
