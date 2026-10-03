/* Gate 2 revision-02: shorter smooth CRT shutdown and original-logo blurred copy. Integer-frame deterministic; no reference recreation/audio. */
(() => {
 'use strict';
 const W=1920,H=1080,FPS=30,COUNT=90;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const progress=(f,a,b)=>clamp((f-a)/(b-a));
 const lerp=(a,b,t)=>a+(b-a)*t;
 function bezier(x,x1,y1,x2,y2){if(x<=0||x>=1)return clamp(x);const at=(t,a,b)=>3*(1-t)**2*t*a+3*(1-t)*t*t*b+t*t*t;let lo=0,hi=1;for(let i=0;i<24;i++){const m=(lo+hi)/2;if(at(m,x1,x2)<x)lo=m;else hi=m;}return at((lo+hi)/2,y1,y2);}
 const outCubic=x=>bezier(x,.33,1,.68,1),inOutCubic=x=>bezier(x,.65,0,.35,1);
 let design;
 function state(f){
  f=clamp(Math.round(f),0,COUNT-1);
  const t=design.timing,s=design.shutdown;
  const line=inOutCubic(progress(f,...t.line_crossfade_frames));
  return {frame:f,black:f>=t.pure_black_frames[0],opacity:outCubic(progress(f,...t.fade_in_frames)),pulse:f>t.symbol_pulse_frames[0]&&f<t.symbol_pulse_frames[1]?Math.sin(Math.PI*progress(f,...t.symbol_pulse_frames))**2:0,height:lerp(H,s.line_height_px,inOutCubic(progress(f,...t.vertical_squeeze_frames))),width:lerp(W,s.point_width_px,inOutCubic(progress(f,...t.line_shrink_frames))),lineOpacity:line,pictureOpacity:1-line,pointOpacity:1-inOutCubic(progress(f,...t.point_fade_frames)),backgroundLevel:1-inOutCubic(progress(f,t.vertical_squeeze_frames[0],t.line_shrink_frames[1]))};
 }
 window.__outro={state,ready:false,error:null};window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};
 window.__hf.buildReady.outro=initialize().catch(error=>{window.__outro.error=String(error.stack||error);console.error(error);throw error;});
 async function initialize(){
  const response=await fetch('/assets/brand/brand.json');if(!response.ok)throw new Error('Local brand.json failed');const brand=await response.json();design=brand.outro_revision_02_proposal;
  if(design.frame_count!==COUNT||design.duration_seconds!==3||design.fps!==FPS)throw new Error('Unexpected authorized outro properties');
  const layout=design.logo,effect=design.symbol_effect;
  const canvas=document.getElementById('picture'),ctx=canvas.getContext('2d',{alpha:false});
  const layer=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
  const logoPath='/'+brand.tokens[layout.token].value,asset=new Image();asset.src=logoPath;await asset.decode();
  if(asset.naturalWidth!==319||asset.naturalHeight!==56)throw new Error('Original logo dimensions changed');
  const width=asset.naturalWidth/asset.naturalHeight*layout.height,x=layout.center[0]-width/2,y=layout.center[1]-layout.height/2;
  const logo=layer();logo.getContext('2d').drawImage(asset,x,y,width,layout.height);
  const echo=layer(),ec=echo.getContext('2d');ec.filter=`blur(${design.blurred_copy.blur_px}px)`;ec.drawImage(logo,0,0);window.__outro.echoCanvas=echo;
  window.__outro.logoCanvas=logo;window.__outro.logo={ready:true,source:logoPath,wholeOriginalSVG:true,naturalWidth:319,naturalHeight:56,width,height:layout.height,center:layout.center,bounds:{left:x,right:x+width,top:y,bottom:y+layout.height}};
  const source=await fetch(logoPath);if(!source.ok)throw new Error('Official SVG mask source failed');const svgText=await source.text(),doc=new DOMParser().parseFromString(svgText,'image/svg+xml');if(doc.querySelector('parsererror'))throw new Error('Invalid official SVG');
  const svg=document.importNode(doc.documentElement,true),paths=Array.from(svg.children).filter(p=>p.localName==='path');if(paths.length!==9)throw new Error('Expected original symbol plus eight wordmark paths');
  const holder=document.createElement('div');holder.style.cssText='position:fixed;left:-10000px;top:-10000px;visibility:hidden';holder.append(svg);document.body.append(holder);
  const bbox=p=>{const b=p.getBBox();return{x:b.x,y:b.y,width:b.width,height:b.height};},sb=bbox(paths[0]),wordmarkBBoxes=paths.slice(1).map(bbox);holder.remove();
  const scale=layout.height/56,symbolBounds={left:x+sb.x*scale,right:x+(sb.x+sb.width)*scale,top:y+sb.y*scale,bottom:y+(sb.y+sb.height)*scale},wordmarkLeft=x+Math.min(...wordmarkBBoxes.map(b=>b.x))*scale,padding=3*effect.blur_px;
  const region={left:Math.floor(symbolBounds.left-padding),right:Math.ceil(Math.min(symbolBounds.right+padding,(symbolBounds.right+wordmarkLeft)/2)),top:Math.floor(symbolBounds.top-padding),bottom:Math.ceil(symbolBounds.bottom+padding)};
  if(region.right>=wordmarkLeft)throw new Error('Symbol glow reaches wordmark');
  const maskSVG=svg.cloneNode(true);Array.from(maskSVG.children).filter(p=>p.localName==='path').slice(1).forEach(p=>p.remove());const maskPath=maskSVG.querySelector('path');
  if(maskPath.getAttribute('d')!==paths[0].getAttribute('d')||maskPath.getAttribute('fill')!==paths[0].getAttribute('fill')||maskSVG.getAttribute('viewBox')!==svg.getAttribute('viewBox'))throw new Error('Official symbol attributes changed');
  const maskAsset=new Image();maskAsset.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(maskSVG));await maskAsset.decode();const mask=layer();mask.getContext('2d').drawImage(maskAsset,x,y,width,layout.height);
  const halo=layer(),hc=halo.getContext('2d');hc.filter=`blur(${effect.blur_px}px)`;hc.drawImage(mask,0,0);
  const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  window.__outro.symbolMaskCanvas=mask;window.__outro.effect={source:logoPath,sourceSHA256:await digest(svgText),sourcePathSHA256:await digest(paths[0].getAttribute('d')),isolatedPathSHA256:await digest(maskPath.getAttribute('d')),originalFill:maskPath.getAttribute('fill'),originalViewBox:maskSVG.getAttribute('viewBox'),pathCount:1,symbolBBox:sb,wordmarkBBoxes,symbolBounds,wordmarkLeft,region,scale,design:effect};
  const bgHex=brand.tokens[design.background_token].value,bg=[1,3,5].map(i=>parseInt(bgHex.slice(i,i+2),16)),white=brand.tokens[design.shutdown.line_color_token].normalized_srgb_hex;
  window.__outro.palette={background:bgHex,yellow:brand.tokens.BRAND_YELLOW.value,line:white,finalRGB:design.shutdown_endpoint_rgb};
  const picture=layer(),pc=picture.getContext('2d');
  const beam=layer(),bc=beam.getContext('2d');bc.fillStyle=white;bc.shadowColor=white;bc.shadowBlur=design.shutdown.line_blur_px;bc.fillRect(0,(H-design.shutdown.line_height_px)/2,W,design.shutdown.line_height_px);
  window.__outro.echo={blur:design.blurred_copy.blur_px,opacity:design.blurred_copy.opacity,originalAlignedSVG:true};
  function drawFrame(f,options={}){
   const s=state(f);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=s.black?'rgb(0,0,0)':`rgb(${bg.map(v=>Math.round(v*s.backgroundLevel)).join(',')})`;ctx.fillRect(0,0,W,H);
   if(s.black){window.__outro.lastState=s;return;}
   pc.globalAlpha=1;pc.globalCompositeOperation='source-over';pc.clearRect(0,0,W,H);pc.drawImage(logo,0,0);
   if(options.echo!==false){pc.globalCompositeOperation='lighter';pc.globalAlpha=design.blurred_copy.opacity;pc.drawImage(echo,0,0);pc.globalAlpha=1;pc.globalCompositeOperation='source-over';}
   if(s.pulse>0&&options.pulse!==false){pc.save();pc.beginPath();pc.rect(region.left,region.top,region.right-region.left,region.bottom-region.top);pc.clip();pc.globalCompositeOperation='lighter';pc.globalAlpha=s.pulse*effect.highlight;pc.drawImage(mask,0,0);pc.globalAlpha=s.pulse*effect.halo;pc.drawImage(halo,0,0);pc.restore();}
   ctx.globalAlpha=s.opacity*s.pointOpacity*s.pictureOpacity;ctx.drawImage(picture,0,0,W,H,(W-s.width)/2,(H-s.height)/2,s.width,s.height);
   if(s.lineOpacity>0){ctx.globalAlpha=s.lineOpacity*s.pointOpacity*design.shutdown.line_opacity;ctx.drawImage(beam,0,0,W,H,(W-s.width)/2,0,s.width,H);}
   ctx.globalAlpha=1;window.__outro.lastState=s;
  }
  window.__outro.drawFrame=drawFrame;let time=0;
  const timeline={duration:()=>3,totalDuration:()=>3,time(v){return v===undefined?time:this.totalTime(v);},totalTime(v){if(v===undefined)return time;time=clamp(Number(v)||0,0,3);drawFrame(Math.min(89,Math.round(time*FPS)));return this;},seek(v){return this.totalTime(v);},pause(){return this;},play(){return this;},getChildren(){return[];}};
  window.__timelines=window.__timelines||{};window.__timelines.outro=timeline;drawFrame(0);window.__outro.ready=true;
 }
})();
