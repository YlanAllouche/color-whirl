export type SvgToneFixture = {
  name: string;
  svg: string;
  maxTones: number;
  expectedBucketCount: number;
  expectedFillRichnessMin: number;
  expectedStrokeRichnessMin: number;
};

export const svgToneFixtures: SvgToneFixture[] = [
  {
    name: 'linear gradient fill preserves multiple tone buckets',
    maxTones: 6,
    expectedBucketCount: 3,
    expectedFillRichnessMin: 3,
    expectedStrokeRichnessMin: 0,
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#05070c" />
            <stop offset="45%" stop-color="#6f7f95" />
            <stop offset="100%" stop-color="#eef4ff" />
          </linearGradient>
        </defs>
        <rect x="10" y="12" width="100" height="96" rx="12" fill="url(#sky)" />
      </svg>
    `.trim()
  },
  {
    name: 'radial stroke gradient contributes stroke buckets',
    maxTones: 6,
    expectedBucketCount: 2,
    expectedFillRichnessMin: 0,
    expectedStrokeRichnessMin: 2,
    svg: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
        <defs>
          <radialGradient id="ring" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fafafa" stop-opacity="0.35" />
            <stop offset="60%" stop-color="#7f8ea3" />
            <stop offset="100%" stop-color="#18202d" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="34" stroke="url(#ring)" stroke-width="14" />
      </svg>
    `.trim()
  }
];
