import { NextRequest, NextResponse } from 'next/server';
import { textTransferSchema, urlTransferSchema, validateAndNormalizeUrl } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, content, title } = body;

    if (!type || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: type and content.' },
        { status: 400 }
      );
    }

    if (type === 'url') {
      const parsed = urlTransferSchema.safeParse({ url: content, title });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid URL' },
          { status: 400 }
        );
      }

      const normalized = validateAndNormalizeUrl(content);
      const item = {
        id: `ext-${Date.now()}`,
        type: 'url',
        content: normalized.normalizedUrl,
        title: title || normalized.domain,
        source: req.headers.get('x-bridge-device') || 'Chrome Extension',
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, item }, { status: 201 });
    } else if (type === 'text') {
      const parsed = textTransferSchema.safeParse({ content, title });
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Invalid text content' },
          { status: 400 }
        );
      }

      const item = {
        id: `ext-${Date.now()}`,
        type: 'text',
        content,
        title: title || 'Text Note',
        source: req.headers.get('x-bridge-device') || 'Chrome Extension',
        createdAt: new Date().toISOString(),
      };

      return NextResponse.json({ success: true, item }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Unsupported transfer type.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Bridge Transfer Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}
