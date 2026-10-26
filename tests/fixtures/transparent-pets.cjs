'use strict';
// Deterministic, antialiased RGBA animal fixtures. No network or image provider.
const { PNG } = require('../../uniCloud-alipay/cloudfunctions/api_pet_avatar/node_modules/pngjs');
function ellipse(x, y, cx, cy, rx, ry) { return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1; }
function triangle(x, y, a, b, c) {
  const side = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
  const d = [side(a,b), side(b,c), side(c,a)]; return !(d.some(v => v < 0) && d.some(v => v > 0));
}
function inside(kind, x, y) {
  if (kind === 'dog') return ellipse(x,y,510,650,300,160) || ellipse(x,y,745,430,125,160) || ellipse(x,y,825,475,115,65) ||
    ellipse(x,y,650,510,115,250) || ellipse(x,y,275,820,50,170) || ellipse(x,y,635,820,48,170) || ellipse(x,y,110,590,125,42) || ellipse(x,y,190,630,135,46);
  return ellipse(x,y,470,705,220,290) || ellipse(x,y,455,390,190,175) ||
    triangle(x,y,[282,334],[295,140],[414,275]) || triangle(x,y,[503,261],[653,153],[628,344]) ||
    ellipse(x,y,370,960,100,42) || ellipse(x,y,560,960,100,42) || ellipse(x,y,719,811,100,52) ||
    ellipse(x,y,797,728,62,110) || ellipse(x,y,789,630,35,78);
}
function makePetFixture(kind = 'cat', options = {}) {
  const width = options.width || 1600, height = options.height || 2200;
  const offsetX = options.offsetX ?? 350, offsetY = options.offsetY ?? 550;
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let samples = 0;
    for (const dy of [.25, .75]) for (const dx of [.25,.75]) if (inside(kind,x + dx - offsetX,y + dy - offsetY)) samples++;
    const i = (y * width + x) * 4;
    const px = x - offsetX, py = y - offsetY;
    const eye = kind !== 'dog' && (ellipse(px,py,385,372,18,23) || ellipse(px,py,515,372,18,23));
    const muzzle = kind !== 'dog' && ellipse(px,py,450,449,66,45);
    const c = eye ? [55,57,45] : muzzle ? [228,211,178] : kind === 'dog' ? [146,106,69] : [177,127,76];
    png.data[i] = c[0]; png.data[i+1] = c[1]; png.data[i+2] = c[2]; png.data[i+3] = Math.round(samples / 4 * 255);
  }
  if (options.noise !== false) { png.data[3] = 4; png.data[((height - 1) * width + width - 1) * 4 + 3] = 7; }
  return PNG.sync.write(png);
}
module.exports = { makePetFixture };
