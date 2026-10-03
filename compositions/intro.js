/* Gate 1 only. All state is a pure function of the integer frame and brand.json. */
(() => {
  'use strict';
  const W = 1920, H = 1080, FPS = 30, COUNT = 135;
  const TITLE = 'Ecosystem Updates';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const progress = (f, a, b) => clamp((f - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  // Solve the supplied cubic-bezier's x before evaluating its y.
  function bezier(x, x1, y1, x2, y2) {
    if (x <= 0 || x >= 1) return clamp(x);
    const at = (t, a, b) => 3 * (1-t) ** 2 * t * a + 3 * (1-t) * t*t * b + t*t*t;
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (at(m,x1,x2) < x) lo=m; else hi=m; }
    return at((lo+hi)/2,y1,y2);
  }
  const outExpo = x => bezier(x,.16,1,.3,1);
  const outCubic = x => bezier(x,.33,1,.68,1);
  const inOutCubic = x => bezier(x,.65,0,.35,1);
  function hash(n) { n = Math.imul(n ^ (n >>> 16),0x7feb352d); n = Math.imul(n ^ (n >>> 15),0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
  const flicker = [0,1,.2,1,0,.6,1,.4];
  let symbolEffect;
  function state(f) {
    f = clamp(Math.round(f),0,COUNT-1);
    const exit = inOutCubic(progress(f,120,134));
    return {
      frame:f, endpoint:f<=5 || f===134,
      apertureWidth:f<6?0:f<=12?lerp(8,W,outExpo(progress(f,6,12))):W,
      apertureHeight:f<6?0:f<=12?4:f<20?lerp(4,H,outCubic(progress(f,12,20))):H,
      lineOpacity:f<6||f>=20?0:f<=12?1:1-progress(f,12,20),
      flash:f<12?0:f<=16?.85*outCubic(progress(f,12,16)):f<36?.85*(1-outCubic(progress(f,16,36))):0,
      barrel:(f<16?.12:f<36?lerp(.12,.04,outCubic(progress(f,16,36))):.04)*(f<=5||f===134?0:1-exit),
      brightness:f<16?1.6:f<36?lerp(1.6,1,outCubic(progress(f,16,36))):1,
      noiseOpacity:f>=20&&f<=30?lerp(.35,.06,outCubic(progress(f,20,30))):.06,
      logoOpacity:f<30?0:f<=37?flicker[f-30]:1-exit,
      titleOpacity:outCubic(progress(f,42,54))*(1-exit),
      titleOffsetY:8*(1-outCubic(progress(f,42,54))),
      split:f>=30&&f<=48?12*(1-outExpo(progress(f,30,48))):0,
      jitter:f>=30&&f<=36?(hash(0xB0B000+f)/0xffffffff*12-6):0,
      glow:f<36?.4:f<=48?lerp(.4,.15,progress(f,36,48)):.15,
      titleScale:1+.04*exit,
      crtOpacity:f<=5||f===134?0:1-exit,
      scanDrift:f>=48?f-48:0,
      rollY:f>=60&&f<=110?lerp(-60,H+60,progress(f,60,110)):-1000,
      noiseSeed:hash(0xC47F0000+f),
      symbolPulse:symbolEffect&&f>symbolEffect.frames[0]&&f<symbolEffect.frames[1]?Math.sin(Math.PI*progress(f,...symbolEffect.frames))**2:0
    };
  }
  window.__intro = {state, ready:false, error:null, title:TITLE};
  window.__hf = window.__hf || {};
  window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady.intro = initialize().catch(error => { window.__intro.error = String(error.stack||error); console.error(error); throw error; });

  async function initialize() {
    const response = await fetch('/assets/brand/brand.json');
    if (!response.ok) throw new Error('Local brand.json failed: '+response.status);
    const brand = await response.json();
    const proposal = brand.title_design_proposal;
    const layout = brand.intro_design_proposal;
    symbolEffect = layout.symbol_effect;
    const fontSize = layout.title.cap_height * proposal.font_metadata.units_per_em / proposal.font_metadata.cap_height_units;
    const font = `${proposal.weight} ${fontSize}px Inter`;
    const faces = await document.fonts.load(font, TITLE);
    await document.fonts.ready;
    if (!faces.length || !document.fonts.check(font,TITLE)) throw new Error('Inter SemiBold did not load');
    const canvas = document.getElementById('picture');
    const gl = canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,depth:false,stencil:false});
    if (!gl) throw new Error('WebGL2 is required for the specified barrel distortion');
    const title = document.createElement('canvas'); title.width=W;title.height=H;
    const ctx = title.getContext('2d'); ctx.font=font;ctx.textBaseline='alphabetic';ctx.fillStyle=brand.tokens.BRAND_WHITE.normalized_srgb_hex;ctx.letterSpacing=layout.title.tracking_px+'px';
    const m = ctx.measureText(TITLE);
    const x = layout.title.center[0] + (m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2;
    const baseline = layout.title.center[1] + (m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2;
    ctx.fillText(TITLE,x,baseline);
    const glow = document.createElement('canvas');glow.width=W;glow.height=H;
    const gctx=glow.getContext('2d');gctx.filter='blur(24px)';gctx.drawImage(title,0,0);
    window.__intro.font = {family:proposal.family,style:proposal.style,fontSize,fontReady:true,loadedFaceCount:faces.length,capHeightTarget:layout.title.cap_height,capHeightFromMetadata:fontSize*proposal.font_metadata.cap_height_units/proposal.font_metadata.units_per_em,bounds:{left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:baseline-m.actualBoundingBoxAscent,bottom:baseline+m.actualBoundingBoxDescent},center:layout.title.center,weight:proposal.weight,tracking:layout.title.tracking_px};
    window.__intro.titleCanvas = title;
    const logoPath='/'+brand.tokens[layout.logo.token].value;
    const logoAsset=new Image();logoAsset.src=logoPath;await logoAsset.decode();
    if(logoAsset.naturalWidth!==319||logoAsset.naturalHeight!==56)throw new Error('Original logo aspect ratio changed');
    const logo=document.createElement('canvas');logo.width=W;logo.height=H;
    const lctx=logo.getContext('2d');
    const logoWidth=logoAsset.naturalWidth/logoAsset.naturalHeight*layout.logo.height;
    const logoX=layout.logo.center[0]-logoWidth/2,logoY=layout.logo.center[1]-layout.logo.height/2;
    lctx.drawImage(logoAsset,logoX,logoY,logoWidth,layout.logo.height);
    const logoGlow=document.createElement('canvas');logoGlow.width=W;logoGlow.height=H;
    const lgctx=logoGlow.getContext('2d');lgctx.filter='blur(24px)';lgctx.drawImage(logo,0,0);
    window.__intro.logoCanvas=logo;
    window.__intro.logo={ready:true,source:logoPath,wholeOriginalSVG:true,naturalWidth:logoAsset.naturalWidth,naturalHeight:logoAsset.naturalHeight,width:logoWidth,height:layout.logo.height,center:layout.logo.center,bounds:{left:logoX,right:logoX+logoWidth,top:logoY,bottom:logoY+layout.logo.height}};
    // Keep the complete official lockup above as the base. This effect-only mask
    // clones its first artwork path without modifying any original attribute.
    const svgResponse=await fetch(logoPath);if(!svgResponse.ok)throw new Error('Official SVG mask source failed');
    const svgText=await svgResponse.text();
    const svgDocument=new DOMParser().parseFromString(svgText,'image/svg+xml');
    if(svgDocument.querySelector('parsererror'))throw new Error('Official SVG mask source is invalid');
    const svg=document.importNode(svgDocument.documentElement,true);
    const artwork=Array.from(svg.children).filter(node=>node.localName==='path');
    if(artwork.length!==9)throw new Error('Expected original symbol plus eight wordmark paths');
    const bbox=path=>{const b=path.getBBox();return {x:b.x,y:b.y,width:b.width,height:b.height};};
    const holder=document.createElement('div');holder.style.cssText='position:fixed;left:-10000px;top:-10000px;visibility:hidden';holder.append(svg);document.body.append(holder);
    const symbolBBox=bbox(artwork[0]),wordmarkBBoxes=artwork.slice(1).map(bbox);
    const firstLetterX=Math.min(...wordmarkBBoxes.map(b=>b.x));
    holder.remove();
    const k=layout.logo.height/logoAsset.naturalHeight;
    const symbolBounds={left:logoX+symbolBBox.x*k,right:logoX+(symbolBBox.x+symbolBBox.width)*k,top:logoY+symbolBBox.y*k,bottom:logoY+(symbolBBox.y+symbolBBox.height)*k};
    const wordmarkLeft=logoX+firstLetterX*k;
    const padding=3*symbolEffect.blur_px;
    const region={left:Math.floor(symbolBounds.left-padding),right:Math.ceil(Math.min(symbolBounds.right+padding,(symbolBounds.right+wordmarkLeft)/2)),top:Math.floor(symbolBounds.top-padding),bottom:Math.ceil(symbolBounds.bottom+padding)};
    if(region.right>=wordmarkLeft||region.bottom>=window.__intro.font.bounds.top)throw new Error('Symbol effect region reaches wordmark/title');
    const maskSVG=svg.cloneNode(true);Array.from(maskSVG.children).filter(node=>node.localName==='path').slice(1).forEach(node=>node.remove());
    const maskPath=maskSVG.querySelector('path');
    if(maskPath.getAttribute('d')!==artwork[0].getAttribute('d')||maskPath.getAttribute('fill')!==artwork[0].getAttribute('fill')||maskSVG.getAttribute('viewBox')!==svg.getAttribute('viewBox'))throw new Error('Original symbol attributes changed');
    const maskSource=new XMLSerializer().serializeToString(maskSVG);
    const maskAsset=new Image();maskAsset.src='data:image/svg+xml;base64,'+btoa(maskSource);await maskAsset.decode();
    const symbolMask=document.createElement('canvas');symbolMask.width=W;symbolMask.height=H;
    symbolMask.getContext('2d').drawImage(maskAsset,logoX,logoY,logoWidth,layout.logo.height);
    const symbolHalo=document.createElement('canvas');symbolHalo.width=W;symbolHalo.height=H;
    const shctx=symbolHalo.getContext('2d');shctx.filter=`blur(${symbolEffect.blur_px}px)`;shctx.drawImage(symbolMask,0,0);
    const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    window.__intro.symbolMaskCanvas=symbolMask;
    window.__intro.symbolEffect={source:logoPath,sourceSHA256:await digest(svgText),selector:'/svg/path[1]',sourcePathSHA256:await digest(artwork[0].getAttribute('d')),isolatedPathSHA256:await digest(maskPath.getAttribute('d')),originalFill:maskPath.getAttribute('fill'),originalViewBox:maskSVG.getAttribute('viewBox'),pathCount:maskSVG.querySelectorAll('path').length,symbolBBox,wordmarkBBoxes,scale:k,symbolBounds,wordmarkLeft,region,design:symbolEffect};
    const vertex = `#version 300 es
      in vec2 position;
      void main() { gl_Position=vec4(position,0.0,1.0); }`;
    const fragment = `#version 300 es
      precision highp float; precision highp int;
      out vec4 outputColor;
      uniform sampler2D titleImage, glowImage, logoImage, logoGlowImage, symbolImage, symbolHaloImage;
      uniform vec3 bg, yellow, white;
      uniform vec2 aperture;
      uniform float lineOpacity, flash, barrel, brightness, noiseOpacity, logoOpacity, titleOpacity, titleOffsetY, split, jitter, glow, titleScale, crtOpacity, scanDrift, rollY;
      uniform uint noiseSeed;
      uniform bool endpoint;
      uniform float symbolPulse, symbolHighlight, symbolHalo;
      uniform vec4 symbolRegion;
      uint hash(uint n) { n=(n^(n>>16))*uint(0x7feb352d);n=(n^(n>>15))*uint(0x846ca68b);return n^(n>>16); }
      float maskAt(vec2 p) { return texture(titleImage,p/vec2(1920.,1080.)).a; }
      void main() {
        if(endpoint) { outputColor=vec4(bg,1.);return; }
        vec2 p=vec2(gl_FragCoord.x,1080.-gl_FragCoord.y);
        vec2 n=(p-vec2(960.,540.))/vec2(960.,540.);
        vec2 warped=vec2(960.,540.)+n*(1.+barrel*dot(n,n))*vec2(960.,540.);
        vec2 t=vec2(960.,638.)+(warped-vec2(960.,638.))/titleScale-vec2(0.,titleOffsetY);
        vec2 l=vec2(960.,450.)+(warped-vec2(960.,450.))/titleScale-vec2(jitter,0.);
        vec4 logoR=texture(logoImage,(l+vec2(split,0.))/vec2(1920.,1080.));
        vec4 logoG=texture(logoImage,l/vec2(1920.,1080.));
        vec4 logoB=texture(logoImage,(l-vec2(split,0.))/vec2(1920.,1080.));
        vec3 logoInk=vec3(logoR.r*logoR.a,logoG.g*logoG.a,logoB.b*logoB.a);
        float logoAlpha=max(logoR.a,max(logoG.a,logoB.a));
        vec3 picture=bg*(1.-logoOpacity*logoAlpha)+logoOpacity*logoInk;
        picture+=logoOpacity*yellow*glow*texture(logoGlowImage,l/vec2(1920.,1080.)).a;
        picture=mix(picture,yellow,titleOpacity*maskAt(t));
        picture+=titleOpacity*yellow*glow*texture(glowImage,t/vec2(1920.,1080.)).a;
        if(symbolPulse>0.&&p.x>=symbolRegion.x&&p.x<symbolRegion.y&&p.y>=symbolRegion.z&&p.y<symbolRegion.w) {
          float symbol=texture(symbolImage,l/vec2(1920.,1080.)).a;
          float halo=texture(symbolHaloImage,l/vec2(1920.,1080.)).a;
          picture+=symbolPulse*yellow*(symbolHighlight*symbol+symbolHalo*halo);
        }
        picture=mix(picture,white,lineOpacity)*brightness;
        vec2 d=abs(p-vec2(960.,540.));
        bool inside=d.x<=aperture.x*.5&&d.y<=aperture.y*.5;
        vec3 color=inside?picture:bg;
        color=clamp(color+white*flash,0.,1.);
        uint ix=uint(p.x),iy=uint(p.y);
        float grain=float(hash(ix+iy*uint(1920)^noiseSeed)&uint(255))/255.;
        color=mix(color,vec3(grain),noiseOpacity*crtOpacity);
        float scan=mod(p.y-scanDrift+10000.,4.)<2.?1.:0.;
        color*=1.-.12*scan*crtOpacity;
        float edge=clamp(dot(n,n)*.5,0.,1.);
        color*=1.-.35*edge*crtOpacity;
        float band=max(0.,1.-abs(p.y-rollY)/60.);
        color*=1.+.08*band*crtOpacity;
        outputColor=vec4(clamp(color,0.,1.),1.);
      }`;
    function compile(type,source) { const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s; }
    const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    function texture(source,index,name) { gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);gl.uniform1i(gl.getUniformLocation(program,name),index); }
    texture(title,0,'titleImage');texture(glow,1,'glowImage');texture(logo,2,'logoImage');texture(logoGlow,3,'logoGlowImage');
    texture(symbolMask,4,'symbolImage');texture(symbolHalo,5,'symbolHaloImage');
    gl.uniform4f(gl.getUniformLocation(program,'symbolRegion'),region.left,region.right,region.top,region.bottom);
    gl.uniform1f(gl.getUniformLocation(program,'symbolHighlight'),symbolEffect.highlight);
    gl.uniform1f(gl.getUniformLocation(program,'symbolHalo'),symbolEffect.halo);
    const rgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
    gl.uniform3fv(gl.getUniformLocation(program,'bg'),rgb(brand.tokens.BRAND_BG.value));
    gl.uniform3fv(gl.getUniformLocation(program,'yellow'),rgb(brand.tokens.BRAND_YELLOW.value));
    const whiteRGB=rgb(brand.tokens.BRAND_WHITE.normalized_srgb_hex);
    gl.uniform3fv(gl.getUniformLocation(program,'white'),whiteRGB);
    window.__intro.palette={background:brand.tokens.BRAND_BG.value,yellow:brand.tokens.BRAND_YELLOW.value,white:brand.tokens.BRAND_WHITE.normalized_srgb_hex,whiteRGB};
    const loc={};for(const name of ['aperture','lineOpacity','flash','barrel','brightness','noiseOpacity','logoOpacity','titleOpacity','titleOffsetY','split','jitter','glow','titleScale','crtOpacity','scanDrift','rollY','noiseSeed','endpoint','symbolPulse'])loc[name]=gl.getUniformLocation(program,name);
    function drawFrame(frame) {
      const s=state(frame);
      gl.uniform2f(loc.aperture,s.apertureWidth,s.apertureHeight);
      for(const name of ['lineOpacity','flash','barrel','brightness','noiseOpacity','logoOpacity','titleOpacity','titleOffsetY','split','jitter','glow','titleScale','crtOpacity','scanDrift','rollY','symbolPulse'])gl.uniform1f(loc[name],s[name]);
      gl.uniform1ui(loc.noiseSeed,s.noiseSeed);gl.uniform1i(loc.endpoint,s.endpoint?1:0);
      gl.drawArrays(gl.TRIANGLES,0,6);gl.finish();
      if(gl.getError()!==gl.NO_ERROR)throw new Error('WebGL draw failed at frame '+s.frame);
      window.__intro.lastState=s;
    }
    window.__intro.drawFrame=drawFrame;
    let time=0;
    const timeline={duration:()=>4.5,totalDuration:()=>4.5,time(v){return v===undefined?time:this.totalTime(v);},totalTime(v){if(v===undefined)return time;time=clamp(Number(v)||0,0,4.5);drawFrame(Math.min(134,Math.round(time*FPS)));return this;},seek(v){return this.totalTime(v);},pause(){return this;},play(){return this;},getChildren(){return [];}};
    window.__timelines=window.__timelines||{};window.__timelines.intro=timeline;
    drawFrame(0);window.__intro.ready=true;
  }
})();
