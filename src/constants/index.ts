export const QUEUE_NAMES = {
  DOCUMENT_PROCESSING: 'document-processing',
  TTS_GENERATION: 'tts-generation',
} as const;

export const TTS_CONFIG = {
  DEFAULT_MAX_CHUNK_CHARACTERS: 4000,
  DEFAULT_VOICE: 'af_heart',
  DEFAULT_SPEED: 1.0,
  DEFAULT_FORMAT: 'wav',
  SUPPORTED_AUDIO_FORMATS: ['wav', 'mp3'] as const,
  TIMEOUT_MS: 120000,
} as const;

export const DEFAULT_KOKORO_VOICES = [
  {
    providerVoiceId: 'af_heart',
    name: 'Heart (American Female)',
    language: 'en-US',
    gender: 'female',
    description: 'Warm, clear, and expressive American female voice.',
  },
  {
    providerVoiceId: 'af_bella',
    name: 'Bella (American Female)',
    language: 'en-US',
    gender: 'female',
    description: 'Crisp, articulate female narrator voice.',
  },
  {
    providerVoiceId: 'am_adam',
    name: 'Adam (American Male)',
    language: 'en-US',
    gender: 'male',
    description: 'Deep, engaging American male voice.',
  },
  {
    providerVoiceId: 'am_michael',
    name: 'Michael (American Male)',
    language: 'en-US',
    gender: 'male',
    description: 'Professional, calm male reader.',
  },
  {
    providerVoiceId: 'bf_emma',
    name: 'Emma (British Female)',
    language: 'en-GB',
    gender: 'female',
    description: 'Elegant British female narration.',
  },
  {
    providerVoiceId: 'bm_george',
    name: 'George (British Male)',
    language: 'en-GB',
    gender: 'male',
    description: 'Rich British male storytelling tone.',
  },
] as const;
