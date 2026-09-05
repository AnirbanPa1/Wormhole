import { z } from 'zod';

export type SourceType = 'TEXT' | 'TXT' | 'PDF' | 'DOCX' | 'EPUB' | 'URL';
export type DocumentStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
export type ChunkStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type VoiceProvider = 'KOKORO' | 'CUSTOM';

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, any> | string;
}

export interface DocumentChunkDto {
  id: string;
  documentId: string;
  chunkNumber: number;
  text: string;
  startPosition: number;
  endPosition: number;
  audioPath?: string | null;
  audioFormat: string;
  duration?: number | null;
  status: ChunkStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceDto {
  id: string;
  name: string;
  provider: VoiceProvider;
  providerVoiceId: string;
  language: string;
  gender: string;
  description?: string | null;
  previewUrl?: string | null;
  isActive: boolean;
}

export interface UserProgressDto {
  id: string;
  userId: string;
  documentId: string;
  chunkId?: string | null;
  audioPosition: number;
  textPosition: number;
  progressPercentage: number;
  lastOpenedAt: string;
}

export const ProcessDocumentJobSchema = z.object({
  documentId: z.string().uuid(),
  userId: z.string(),
  voiceId: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
});

export type ProcessDocumentJobData = z.infer<typeof ProcessDocumentJobSchema>;

export const GenerateSpeechJobSchema = z.object({
  documentId: z.string().uuid(),
  chunkId: z.string().uuid(),
  userId: z.string(),
  chunkNumber: z.number().int().min(1),
  text: z.string().min(1),
  voice: z.string().default('af_heart'),
  speed: z.number().min(0.5).max(2.0).default(1.0),
});

export type GenerateSpeechJobData = z.infer<typeof GenerateSpeechJobSchema>;

export const TTSRequestSchema = z.object({
  text: z.string().min(1),
  voice: z.string().default('af_heart'),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  format: z.enum(['wav', 'mp3']).default('wav'),
});

export type TTSRequest = z.infer<typeof TTSRequestSchema>;
