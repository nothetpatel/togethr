// Compress the animal models Blender exported (public/models/animals/*.raw.glb)
// into the files the app loads (*.glb): shared data merged, vertices
// quantised, meshopt-compressed. Keeps every node, including the empty pivots
// (head, legs, scarf...) the app animates. Run: npm run models
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, quantize, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const DIR = 'public/models/animals';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

for (const file of (await readdir(DIR)).filter((f) => f.endsWith('.raw.glb'))) {
  const src = join(DIR, file);
  const out = join(DIR, file.replace('.raw.glb', '.glb'));
  const doc = await io.read(src);
  await doc.transform(dedup(), weld(), quantize({ quantizeColor: 8, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(out, doc);
  const [a, b] = [(await stat(src)).size, (await stat(out)).size];
  console.log(`${out}  ${(a / 1024).toFixed(0)} KB → ${(b / 1024).toFixed(0)} KB`);
  await rm(src);
}
