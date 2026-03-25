import { debugExtractSvgToneSummary } from './svg-tone-extraction.js';
import { svgToneFixtures } from './svg-tone-extraction.fixtures.js';

type DomParserLike = new () => { parseFromString(input: string, mimeType: string): Document };

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDomParser(): Promise<void> {
  if (typeof DOMParser !== 'undefined') return;
  const { DOMParser: XmldomParser } = await import('@xmldom/xmldom');
  (globalThis as { DOMParser?: DomParserLike }).DOMParser = XmldomParser as unknown as DomParserLike;
}

function verifyFixture(fixture: (typeof svgToneFixtures)[number]): void {
  const summary = debugExtractSvgToneSummary(fixture.svg, fixture.maxTones);
  const fillRichness = summary.layers.filter((layer) => layer.fillShapeCount > 0).length;
  const strokeRichness = summary.layers.filter((layer) => layer.strokePathCount > 0).length;

  assert(
    summary.bucketScores.length >= fixture.expectedBucketCount,
    `${fixture.name}: expected at least ${fixture.expectedBucketCount} tone buckets, got ${summary.bucketScores.length}`
  );
  assert(
    fillRichness >= fixture.expectedFillRichnessMin,
    `${fixture.name}: expected fill richness >= ${fixture.expectedFillRichnessMin}, got ${fillRichness}`
  );
  assert(
    strokeRichness >= fixture.expectedStrokeRichnessMin,
    `${fixture.name}: expected stroke richness >= ${fixture.expectedStrokeRichnessMin}, got ${strokeRichness}`
  );

  for (let i = 1; i < summary.bucketScores.length; i++) {
    assert(summary.bucketScores[i] >= summary.bucketScores[i - 1], `${fixture.name}: tone buckets are not sorted`);
  }
}

await ensureDomParser();

for (const fixture of svgToneFixtures) {
  verifyFixture(fixture);
}

console.log(`Verified ${svgToneFixtures.length} SVG tone fixtures.`);
