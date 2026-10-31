export interface BihaniColor {
  code: string;
  name: string;
  hex: string;
  category: 'Weatherproof Exterior' | 'Vibrant Accents' | 'Pastels & Tints' | 'Earth & Greens' | 'Neutrals & Whites';
  description?: string;
}

export const BIHANI_COLORS: BihaniColor[] = [
  // Featured Teals & Blues
  { code: '2434C', name: 'Bihani Azure Teal', hex: '#147a82', category: 'Weatherproof Exterior', description: 'Signature Bihani deep marine teal with superior UV endurance' },
  { code: '2413C', name: 'Ocean Vista', hex: '#1d8f99', category: 'Weatherproof Exterior', description: 'Vibrant coastal teal with crisp reflective tone' },
  { code: '2412D', name: 'Deep Marine', hex: '#0f4f56', category: 'Weatherproof Exterior', description: 'Ultra-rich architectural shadow teal' },
  { code: '2474T', name: 'Himalayan Sky', hex: '#4caec4', category: 'Pastels & Tints', description: 'Clear high-altitude cyan with soothing light dispersion' },
  { code: '2398C', name: 'Glacier Blue', hex: '#7cc7d4', category: 'Pastels & Tints', description: 'Airy alpine tint for modern trims and ceilings' },
  { code: '2483C', name: 'Teal Mist', hex: '#31929f', category: 'Weatherproof Exterior', description: 'Balanced exterior accent teal' },
  { code: '2469C', name: 'Pokhara Lake', hex: '#267b8a', category: 'Weatherproof Exterior', description: 'Calm lake blue-green inspired by Phewa Lake' },
  { code: '2497C', name: 'Nordic Ice', hex: '#a2d6de', category: 'Pastels & Tints', description: 'Gentle frosted tint for soft morning light' },
  { code: '2518C', name: 'Alpine Cyan', hex: '#3b9ea8', category: 'Vibrant Accents', description: 'Punchy contemporary cyan for entryway pillars' },
  { code: '2462C', name: 'Baltic Deep', hex: '#165763', category: 'Weatherproof Exterior', description: 'Heavy shadow teal for plinths and foundation walls' },
  { code: '2476C', name: 'Aquamarine', hex: '#23a2b3', category: 'Vibrant Accents', description: 'Luminous accent shade for balconies and cantilever projections' },
  { code: '2504C', name: 'Skyward Breeze', hex: '#87cfdb', category: 'Pastels & Tints', description: 'Soft skywash tint' },
  { code: '3440D', name: 'Midnight Indigo', hex: '#13283f', category: 'Weatherproof Exterior', description: 'Deepest architectural night indigo for framing panels' },
  { code: '2461D', name: 'Shadow Teal', hex: '#0d383e', category: 'Weatherproof Exterior', description: 'Monumental deep forest teal' },
  { code: '2475D', name: 'Cobalt Peak', hex: '#184761', category: 'Weatherproof Exterior', description: 'Mountain shadow navy blue' },
  { code: '2482D', name: 'River Stone Teal', hex: '#225d67', category: 'Weatherproof Exterior', description: 'Weathered riverbed teal' },
  { code: '2503D', name: 'Sapphire Night', hex: '#11354e', category: 'Vibrant Accents', description: 'Rich midnight sapphire' },
  { code: '2455C', name: 'Calm Harbor', hex: '#357788', category: 'Pastels & Tints', description: 'Muted slate teal with coastal softness' },
  { code: '2441C', name: 'Dusk Lagoon', hex: '#276270', category: 'Weatherproof Exterior', description: 'Atmospheric twilight teal' },
  { code: '2460D', name: 'Dark Current', hex: '#0e343a', category: 'Weatherproof Exterior', description: 'Stately dark accent tone' },
  { code: '2511C', name: 'Arctic Glow', hex: '#b7e4ea', category: 'Pastels & Tints', description: 'Crisp highlight tint' },

  // Dusk Slates & Mauves
  { code: '2252C', name: 'Lalitpur Dusk', hex: '#5f556b', category: 'Weatherproof Exterior', description: 'Elegantly muted slate mauve inspired by historic Lalitpur' },
  { code: '2280C', name: 'Mauve Whisper', hex: '#8d7f99', category: 'Pastels & Tints', description: 'Soft powdery lilac-slate for upper bedrooms' },
  { code: '2287C', name: 'Slate Velvet', hex: '#483f52', category: 'Weatherproof Exterior', description: 'Deep architectural twilight purple' },
  { code: '2651C', name: 'Monsoon Cloud', hex: '#636573', category: 'Weatherproof Exterior', description: 'Neutralized stormy grey with purple undertones' },
  { code: '2329C', name: 'Plum Shadow', hex: '#443346', category: 'Vibrant Accents', description: 'Sophisticated dark aubergine accent' },
  { code: '2889C', name: 'Patan Twilight', hex: '#776985', category: 'Weatherproof Exterior', description: 'Historic Newari valley dusk tone' },
  { code: '2404D', name: 'Charcoal Slate', hex: '#343840', category: 'Weatherproof Exterior', description: 'Timeless dark basalt for modern siding' },
  { code: '2882C', name: 'Smoky Amethyst', hex: '#54465b', category: 'Vibrant Accents', description: 'Rich mineral violet for feature facade' },
  { code: '2370D', name: 'Gorkha Granite', hex: '#41404c', category: 'Weatherproof Exterior', description: 'Sturdy mountain rock grey' },
  { code: '2284C', name: 'Vintage Rose Grey', hex: '#94838f', category: 'Pastels & Tints', description: 'Warm muted mauve-tinted grey' },
  { code: '2335C', name: 'Thamel Lavender', hex: '#9d8ea4', category: 'Pastels & Tints', description: 'Chic bohemian dusk lavender' },
  { code: '2301C', name: 'Starlight Heather', hex: '#b6a9be', category: 'Pastels & Tints', description: 'Soft airy heather for porch soffits' },

  // Earth, Greens & Neutrals
  { code: '2602C', name: 'Mustang Sandstone', hex: '#b39878', category: 'Earth & Greens', description: 'Warm desert canyon stone from Upper Mustang' },
  { code: '2924C', name: 'Chitwan Forest', hex: '#2f573c', category: 'Earth & Greens', description: 'Deep subtropical evergreen for lush contrast' },
  { code: '2489D', name: 'Cardamom Green', hex: '#3d6148', category: 'Earth & Greens', description: 'Organic herbal green with matte finish' },
  { code: '2384D', name: 'Terra Cotta Heritage', hex: '#9e4e37', category: 'Vibrant Accents', description: 'Authentic fired clay tile red-orange' },
  { code: '2516D', name: 'Moss Ochre', hex: '#686a3b', category: 'Earth & Greens', description: 'Earthy lichen olive for garden boundary walls' },
  { code: '2959C', name: 'Olive Crest', hex: '#4d5c41', category: 'Earth & Greens', description: 'Subdued olive drab for exterior panels' },
  { code: '2391D', name: 'Himalayan Clay', hex: '#87513d', category: 'Earth & Greens', description: 'Warm earthen masonry tone' },
  { code: '2510D', name: 'Pine Needle', hex: '#22442e', category: 'Earth & Greens', description: 'Highland conifer dark forest green' },
  { code: '2459T', name: 'Bamboo Grove', hex: '#77996f', category: 'Earth & Greens', description: 'Refreshing natural stalk green' },
  { code: '2931C', name: 'Everest Khaki', hex: '#8c8574', category: 'Earth & Greens', description: 'Rugged expedition khaki' },
  { code: '2574C', name: 'Misty Sage', hex: '#899986', category: 'Pastels & Tints', description: 'Gentle silver-green tint for tranquil exterior' },
  { code: '2560C', name: 'Lumbini Leaf', hex: '#5e8557', category: 'Earth & Greens', description: 'Peaceful garden foliage green' },
  { code: '2979D', name: 'Annapurna Cedar', hex: '#583c2e', category: 'Earth & Greens', description: 'Rich dark timber brown' },
  { code: '2972D', name: 'Raw Umber', hex: '#6d5444', category: 'Earth & Greens', description: 'Earthy loam brown for architectural base' },
  { code: '2993D', name: 'Earthy Basalt', hex: '#3f3833', category: 'Earth & Greens', description: 'Charred rock brown-black' },
  { code: '2840C', name: 'Warm Taupe', hex: '#95887e', category: 'Neutrals & Whites', description: 'Comfortable balanced neutral for entire villas' },
  { code: '2579C', name: 'Herbal Linen', hex: '#b5b29f', category: 'Neutrals & Whites', description: 'Textured straw linen off-white' },
  { code: '2581C', name: 'Subtle Ochre', hex: '#c5b89a', category: 'Earth & Greens', description: 'Light desert sandstone hue' },
  { code: '2480T', name: 'Matcha Tint', hex: '#acc1a3', category: 'Pastels & Tints', description: 'Crisp botanical pastel' },
  { code: '1001W', name: 'Pure Himalaya White', hex: '#f7f8f9', category: 'Neutrals & Whites', description: 'Brilliant high-reflectance pure exterior white' },
  { code: '1010W', name: 'Off White Silk', hex: '#eceae4', category: 'Neutrals & Whites', description: 'Soft cashmere off-white for glare-free facade' },
  { code: '1024W', name: 'Alabaster Warmth', hex: '#e8e2d5', category: 'Neutrals & Whites', description: 'Warm creamy stone white' },
  { code: '1038W', name: 'Pearl Sand', hex: '#dedad0', category: 'Neutrals & Whites', description: 'Sophisticated textured light greige' },
];

export const CATEGORIES = [
  'All Colors',
  'Weatherproof Exterior',
  'Vibrant Accents',
  'Pastels & Tints',
  'Earth & Greens',
  'Neutrals & Whites',
] as const;

export const DEFAULT_COLOR = BIHANI_COLORS[0]; // 2434C Bihani Azure Teal
