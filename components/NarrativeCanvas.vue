<template><canvas :id="canvasId" :canvas-id="canvasId" class="narrative-canvas" :style="{width:'1080px',height:height+'px'}" /></template>
<script>
import {layoutRecordWork} from '../common/card-layout-v7.js';
import {layoutStudioCardV6} from '../common/card-layout-v6.js';
import {layoutStudioCard} from "../common/card-layout-v5.js";
import {layoutComposedCard} from "../common/card-layout-v4.js";
import { layoutCard, measureWithCanvas, renderCardPage } from '../common/card-renderer.js';
import { resolveNarrativePhoto, releaseNarrativePhoto } from '../common/narrative-media.js';
export default {
  // Fixed backing area avoids native/H5 canvas resize races. Square exports crop
  // the top 1080px; portrait exports use the full 1440px. No giant canvas.
  data: () => ({ canvasId: `narrative_${Math.random().toString(36).slice(2)}`, height: 1440 }),
  methods: {
    async render(input, scope, petId, isCurrent, {firstPageOnly=false,example=false}={}) {
      const ctx = uni.createCanvasContext(this.canvasId, this);
      const measure=(text,size)=>measureWithCanvas(ctx,text,size);
      const pages = input.templateVersion===7 ? layoutRecordWork(input,measure) : input.templateVersion===6 ? layoutStudioCardV6(input,measure) : input.templateVersion===5 ? layoutStudioCard(input,measure) : input.templateVersion===4 ? layoutComposedCard(input,measure) : layoutCard(input,measure);
      if(input.seal?.placementMode==='free' && input.seal.pageIndex>=pages.length)throw Error('SEAL_PAGE_MISSING');
      pages.forEach((p,i)=>{p.pageIndex=i;});
      this.lastLayout=pages;
      // Ephemeral editor guidance, not a persisted source or render command.
      this.lastTextBounds=pages.map(p=>p.commands.filter(op=>op.type==='text'&&op.text.trim()).map(op=>[op.x,op.y,measure(op.text,op.size),op.size*1.15]));
      const results = [];
      for (const page of pages) {
        if(input.templateVersion>=3 && input.seal && (input.seal.placementMode!=='free'||(page.pageIndex||0)===input.seal.pageIndex))page.seal=input.seal;
        if (!isCurrent()) throw new Error('CARD_CANCELLED');
        await this.$nextTick();
        const photos = [];
        try {
          for (const op of page.commands.filter(c => c.type === 'photo')) if (!photos[op.index]) {
            if(example){photos[op.index]=await new Promise((success,fail)=>uni.getImageInfo({src:'/static/card-studio-example.png',success,fail}));continue;}
            photos[op.index] = await resolveNarrativePhoto(input.media[op.index], scope, petId);
          }
          results.push(await renderCardPage(ctx, page, photos, this.canvasId, this, isCurrent));
        } finally { photos.forEach(p => releaseNarrativePhoto(p.path)); }
        if(firstPageOnly)break;
      }
      return results;
    }
  }
};
</script>
<style scoped>.narrative-canvas { position:fixed;left:-12000px;top:0;pointer-events:none; }</style>
