import { NextRequest, NextResponse } from 'next/server';
import { DecompositionStageError, SamConceptProvider } from '@/lib/architectural-decomposer';
import OpenAI from 'openai';
import { serializeArchitecturalDecomposition, validateImageDimensions } from '@/lib/architectural-decomposition';

export const runtime = 'nodejs';

const MAX_IMAGE_DATA_URL_LENGTH = 16 * 1024 * 1024;
const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function clientKey(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
}

function allowed(key: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(key, recent);
    return false;
  }
  recent.push(now);
  requestLog.set(key, recent);
  return true;
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value);
}

export async function POST(request: NextRequest) {
  const key = clientKey(request);
  if (!allowed(key)) {
    return NextResponse.json({ error: 'Too many decomposition requests. Please try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null) as {
    imageDataUrl?: unknown;
    imageWidth?: unknown;
    imageHeight?: unknown;
  } | null;
  if (!body || !isImageDataUrl(body.imageDataUrl)) {
    return NextResponse.json({ error: 'A base64 image data URL is required.' }, { status: 400 });
  }
  if (body.imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return NextResponse.json({ error: 'The image is too large for decomposition.' }, { status: 413 });
  }
  const imageWidth = Number(body.imageWidth);
  const imageHeight = Number(body.imageHeight);
  try {
    validateImageDimensions(imageWidth, imageHeight);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid image dimensions.' }, { status: 400 });
  }

  const apiKey = process.env.META_MODEL_API_KEY || process.env.MODEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: 'SAM 3.1 access is not configured.',
      code: 'provider_unconfigured',
    }, { status: 503 });
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), 120_000);
  const abortFromRequest = () => timeoutController.abort();
  request.signal.addEventListener('abort', abortFromRequest, { once: true });
  try {
    const provider = new SamConceptProvider(apiKey);
    const result = await provider.decompose({
      imageDataUrl: body.imageDataUrl,
      imageWidth,
      imageHeight,
      signal: timeoutController.signal,
    });
    return NextResponse.json(serializeArchitecturalDecomposition(result));
  } catch (error) {
    const aborted = timeoutController.signal.aborted;
    const original = error instanceof DecompositionStageError ? error.originalError : error;
    // Do not log error messages or response bodies: upstream errors may contain request data.
    console.error('Architectural decomposition error', {
      stage: error instanceof DecompositionStageError ? error.stage : 'provider_setup_or_serialization',
      concept: error instanceof DecompositionStageError ? error.concept : undefined,
      errorType: original instanceof OpenAI.APIError ? 'APIError' : original instanceof RangeError ? 'RangeError' : original instanceof SyntaxError ? 'SyntaxError' : original instanceof Error ? 'Error' : 'unknown',
      upstreamStatus: original instanceof OpenAI.APIError ? original.status : undefined,
      aborted,
    });
    return NextResponse.json({
      error: aborted ? 'Architectural decomposition timed out or was cancelled.' : 'Architectural decomposition failed.',
      code: aborted ? 'provider_timeout' : 'provider_error',
    }, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener('abort', abortFromRequest);
  }
}
