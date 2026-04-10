import { readFileSync } from 'fs';
const normalize = (line) => line
  .trim()
  .replace(/\s*→\s*/g, ' → ');
const cgv = readFileSync('CaloGeometry.cgv', 'utf8')
  .split(/\r?\n/)
  .map((l) => normalize(l))
  .filter(Boolean);
const parents = [
  'Calorimeter → EMBarrel1n_0 → EMBarrel1n0_0',
  'Calorimeter → EMBarrel1n_0 → EMBarrel1n1_1',
  'Calorimeter → EMBarrel1n_0 → EMBarrel1n2_2',
  'Calorimeter → EMBarrel1p_0 → EMBarrel1p0_0',
  'Calorimeter → EMBarrel1p_0 → EMBarrel1p1_1',
  'Calorimeter → EMBarrel1p_0 → EMBarrel1p2_2',
];
for (const parent of parents) {
  console.log('PARENT', parent);
  const children = cgv.filter((l) => l.startsWith(parent));
  console.log(children.slice(0, 60).join('\n'));
  console.log('COUNT', children.length);
  console.log('---');
}
