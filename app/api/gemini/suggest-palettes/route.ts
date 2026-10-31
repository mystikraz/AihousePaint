import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { BIHANI_COLORS } from '@/lib/bihani-colors';
import { ARCHITECTURAL_PRESETS } from '@/lib/architectural-presets';
import { Type } from '@google/genai';

export interface PaletteSuggestionTheme {
  id: string;
  title: string;
  concept: string;
  zones: {
    zoneId: string;
    zoneName: string;
    colorCode: string;
    colorName: string;
    colorHex: string;
  }[];
}

const FALLBACK_THEMES: PaletteSuggestionTheme[] = [
  {
    id: 'modern_himalayan_oasis',
    title: 'Modern Himalayan Oasis',
    concept:
      'Inspired by high-altitude glacial lakes and crisp Himalayan summits. Features Bihani signature Azure Teal as the striking cantilever accent paired with serene Himalayan White and Charcoal basalt panels.',
    zones: [
      {
        zoneId: 'zone_1',
        zoneName: 'Main Ground Floor Facade',
        colorCode: '1001W',
        colorName: 'Pure Himalaya White',
        colorHex: '#f7f8f9',
      },
      {
        zoneId: 'zone_2',
        zoneName: 'Upper Left Balcony & Bedroom Projection',
        colorCode: '2434C',
        colorName: 'Bihani Azure Teal',
        colorHex: '#147a82',
      },
      {
        zoneId: 'zone_3',
        zoneName: 'Center Textured Groove Siding Panel',
        colorCode: '2404D',
        colorName: 'Charcoal Slate',
        colorHex: '#343840',
      },
      {
        zoneId: 'zone_4',
        zoneName: 'Right Vertical Staircase Tower Pillars',
        colorCode: '2483C',
        colorName: 'Teal Mist',
        colorHex: '#31929f',
      },
      {
        zoneId: 'zone_5',
        zoneName: 'Right Balcony & Recess',
        colorCode: '1010W',
        colorName: 'Off White Silk',
        colorHex: '#eceae4',
      },
      {
        zoneId: 'zone_6',
        zoneName: 'Roof Parapet & Sunshade Cornice',
        colorCode: '2412D',
        colorName: 'Deep Marine',
        colorHex: '#0f4f56',
      },
    ],
  },
  {
    id: 'royal_kathmandu_dusk',
    title: 'Royal Kathmandu Dusk',
    concept:
      'Elegantly evokes the twilight sky over the historic Durbar Squares of Patan and Lalitpur. Blends refined mauve-slate tones with terracotta accents and warm alabaster plaster.',
    zones: [
      {
        zoneId: 'zone_1',
        zoneName: 'Main Ground Floor Facade',
        colorCode: '1024W',
        colorName: 'Alabaster Warmth',
        colorHex: '#e8e2d5',
      },
      {
        zoneId: 'zone_2',
        zoneName: 'Upper Left Balcony & Bedroom Projection',
        colorCode: '2252C',
        colorName: 'Lalitpur Dusk',
        colorHex: '#5f556b',
      },
      {
        zoneId: 'zone_3',
        zoneName: 'Center Textured Groove Siding Panel',
        colorCode: '2287C',
        colorName: 'Slate Velvet',
        colorHex: '#483f52',
      },
      {
        zoneId: 'zone_4',
        zoneName: 'Right Vertical Staircase Tower Pillars',
        colorCode: '2889C',
        colorName: 'Patan Twilight',
        colorHex: '#776985',
      },
      {
        zoneId: 'zone_5',
        zoneName: 'Right Balcony & Recess',
        colorCode: '2280C',
        colorName: 'Mauve Whisper',
        colorHex: '#8d7f99',
      },
      {
        zoneId: 'zone_6',
        zoneName: 'Roof Parapet & Sunshade Cornice',
        colorCode: '2329C',
        colorName: 'Plum Shadow',
        colorHex: '#443346',
      },
    ],
  },
  {
    id: 'alpine_meadow_earth',
    title: 'Alpine Meadow Earth',
    concept:
      'Harmonizes with surrounding lush subtropical gardens and cedar timber details. Combines Chitwan forest and Cardamom greens with warm Mustang sandstone and earthy basalt foundation bands.',
    zones: [
      {
        zoneId: 'zone_1',
        zoneName: 'Main Ground Floor Facade',
        colorCode: '2602C',
        colorName: 'Mustang Sandstone',
        colorHex: '#b39878',
      },
      {
        zoneId: 'zone_2',
        zoneName: 'Upper Left Balcony & Bedroom Projection',
        colorCode: '2489D',
        colorName: 'Cardamom Green',
        colorHex: '#3d6148',
      },
      {
        zoneId: 'zone_3',
        zoneName: 'Center Textured Groove Siding Panel',
        colorCode: '2993D',
        colorName: 'Earthy Basalt',
        colorHex: '#3f3833',
      },
      {
        zoneId: 'zone_4',
        zoneName: 'Right Vertical Staircase Tower Pillars',
        colorCode: '2924C',
        colorName: 'Chitwan Forest',
        colorHex: '#2f573c',
      },
      {
        zoneId: 'zone_5',
        zoneName: 'Right Balcony & Recess',
        colorCode: '2574C',
        colorName: 'Misty Sage',
        colorHex: '#899986',
      },
      {
        zoneId: 'zone_6',
        zoneName: 'Roof Parapet & Sunshade Cornice',
        colorCode: '2979D',
        colorName: 'Annapurna Cedar',
        colorHex: '#583c2e',
      },
    ],
  },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { presetId } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ themes: FALLBACK_THEMES });
    }

    const ai = getGeminiClient();
    const activePreset =
      ARCHITECTURAL_PRESETS.find((p) => p.id === presetId) ||
      ARCHITECTURAL_PRESETS[0];

    const prompt = `You are Bihani Paints Nepal's Chief Exterior Color Stylist.
We need 3 distinct, curated color palettes for this building preset: "${activePreset.name}".
Building zones to paint:
${activePreset.zones.map((z) => `- ${z.id}: ${z.name}`).join('\n')}

Authentic Bihani colors available:
${BIHANI_COLORS.map((c) => `${c.code} (${c.name}, ${c.hex})`).join(', ')}

Provide 3 curated themes titled:
1. "Modern Himalayan Oasis"
2. "Royal Kathmandu Dusk"
3. "Alpine Meadow Earth"

For each theme, explain the architectural concept and assign one authentic Bihani color to each zone above.`;

    const callPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a premier architectural paint consultant for Bihani Paints in Nepal. Respond with valid JSON adhering to the specified schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            themes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  concept: { type: Type.STRING },
                  zones: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        zoneId: { type: Type.STRING },
                        zoneName: { type: Type.STRING },
                        colorCode: { type: Type.STRING },
                        colorName: { type: Type.STRING },
                        colorHex: { type: Type.STRING },
                      },
                      required: [
                        'zoneId',
                        'zoneName',
                        'colorCode',
                        'colorName',
                        'colorHex',
                      ],
                    },
                  },
                },
                required: ['id', 'title', 'concept', 'zones'],
              },
            },
          },
          required: ['themes'],
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout')), 3500)
    );

    const response: any = await Promise.race([callPromise, timeoutPromise]);
    const jsonText = response.text?.trim() || '{}';
    const parsed = JSON.parse(jsonText);

    if (parsed.themes && parsed.themes.length > 0) {
      return NextResponse.json({ themes: parsed.themes });
    }

    return NextResponse.json({ themes: FALLBACK_THEMES });
  } catch (error) {
    return NextResponse.json({ themes: FALLBACK_THEMES });
  }
}
