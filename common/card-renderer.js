import {drawFreeSeal} from './seal-transform.js';
import {drawPetSeal,sealBox} from './pet-seal.js';
import { layoutCard, photoRect } from './card-layout.js';
export function canvasCallback(start, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CARD_TIMEOUT')), timeout);
    start(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export function measureWithCanvas(ctx, text, size) { ctx.setFontSize(size); return ctx.measureText(text).width; }
export async function renderCardPage(ctx, page, photos, canvasId, component, isCurrent) {
  if (!isCurrent()) throw new Error('CARD_CANCELLED');
  ctx.setFillStyle(page.background); ctx.fillRect(0, 0, page.width, page.height);
  ctx.setTextBaseline('top');
  for (const op of page.commands) {
    if (op.type === 'rect') { ctx.setFillStyle(op.color); ctx.fillRect(...op.box); }
    if (op.type === 'text') { ctx.setFontSize(op.size); ctx.setFillStyle(op.color); ctx.fillText(op.text, op.x, op.y); }
    if (op.type === 'line') { ctx.setStrokeStyle(op.color); ctx.setLineWidth(2); ctx.beginPath(); ctx.moveTo(...op.from); ctx.lineTo(...op.to); ctx.stroke(); }
    if (op.type === 'photo') {
      const photo = photos[op.index]; if (!photo?.path) throw new Error('MEDIA_SOURCE_MISSING');
      const rect = photoRect(photo, op.box, op.fit);
      ctx.save(); ctx.beginPath(); ctx.rect(...op.box); ctx.clip(); ctx.drawImage(photo.path, ...rect.dest); ctx.restore();
    }
  }
  if(page.seal?.asset&&page.seal.enabled!==false){if(page.seal.placementMode==='free'){if((page.pageIndex||0)===page.seal.pageIndex)drawFreeSeal(ctx,page,page.seal,box=>drawPetSeal(ctx,page.seal.asset,box,page.seal.style));}else drawPetSeal(ctx,page.seal.asset,(page.sealBox||sealBox(page,page.seal)),page.seal.style);}
  await canvasCallback(resolve => ctx.draw(false, resolve));
  if (!isCurrent()) throw new Error('CARD_CANCELLED');
  const result = await canvasCallback((success, fail) => uni.canvasToTempFilePath({ canvasId, x: 0, y: 0, width: page.width, height: page.height,
    destWidth: page.width, destHeight: page.height, fileType: 'png', success, fail }, component));
  if (!isCurrent()) throw new Error('CARD_CANCELLED');
  if (!result.tempFilePath) throw new Error('CARD_EXPORT_FAILED');
  return result.tempFilePath;
}
// Sequential pages and explicit receipts allow retrying only unfinished pages.
export function createCardExportSession() {
  return { state: 'idle', epoch: 0, key: '', pages: [], saved: [], error: '',
    cancel() { this.epoch++; this.state = 'cancelled'; },
    invalidate() { this.cancel(); this.key = ''; this.pages = []; this.saved = []; this.state = 'idle'; },
    async prepare(key, render) {
      if (['preparing', 'rendering', 'saving'].includes(this.state)) return false;
      if (this.key === key && this.pages.length) { this.state = 'ready'; return true; }
      const epoch = ++this.epoch; this.state = 'preparing'; this.error = ''; this.pages = []; this.saved = [];
      try { this.state = 'rendering'; const pages = await render(() => this.epoch === epoch); if (this.epoch !== epoch) return false;
        this.pages = pages; this.key = key; this.state = 'ready'; return true;
      } catch (error) { if (this.epoch === epoch) { this.state = 'failed'; this.error = error.code || error.message || 'CARD_EXPORT_FAILED'; } return false; }
    },
    async save(savePage) {
      if (!this.pages.length || this.state === 'saving') return false;
      const epoch = this.epoch; this.state = 'saving'; this.error = '';
      try { for (let i = 0; i < this.pages.length; i++) {
        if (this.saved.includes(i)) continue;
        await savePage(this.pages[i], i); if (this.epoch !== epoch) return false; this.saved.push(i);
      } this.state = 'saved'; return true;
      } catch (error) { if (this.epoch === epoch) { this.state = 'failed'; this.error = error.code || error.message || 'CARD_SAVE_FAILED'; } return false; }
    }
  };
}
export { layoutCard };
