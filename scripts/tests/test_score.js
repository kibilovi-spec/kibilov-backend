const altKeys = ['BMW', '5 (E60) 6 (E63) 01/04 - 12/10', 'უკანა სამუხრუჭე ხუნდი'];
const brandLow = 'bmw';
const partKaLow = 'წინა სამუხრუჭე ხუნდი';
const name = 'უკანა სამუხრუჭე ხუნდი | BMW 5 (E60)'.toLowerCase();

let score = 0;
if (partKaLow && name.includes(partKaLow)) score += 40;
if (partKaLow && altKeys.some(k => k === partKaLow)) score += 35;
const hasPartMatch = partKaLow && (name.includes(partKaLow) || altKeys.some(k => k.includes(partKaLow)));
if (brandLow && name.includes(brandLow)) score += hasPartMatch ? 20 : 5;
if (brandLow && altKeys.some(k => k.toLowerCase().includes(brandLow))) score += hasPartMatch ? 15 : 3;

console.log('score:', score);
console.log('hasPartMatch:', hasPartMatch);
console.log('name has bmw:', name.includes(brandLow));
console.log('altKeys has bmw:', altKeys.some(k => k.toLowerCase().includes(brandLow)));
