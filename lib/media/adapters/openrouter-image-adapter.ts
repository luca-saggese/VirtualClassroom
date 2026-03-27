/**
 * OpenRouter Image Generation Adapter
 *
 * Uses OpenAI-compatible Images API via OpenRouter.
 * Endpoint: https://openrouter.ai/api/v1/images/generations
 */

import type {
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '../types';

const DEFAULT_MODEL = 'openai/gpt-image-1';
const DEFAULT_BASE_URL = 'https://openrouter.ai';

export async function testOpenRouterImageConnectivity(
  config: ImageGenerationConfig,
): Promise<{ success: boolean; message: string }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  try {
    const response = await fetch(`${baseUrl}/api/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || DEFAULT_MODEL,
        prompt: '',
        size: '1024x1024',
        n: 1,
      }),
    });

    if (response.status === 401 || response.status === 403) {
      const text = await response.text();
      return {
        success: false,
        message: `OpenRouter Image auth failed (${response.status}): ${text}`,
      };
    }

    return { success: true, message: 'Connected to OpenRouter Image' };
  } catch (err) {
    return { success: false, message: `OpenRouter Image connectivity error: ${err}` };
  }
}

function resolveSize(options: ImageGenerationOptions): string {
  const width = options.width || 1024;
  const height = options.height || 1024;
  return `${width}x${height}`;
}

export async function generateWithOpenRouterImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  const response = await fetch(`${baseUrl}/api/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt || undefined,
      size: resolveSize(options),
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter Image generation failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const imageData = data.data?.[0];

  if (!imageData) {
    throw new Error('OpenRouter Image returned empty response');
  }

  return {
    url: imageData.url,
    base64: imageData.b64_json,
    width: options.width || 1024,
    height: options.height || 1024,
  };
}
