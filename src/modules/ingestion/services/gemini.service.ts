import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

const modelAi = env.GEMINI_MODEL;

export class GeminiService {
  private static apiKeys: string[] = env.GEMINI_API_KEY
    ? env.GEMINI_API_KEY.split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0)
    : [];
  private static currentKeyIndex: number = 0;
  private static requestCount: number = 0;
  private static readonly MAX_REQUESTS_PER_KEY = 10;
  private static clients: GoogleGenerativeAI[] = this.apiKeys.map(
    (key) => new GoogleGenerativeAI(key),
  );

  private static getClient(): GoogleGenerativeAI | null {
    if (this.clients.length === 0) return null;

    // Rotate key if the current one has reached the limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_KEY) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.clients.length;
      this.requestCount = 0;
      logger.info(
        `[GeminiService] Rotating Gemini API key, switching to index ${this.currentKeyIndex}`,
      );
    }

    this.requestCount++;
    return this.clients[this.currentKeyIndex];
  }

  static async generateSeasonOverview(
    seriesTitle: string,
    seasonNumber: number,
  ): Promise<string | null> {
    const client = this.getClient();

    if (!client) {
      logger.warn('[GeminiService] GEMINI_API_KEY not set. Skipping overview generation.');
      return null;
    }

    try {
      const model = client.getGenerativeModel({ model: modelAi });
      const prompt = `Write a short, engaging, and spoiler-free summary (max 3 sentences) in English for season ${seasonNumber} of the TV series "${seriesTitle}".`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
    } catch (error) {
      logger.error(
        { error },
        `[GeminiService] Failed to generate overview for ${seriesTitle} Season ${seasonNumber}`,
      );
      return null;
    }
  }
}
