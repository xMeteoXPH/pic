// ── themes.js ─────────────────────────────────────────────
// No Math.random() — fully deterministic, looks same on all devices.
// Solid color fallback is always drawn first by buildStrip in app.js.
// draw() adds decorative layers on top. No thick borders.

function _heart(ctx,cx,cy,s){
  ctx.beginPath();
  ctx.moveTo(cx,cy+s*.35);
  ctx.bezierCurveTo(cx,cy,cx-s*.6,cy-s*.3,cx-s*.6,cy-s*.05);
  ctx.bezierCurveTo(cx-s*.6,cy-s*.5,cx,cy-s*.5,cx,cy-s*.15);
  ctx.bezierCurveTo(cx,cy-s*.5,cx+s*.6,cy-s*.5,cx+s*.6,cy-s*.05);
  ctx.bezierCurveTo(cx+s*.6,cy-s*.3,cx,cy,cx,cy+s*.35);
  ctx.closePath();
}
function _star(ctx,cx,cy,r){
  ctx.beginPath();
  for(let i=0;i<10;i++){
    const a=(Math.PI/5)*i-Math.PI/2, rr=i%2===0?r:r*.42;
    i===0?ctx.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr):ctx.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);
  }
  ctx.closePath();
}
function _flower(ctx,cx,cy,r,pc,cc,alpha){
  ctx.save(); ctx.globalAlpha=alpha;
  for(let i=0;i<5;i++){
    const a=(Math.PI*2/5)*i;
    ctx.beginPath(); ctx.ellipse(cx+Math.cos(a)*r*.6,cy+Math.sin(a)*r*.6,r*.4,r*.22,a,0,Math.PI*2);
    ctx.fillStyle=pc; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(cx,cy,r*.28,0,Math.PI*2); ctx.fillStyle=cc; ctx.fill();
  ctx.restore();
}
function _diamond(ctx,cx,cy,r,color,alpha){
  ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color;
  ctx.beginPath(); ctx.moveTo(cx,cy-r); ctx.lineTo(cx+r*.55,cy); ctx.lineTo(cx,cy+r); ctx.lineTo(cx-r*.55,cy); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function _sparkle(ctx,cx,cy,r,color,alpha){
  ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color;
  ctx.beginPath();
  ctx.moveTo(cx,cy-r); ctx.lineTo(cx+r*.18,cy-r*.18);
  ctx.lineTo(cx+r,cy); ctx.lineTo(cx+r*.18,cy+r*.18);
  ctx.lineTo(cx,cy+r); ctx.lineTo(cx-r*.18,cy+r*.18);
  ctx.lineTo(cx-r,cy); ctx.lineTo(cx-r*.18,cy-r*.18);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function _dot(ctx,cx,cy,r,color,alpha){
  ctx.save(); ctx.globalAlpha=alpha; ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); ctx.restore();
}
// deterministic scatter — no Math.random
function _grid(w,h,cols,rows,fn){
  const cw=w/cols, ch=h/rows;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const jx=cw*.25*(((r*3+c*7)%10)/10-.5);
    const jy=ch*.25*(((r*7+c*3)%10)/10-.5);
    fn(c*cw+cw*.5+jx, r*ch+ch*.5+jy, r, c);
  }
}
// thin elegant double-line border
function _thinBorder(ctx,w,h,color){
  ctx.save();
  ctx.strokeStyle=color; ctx.lineWidth=3; ctx.globalAlpha=.55;
  ctx.strokeRect(12,12,w-24,h-24);
  ctx.lineWidth=1; ctx.globalAlpha=.3;
  ctx.strokeRect(20,20,w-40,h-40);
  ctx.restore();
}
// stars using golden ratio for even spread
function _stars(ctx,w,h,count,maxR,color){
  for(let i=0;i<count;i++){
    const x=(i*137.508%1)*w;
    const y=(i*0.618%1)*h;
    const r=maxR*(((i*7)%5+1)/5);
    const a=.15+(i%7)*.08;
    _dot(ctx,x,y,r,color,a);
  }
}

const THEMES = {

  'sakura': {
    color: '#ffd6e7', text: '#7d1535',
    draw(ctx,w,h){
      // rich layered gradient
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#fff0f5'); g.addColorStop(.4,'#ffd6e7'); g.addColorStop(1,'#ffb7c5');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // soft radial glow
      const glow=ctx.createRadialGradient(w*.3,h*.15,0,w*.3,h*.15,w*.6);
      glow.addColorStop(0,'rgba(255,200,220,.35)'); glow.addColorStop(1,'rgba(255,200,220,0)');
      ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
      // diagonal shimmer lines
      ctx.save(); ctx.globalAlpha=.07; ctx.strokeStyle='#ff4d88'; ctx.lineWidth=1;
      for(let i=-h;i<w+h;i+=18){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+h,h);ctx.stroke();}
      ctx.restore();
      // large faint bg flowers
      _grid(w,h,3,7,(x,y,r,c)=>_flower(ctx,x,y,28+((r+c)%3)*12,'#ffb7c5','#fff0f5',.2));
      // medium flowers
      _grid(w,h,5,13,(x,y,r,c)=>_flower(ctx,x,y,10+((r*3+c*5)%4)*5,'#ff4d88','#fff0f5',.55));
      // small hearts scattered
      _grid(w,h,4,11,(x,y,r,c)=>{
        ctx.save(); ctx.globalAlpha=.3; ctx.fillStyle='#ff80a0';
        _heart(ctx,x,y,6+((r+c)%3)*4); ctx.fill(); ctx.restore();
      });
      // vignette edge
      const vig=ctx.createRadialGradient(w/2,h/2,h*.3,w/2,h/2,h*.9);
      vig.addColorStop(0,'rgba(220,80,120,0)'); vig.addColorStop(1,'rgba(180,40,80,.15)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
      _thinBorder(ctx,w,h,'#ff4d88');
    }
  },

  'midnight-rose': {
    color: '#2a0018', text: '#ffb3cc',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#1a0010'); g.addColorStop(.5,'#3d0030'); g.addColorStop(1,'#1a001a');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // glowing orbs
      [{x:.2,y:.15,r:.5},{x:.8,y:.7,r:.55},{x:.5,y:.45,r:.6}].forEach(o=>{
        const gl=ctx.createRadialGradient(o.x*w,o.y*h,0,o.x*w,o.y*h,o.r*w);
        gl.addColorStop(0,'rgba(180,0,80,.22)'); gl.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gl; ctx.fillRect(0,0,w,h);
      });
      // large faint hearts
      _grid(w,h,3,8,(x,y,r,c)=>{
        ctx.save(); ctx.globalAlpha=.12; ctx.fillStyle='#ff2060';
        _heart(ctx,x,y,28+((r+c)%3)*10); ctx.fill(); ctx.restore();
      });
      // medium solid hearts
      _grid(w,h,5,14,(x,y,r,c)=>{
        ctx.save(); ctx.globalAlpha=.5; ctx.fillStyle='#cc003c';
        _heart(ctx,x,y,9+((r+c)%3)*5); ctx.fill(); ctx.restore();
      });
      // outline hearts
      _grid(w,h,4,11,(x,y,r,c)=>{
        ctx.save(); ctx.globalAlpha=.2; ctx.strokeStyle='#ff608a'; ctx.lineWidth=1;
        _heart(ctx,x,y,5+((r*2+c)%4)*3); ctx.stroke(); ctx.restore();
      });
      _thinBorder(ctx,w,h,'#cc003c');
    }
  },

  'cottagecore': {
    color: '#fde8c8', text: '#5c2a0a',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#fffbf0'); g.addColorStop(.5,'#fde8c8'); g.addColorStop(1,'#f5d0a0');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // linen texture
      ctx.save(); ctx.globalAlpha=.055; ctx.strokeStyle='#c8a87a'; ctx.lineWidth=1;
      for(let i=0;i<w;i+=5){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();}
      for(let i=0;i<h;i+=5){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();}
      ctx.restore();
      // large bg florals
      _grid(w,h,3,7,(x,y,r,c)=>_flower(ctx,x,y,28+((r+c)%3)*10,['#e8a87c','#d4957c','#f2c4a0'][c%3],'#fef3c7',.18));
      // medium florals
      const pc=['#e8765a','#d45a3a','#f29070'];
      _grid(w,h,4,12,(x,y,r,c)=>_flower(ctx,x,y,12+((r+c)%3)*6,pc[c%3],'#fde8a0',.65));
      // warm vignette
      const vig=ctx.createRadialGradient(w/2,h/2,h*.25,w/2,h/2,h*.85);
      vig.addColorStop(0,'rgba(200,120,60,0)'); vig.addColorStop(1,'rgba(140,70,20,.18)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
      _thinBorder(ctx,w,h,'#c8783a');
    }
  },

  'aurora': {
    color: '#050a14', text: '#a0ffea',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#050a14'); g.addColorStop(.4,'#08122a'); g.addColorStop(1,'#050a14');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // aurora bands
      [['rgba(0,255,180,.25)',.12],['rgba(60,80,255,.2)',.32],['rgba(0,200,255,.22)',.54],['rgba(160,0,255,.18)',.76]].forEach(([c,yf])=>{
        const gg=ctx.createLinearGradient(0,yf*h-70,0,yf*h+70);
        gg.addColorStop(0,'rgba(0,0,0,0)'); gg.addColorStop(.5,c); gg.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=gg; ctx.fillRect(0,0,w,h);
      });
      // wavy light lines
      [['rgba(0,255,180,.4)',.18],['rgba(80,140,255,.35)',.42],['rgba(0,220,255,.3)',.65]].forEach(([c,yf],k)=>{
        ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=2; ctx.globalAlpha=.9;
        ctx.beginPath();
        for(let x=0;x<=w;x+=2){
          const y=yf*h+Math.sin(x/w*Math.PI*6+k*1.3)*12+Math.sin(x/w*Math.PI*11+k)*5;
          x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
        }
        ctx.stroke(); ctx.restore();
      });
      // stars (deterministic)
      _stars(ctx,w,h,160,1.4,'#fff');
      // gradient border
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'rgba(0,255,180,.5)'); bg.addColorStop(.5,'rgba(80,120,255,.5)'); bg.addColorStop(1,'rgba(160,0,255,.5)');
      ctx.save(); ctx.strokeStyle=bg; ctx.lineWidth=3; ctx.globalAlpha=.8; ctx.strokeRect(12,12,w-24,h-24); ctx.restore();
    }
  },

  'golden-hour': {
    color: '#ff9f1c', text: '#3d1800',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#ff6b35'); g.addColorStop(.35,'#ff9f1c'); g.addColorStop(.7,'#ffcb47'); g.addColorStop(1,'#ffe08a');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // sun glow at top
      const sun=ctx.createRadialGradient(w*.5,-h*.05,0,w*.5,-h*.05,w*.8);
      sun.addColorStop(0,'rgba(255,245,180,.55)'); sun.addColorStop(.5,'rgba(255,200,60,.18)'); sun.addColorStop(1,'rgba(255,140,0,0)');
      ctx.fillStyle=sun; ctx.fillRect(0,0,w,h);
      // light rays
      ctx.save(); ctx.globalAlpha=.09; ctx.strokeStyle='#fff9e0'; ctx.lineWidth=2;
      for(let a=0;a<10;a++){ctx.beginPath();ctx.moveTo(w*.5,0);ctx.lineTo(w*.5+Math.cos((a/10)*Math.PI*2)*w*1.2,Math.sin((a/10)*Math.PI*2)*h*1.2);ctx.stroke();}
      ctx.restore();
      // bokeh rings (deterministic)
      for(let i=0;i<18;i++){
        const x=(i*137.5%1)*w, y=(i*0.618%1)*h, r=6+(i%5)*8;
        ctx.save(); ctx.globalAlpha=.07+(i%4)*.02; ctx.strokeStyle='#fff9cc'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); ctx.restore();
      }
      _thinBorder(ctx,w,h,'#ff6b35');
    }
  },

});

