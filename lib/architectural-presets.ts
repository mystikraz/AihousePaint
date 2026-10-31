export interface ArchitecturalZone {
  id: string;
  name: string;
  description: string;
  // Array of [x, y] normalized coordinates (0 to 100)
  polygon: [number, number][];
  // Sub-polygons to exclude (e.g. windows, wooden door, railings)
  holes?: [number, number][][];
  defaultColor: string; // hex
  defaultCode: string; // Bihani shade code
}

export interface ArchitecturalPreset {
  id: string;
  name: string;
  category: 'Exterior Villa' | 'Modern Interior';
  imageSrc: string;
  aspectRatio: number; // width / height
  zones: ArchitecturalZone[];
  description: string;
}

export const ARCHITECTURAL_PRESETS: ArchitecturalPreset[] = [
  {
    id: 'modern_villa',
    name: 'Contemporary 2-Story Villa',
    category: 'Exterior Villa',
    imageSrc: '/images/modern_villa.jpg',
    aspectRatio: 16 / 9,
    description: 'Modern luxury 2-story residence with cantilevered balcony, vertical staircase tower, and textured fluted panel.',
    zones: [
      {
        id: 'zone_1',
        name: 'Main Ground Floor Facade',
        description: 'Lower white stucco surrounding the entryway and foundation level',
        polygon: [
          [21.5, 55.5],
          [45.5, 55.5],
          [45.5, 80.5],
          [21.5, 80.5],
        ],
        holes: [
          // Glass sliding doors on ground floor
          [
            [23.5, 57.0],
            [43.5, 57.0],
            [43.5, 79.5],
            [23.5, 79.5],
          ],
        ],
        defaultColor: '#f7f8f9',
        defaultCode: '1001W',
      },
      {
        id: 'zone_2',
        name: 'Upper Left Balcony & Bedroom Projection',
        description: 'Cantilevered architectural box enclosing the upper primary suite and balcony',
        polygon: [
          [10.5, 16.0],
          [46.5, 16.0],
          [46.5, 56.0],
          [10.5, 56.0],
        ],
        holes: [
          // Upper balcony interior and glass railing
          [
            [12.5, 25.0],
            [44.0, 25.0],
            [44.0, 49.5],
            [12.5, 49.5],
          ],
        ],
        defaultColor: '#147a82',
        defaultCode: '2434C',
      },
      {
        id: 'zone_3',
        name: 'Center Textured Groove Siding Panel',
        description: 'Vertical textured fluted facade panel adjoining the central entryway',
        polygon: [
          [46.5, 24.5],
          [54.5, 24.5],
          [54.5, 80.5],
          [46.5, 80.5],
        ],
        holes: [
          // Wooden front door
          [
            [55.8, 58.5],
            [61.5, 58.5],
            [61.5, 80.5],
            [55.8, 80.5],
          ],
        ],
        defaultColor: '#343840',
        defaultCode: '2404D',
      },
      {
        id: 'zone_4',
        name: 'Right Vertical Staircase Tower Pillars',
        description: 'Vertical architectural structural pillars framing the multistory glazing',
        polygon: [
          [62.0, 17.0],
          [77.2, 17.0],
          [77.2, 81.5],
          [62.0, 81.5],
        ],
        holes: [
          // Glazed vertical stair window panes
          [
            [66.2, 26.5],
            [69.0, 26.5],
            [69.0, 77.0],
            [66.2, 77.0],
          ],
          [
            [71.5, 26.5],
            [74.2, 26.5],
            [74.2, 77.0],
            [71.5, 77.0],
          ],
        ],
        defaultColor: '#5f556b',
        defaultCode: '2252C',
      },
      {
        id: 'zone_5',
        name: 'Right Balcony & Recess',
        description: 'Eastern bedroom facade surrounding the upper and lower double-height windows',
        polygon: [
          [77.2, 28.5],
          [92.0, 28.5],
          [92.0, 81.0],
          [77.2, 81.0],
        ],
        holes: [
          // Upper right window
          [
            [77.2, 35.0],
            [87.0, 35.0],
            [87.0, 56.0],
            [77.2, 56.0],
          ],
          // Lower right window
          [
            [77.2, 57.5],
            [87.0, 57.5],
            [87.0, 79.5],
            [77.2, 79.5],
          ],
        ],
        defaultColor: '#dedad0',
        defaultCode: '1038W',
      },
      {
        id: 'zone_6',
        name: 'Roof Parapet & Sunshade Cornice',
        description: 'Upper cantilevered roofline trim, sunshade fascia, and coping cornice',
        polygon: [
          [10.5, 16.0],
          [46.5, 16.0],
          [46.5, 25.0],
          [10.5, 25.0],
        ],
        defaultColor: '#0f4f56',
        defaultCode: '2412D',
      },
    ],
  },
  {
    id: 'interior_living',
    name: 'Modern Living Interior',
    category: 'Modern Interior',
    imageSrc: '/images/interior_living.jpg',
    aspectRatio: 16 / 9,
    description: 'High-ceiling open-plan living room with fireplace feature pillar, timber fluted wall, and garden viewing window.',
    zones: [
      {
        id: 'int_zone_1',
        name: 'Main Fireplace Feature Pillar',
        description: 'Left vertical chimney breast & hearth pillar wall',
        polygon: [
          [10.0, 0.0],
          [28.5, 0.0],
          [28.5, 83.0],
          [10.0, 83.0],
        ],
        holes: [
          // Fireplace opening
          [
            [22.0, 58.0],
            [28.0, 58.0],
            [28.0, 72.0],
            [22.0, 72.0],
          ],
        ],
        defaultColor: '#147a82',
        defaultCode: '2434C',
      },
      {
        id: 'int_zone_2',
        name: 'Back Fluted Accent Wall',
        description: 'Center feature accent wall behind sofa',
        polygon: [
          [31.5, 24.5],
          [69.5, 24.5],
          [69.5, 68.0],
          [31.5, 68.0],
        ],
        holes: [
          // Center art frame
          [
            [52.5, 36.5],
            [62.5, 36.5],
            [62.5, 57.5],
            [52.5, 57.5],
          ],
        ],
        defaultColor: '#583c2e',
        defaultCode: '2979D',
      },
      {
        id: 'int_zone_3',
        name: 'Upper Ceiling Beam & Transom',
        description: 'Overhead structural concrete beam and ceiling cove header',
        polygon: [
          [28.5, 10.0],
          [70.0, 10.0],
          [70.0, 24.5],
          [28.5, 24.5],
        ],
        defaultColor: '#eceae4',
        defaultCode: '1010W',
      },
      {
        id: 'int_zone_4',
        name: 'Right Window Alcove Wall',
        description: 'Right wall framing the large outdoor view window',
        polygon: [
          [70.0, 19.5],
          [73.5, 19.5],
          [73.5, 75.0],
          [70.0, 75.0],
        ],
        defaultColor: '#4d5c41',
        defaultCode: '2959C',
      },
    ],
  },
];