Object.assign(THEMES,{

  'lavender-dream':{
    color:'#e9d5ff', text:'#3b0764',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#f3e8ff'); g.addColorStop(.5,'#e9d5ff'); g.addColorStop(1,'#c4b5fd');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      [{x:.15,y:.2,r:.5,c:'rgba(167,139,250,.22)'},{x:.85,y:.65,r:.55,c:'rgba(192,132,252,.2)'},{x:.5,y:.5,r:.6,c:'rgba(221,214,254,.18)'}].forEach(o=>{
        const gg=ctx.createRadialGradient(o.x*w,o.y*h,0,o.x*w,o.y*h,o.r*w);
        gg.addColorStop(0,o.c); gg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gg; ctx.fillRect(0,0,w,h);
      });
      // large faint moons (circles offset = crescent look without compositing)
      _grid(w,h,3,8,(x,y,r,c)=>{
        const s=22+((r+c)%3)*8;
        ctx.save(); ctx.globalAlpha=.14; ctx.fillStyle='#8b5cf6';
        ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill(); ctx.restore();
      });
      _grid(w,h,5,14,(x,y,r,c)=>_sparkle(ctx,x,y,7+((r+c)%4)*4,'#8b5cf6',.5));
      _grid(w,h,7,18,(x,y,r,c)=>_dot(ctx,x,y,2+((r+c)%3)*.8,'#7c3aed',.28));
      _thinBorder(ctx,w,h,'#8b5cf6');
    }
  },

  'neon-cyber':{
    color:'#03001e', text:'#00ffe0',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#03001e'); g.addColorStop(.5,'#0a0030'); g.addColorStop(1,'#03001e');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // perspective grid
      ctx.save(); ctx.globalAlpha=.14; ctx.strokeStyle='#00ffe0'; ctx.lineWidth=.7;
      for(let x=0;x<w;x+=20){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=0;y<h;y+=20){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      ctx.restore();
      // glow blobs
      [{x:.15,y:.2,c:'rgba(0,255,224,.18)'},{x:.85,y:.75,c:'rgba(255,0,128,.18)'},{x:.5,y:.5,c:'rgba(80,0,255,.12)'}].forEach(o=>{
        const gg=ctx.createRadialGradient(o.x*w,o.y*h,0,o.x*w,o.y*h,w*.45);
        gg.addColorStop(0,o.c); gg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gg; ctx.fillRect(0,0,w,h);
      });
      const cols=['#00ffe0','#ff0080','#7700ff','#00b4ff'];
      _grid(w,h,5,14,(x,y,r,c)=>{
        const s=6+((r+c)%4)*4, col=cols[(r*2+c)%4];
        _diamond(ctx,x,y,s,col,.55);
        ctx.save(); ctx.globalAlpha=.18; ctx.strokeStyle=col; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x,y-s*1.6); ctx.lineTo(x+s*.88,y); ctx.lineTo(x,y+s*1.6); ctx.lineTo(x-s*.88,y); ctx.closePath(); ctx.stroke(); ctx.restore();
      });
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'rgba(0,255,224,.7)'); bg.addColorStop(.5,'rgba(255,0,128,.7)'); bg.addColorStop(1,'rgba(100,0,255,.7)');
      ctx.save(); ctx.strokeStyle=bg; ctx.lineWidth=3; ctx.globalAlpha=.9; ctx.strokeRect(12,12,w-24,h-24); ctx.restore();
    }
  },

  'blue-sky':{
    color:'#bae6fd', text:'#0c4a6e',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#bae6fd'); g.addColorStop(.55,'#7dd3fc'); g.addColorStop(1,'#38bdf8');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // sun
      const sun=ctx.createRadialGradient(w*.78,h*.05,0,w*.78,h*.05,90);
      sun.addColorStop(0,'rgba(255,245,150,.95)'); sun.addColorStop(.35,'rgba(255,220,80,.4)'); sun.addColorStop(1,'rgba(255,180,0,0)');
      ctx.fillStyle=sun; ctx.fillRect(0,0,w,h);
      // clouds — deterministic positions
      [[.14,.1,32],[.58,.07,27],[.34,.21,40],[.76,.17,23],[.09,.33,34],[.87,.41,29],[.46,.5,21],[.22,.6,31],[.68,.65,25],[.5,.74,37]].forEach(([xf,yf,r])=>{
        ctx.save(); ctx.globalAlpha=.88; ctx.fillStyle='#fff';
        [[-r*.5,r*.1],[0,-r*.1],[r*.5,r*.1],[r,r*.22],[-r,r*.22],[0,r*.24]].forEach(([dx,dy])=>{
          ctx.beginPath(); ctx.arc(xf*w+dx,yf*h+dy,r*.44,0,Math.PI*2); ctx.fill();
        }); ctx.restore();
      });
      _thinBorder(ctx,w,h,'#0ea5e9');
    }
  },

  'forest-moss':{
    color:'#dcfce7', text:'#14532d',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#f0fdf4'); g.addColorStop(.4,'#dcfce7'); g.addColorStop(1,'#86efac');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // dappled light (deterministic)
      for(let i=0;i<14;i++){
        const x=(i*137.5%1)*w, y=(i*0.618%1)*h, r=22+i*8;
        const gg=ctx.createRadialGradient(x,y,0,x,y,r);
        gg.addColorStop(0,'rgba(255,255,220,.25)'); gg.addColorStop(1,'rgba(255,255,220,0)');
        ctx.fillStyle=gg; ctx.fillRect(0,0,w,h);
      }
      _grid(w,h,3,8,(x,y,r,c)=>_flower(ctx,x,y,26+((r+c)%3)*10,'#86efac','#fef08a',.2));
      _grid(w,h,4,12,(x,y,r,c)=>_flower(ctx,x,y,12+((r+c)%3)*5,'#4ade80','#fef08a',.62));
      _thinBorder(ctx,w,h,'#16a34a');
    }
  },

  'galaxy':{
    color:'#0d0630', text:'#e0d7ff',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#02011a'); g.addColorStop(.4,'#0d0630'); g.addColorStop(1,'#1a0545');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // nebula blobs
      [{x:.3,y:.35,c:'rgba(80,0,160,.32)'},{x:.7,y:.6,c:'rgba(0,80,200,.22)'},{x:.2,y:.75,c:'rgba(160,0,100,.22)'}].forEach(o=>{
        const gg=ctx.createRadialGradient(o.x*w,o.y*h,0,o.x*w,o.y*h,w*.52);
        gg.addColorStop(0,o.c); gg.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gg; ctx.fillRect(0,0,w,h);
      });
      _stars(ctx,w,h,260,1.4,'#fff');
      // larger bright stars
      for(let i=0;i<30;i++){
        const x=(i*97.3%1)*w, y=(i*0.432%1)*h, r=1.5+(i%3)*.8;
        _dot(ctx,x,y,r,'#fff',.7+(i%3)*.1);
      }
      _grid(w,h,6,15,(x,y,r,c)=>_sparkle(ctx,x,y,4+((r+c)%4)*3,'#e0d7ff',.48));
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'rgba(160,100,255,.55)'); bg.addColorStop(1,'rgba(60,0,200,.55)');
      ctx.save(); ctx.strokeStyle=bg; ctx.lineWidth=3; ctx.globalAlpha=.8; ctx.strokeRect(12,12,w-24,h-24); ctx.restore();
    }
  },

  'retro-film':{
    color:'#f0e8d0', text:'#2a1a00',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#f5efe0'); g.addColorStop(1,'#e8d8b0');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // sepia vignette
      const vig=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,h*.9);
      vig.addColorStop(0,'rgba(139,100,40,0)'); vig.addColorStop(1,'rgba(80,40,0,.4)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
      // sprocket holes
      ctx.save(); ctx.fillStyle='rgba(160,120,60,.4)';
      for(let y=24;y<h-24;y+=32){
        ctx.beginPath(); ctx.rect(5,y,11,18); ctx.fill();
        ctx.beginPath(); ctx.rect(w-16,y,11,18); ctx.fill();
      }
      ctx.restore();
      // halftone dots
      _grid(w,h,10,26,(x,y,r,c)=>_dot(ctx,x,y,2+((r+c)%3),'#8b6a3a',.18));
      _thinBorder(ctx,w,h,'#8b6a3a');
    }
  },

  'y2k-holo':{
    color:'#ffe0f7', text:'#4a006a',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0,'#ffe0f7'); g.addColorStop(.3,'#d0f0ff'); g.addColorStop(.6,'#e8d0ff'); g.addColorStop(1,'#ffd0e8');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // iridescent bands
      for(let i=0;i<12;i++){
        const hue=i*30;
        const gg=ctx.createLinearGradient(0,i*h/12,w,(i+1)*h/12);
        gg.addColorStop(0,`hsla(${hue},100%,80%,0)`); gg.addColorStop(.5,`hsla(${hue},100%,80%,.14)`); gg.addColorStop(1,`hsla(${hue},100%,80%,0)`);
        ctx.fillStyle=gg; ctx.fillRect(0,0,w,h);
      }
      _grid(w,h,5,13,(x,y,r,c)=>{const hue=(r*40+c*60)%360; _sparkle(ctx,x,y,7+((r+c)%4)*4,`hsl(${hue},100%,70%)`,.65);});
      _grid(w,h,7,17,(x,y,r,c)=>{const hue=(r*60+c*40)%360; _diamond(ctx,x,y,4+((r+c)%3)*2,`hsl(${hue},100%,75%)`,.45);});
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'rgba(255,100,200,.6)'); bg.addColorStop(.5,'rgba(100,200,255,.6)'); bg.addColorStop(1,'rgba(200,100,255,.6)');
      ctx.save(); ctx.strokeStyle=bg; ctx.lineWidth=3; ctx.globalAlpha=.85; ctx.strokeRect(12,12,w-24,h-24); ctx.restore();
    }
  },

  'dark-academia':{
    color:'#2d1e0a', text:'#f5e6c0',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#1a1208'); g.addColorStop(.5,'#2d1e0a'); g.addColorStop(1,'#1a0f05');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      const vig=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,h*.85);
      vig.addColorStop(0,'rgba(80,50,10,0)'); vig.addColorStop(1,'rgba(10,5,0,.6)');
      ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
      // ornamental diamond border row
      ctx.save(); ctx.globalAlpha=.4; ctx.strokeStyle='#c8a050'; ctx.lineWidth=1;
      for(let x=16;x<w-16;x+=22){
        ctx.beginPath(); ctx.moveTo(x,14); ctx.lineTo(x+10,26); ctx.lineTo(x,38); ctx.lineTo(x-10,26); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x,h-38); ctx.lineTo(x+10,h-26); ctx.lineTo(x,h-14); ctx.lineTo(x-10,h-26); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
      _grid(w,h,5,13,(x,y,r,c)=>_diamond(ctx,x,y,3+((r+c)%3)*2,'#c8a050',.22));
      _thinBorder(ctx,w,h,'#c8a050');
    }
  },

  'winter-snow':{
    color:'#e0f2fe', text:'#0c4a6e',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#e0f2fe'); g.addColorStop(.5,'#f0f9ff'); g.addColorStop(1,'#bae6fd');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // subtle shimmer
      const sh=ctx.createRadialGradient(w*.5,0,0,w*.5,0,w*.8);
      sh.addColorStop(0,'rgba(255,255,255,.35)'); sh.addColorStop(1,'rgba(200,230,255,0)');
      ctx.fillStyle=sh; ctx.fillRect(0,0,w,h);
      _grid(w,h,6,15,(x,y,r,c)=>_sparkle(ctx,x,y,6+((r+c)%4)*4,'#93c5fd',.55));
      _grid(w,h,9,22,(x,y,r,c)=>_dot(ctx,x,y,2+((r+c)%4)*1.2,'#fff',.65));
      _thinBorder(ctx,w,h,'#38bdf8');
    }
  },

  'velvet-night':{
    color:'#0a0014', text:'#e9d5ff',
    draw(ctx,w,h){
      const g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#0a0014'); g.addColorStop(.4,'#1a0030'); g.addColorStop(1,'#0a0014');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      const glow=ctx.createRadialGradient(w*.5,h*.3,0,w*.5,h*.3,w*.9);
      glow.addColorStop(0,'rgba(80,0,120,.5)'); glow.addColorStop(.6,'rgba(40,0,80,.3)'); glow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=glow; ctx.fillRect(0,0,w,h);
      _stars(ctx,w,h,200,1.3,'#fff');
      _grid(w,h,4,11,(x,y,r,c)=>_sparkle(ctx,x,y,9+((r+c)%3)*5,'#d8b4fe',.48));
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'rgba(192,132,252,.6)'); bg.addColorStop(1,'rgba(80,0,160,.6)');
      ctx.save(); ctx.strokeStyle=bg; ctx.lineWidth=3; ctx.globalAlpha=.8; ctx.strokeRect(12,12,w-24,h-24); ctx.restore();
    }
  },

  'pastel-candy':{
    color:'#fff0f8', text:'#7c2060',
    draw(ctx,w,h){
      ctx.fillStyle='#fff0f8'; ctx.fillRect(0,0,w,h);
      // diagonal pastel stripes
      const stripes=['rgba(255,183,197,.38)','rgba(183,220,255,.38)','rgba(183,255,210,.38)','rgba(255,225,183,.38)','rgba(220,183,255,.38)'];
      ctx.save();
      for(let i=0;i<24;i++){
        ctx.fillStyle=stripes[i%stripes.length];
        const x=-h+i*(w+h)/12;
        ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+(w+h)/12,0); ctx.lineTo(x+(w+h)/12+h,h); ctx.lineTo(x+h,h); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle='rgba(255,255,255,.38)'; ctx.fillRect(0,0,w,h);
      _grid(w,h,5,13,(x,y,r,c)=>{
        const hue=(r*40+c*70)%360;
        ctx.save(); ctx.globalAlpha=.65; ctx.fillStyle=`hsl(${hue},100%,72%)`;
        _heart(ctx,x,y,8+((r+c)%3)*4); ctx.fill(); ctx.restore();
      });
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'rgba(255,100,150,.55)'); bg.addColorStop(.5,'rgba(100,150,255,.55)'); bg.addColorStop(1,'rgba(255,150,100,.55)');
      ctx.save(); ctx.strokeStyle=bg; ctx.lineWidth=3; ctx.globalAlpha=.8; ctx.strokeRect(12,12,w-24,h-24); ctx.restore();
    }
  },

});
