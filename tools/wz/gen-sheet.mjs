import wz from "@tybys/wz";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
const { WzFile, WzMapleVersion } = wz;
const F = new WzFile("/Users/kevin.chu/develop/sideprojects/deadline-defense/wz-data/wztms113/Character.wz", WzMapleVersion.EMS); await F.parseWzFile();
const B = new WzFile("/Users/kevin.chu/develop/sideprojects/deadline-defense/wz-data/wztms113/Base.wz", WzMapleVersion.EMS); await B.parseWzFile();
const zm=[...B.wzDirectory.wzImages].find(i=>i.name==="zmap.img"); await zm.parseImage();
const ZORDER=[...zm.wzProperties].map(p=>p.name); const zIdx=z=>{const i=ZORDER.indexOf(z);return i<0?9999:i;};
const pad=id=>String(id).padStart(8,"0")+".img";
const _cache=new Map();
async function getImg(dir,id){ const k=dir+id; if(_cache.has(k))return _cache.get(k); let im; if(dir==="root"){im=[...F.wzDirectory.wzImages].find(i=>i.name===pad(id));} else {const d=[...F.wzDirectory.wzDirectories].find(x=>x.name===dir);im=d&&[...d.wzImages].find(i=>i.name===pad(id));} if(im)await im.parseImage(); _cache.set(k,im); return im; }

async function partsOf(img,stance,frame){
  if(!img)return[]; const st=[...img.wzProperties].find(p=>p.name===stance); if(!st)return[];
  let fr=[...st.wzProperties].find(p=>p.name===String(frame)); if(!fr)fr=st;
  const out=[];
  for(let p of fr.wzProperties){
    if(p.constructor.name==="WzUOLProperty"){try{p=p.wzValue;}catch{}}
    if(!p||!p.at)continue; const o=p.at("origin")?.wzValue; if(!o)continue;
    const z=p.at("z")?.wzValue||p.name; const mp=p.at("map"); const map={};
    if(mp?.wzProperties)for(const m of mp.wzProperties)map[m.name]={x:m.wzValue.x,y:m.wzValue.y};
    let bmp=null; try{const c=await p.getLinkedWzCanvasBitmap(); if(c)bmp=await c.getBufferAsync("image/png");}catch{}
    if(!bmp)continue; out.push({z,origin:{x:o.x,y:o.y},map,bmp});
  }
  return out;
}
// 一幀合成 → {canvas, nx, ny(navel在圖內位置), bottom(navel相對腳底)}
async function frameCompose(app,stance,frame){
  const SLOT=[["root",app.skin,"stand1"],["root",app.head,"stand1"],["Face",app.face,"default"],
    ["Hair",app.hair,"stand1"],["Cap",app.cap,"stand1"],["Coat",app.coat,"stand1"],
    ["Longcoat",app.longcoat,"stand1"],["Pants",app.pants,"stand1"],["Shoes",app.shoes,"stand1"],
    ["Glove",app.glove,"stand1"],["Cape",app.cape,"stand1"],["Weapon",app.weapon,"stand1"]];
  const all=[];
  for(const[dir,id,fb]of SLOT){ if(!id)continue; const img=await getImg(dir,id);
    let ps=await partsOf(img,stance,frame); if(!ps.length&&fb!==stance)ps=await partsOf(img,fb==="default"?"default":"stand1",fb==="default"?0:0);
    all.push(...ps); }
  const world={navel:{x:0,y:0}}; const todo=[...all]; const placed=[]; let g=0;
  while(todo.length&&g++<40){ for(let i=0;i<todo.length;i++){const p=todo[i];const k=Object.keys(p.map).find(k=>world[k]);if(!k)continue;
    const b=world[k]; p.pos={x:b.x-(p.origin.x+p.map[k].x),y:b.y-(p.origin.y+p.map[k].y)};
    for(const[an,av]of Object.entries(p.map))if(!world[an])world[an]={x:p.pos.x+p.origin.x+av.x,y:p.pos.y+p.origin.y+av.y};
    placed.push(p);todo.splice(i,1);i--;} }
  const imgs=await Promise.all(placed.map(p=>loadImage(p.bmp)));
  let minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  placed.forEach((p,i)=>{minX=Math.min(minX,p.pos.x);minY=Math.min(minY,p.pos.y);maxX=Math.max(maxX,p.pos.x+imgs[i].width);maxY=Math.max(maxY,p.pos.y+imgs[i].height);});
  const W=Math.ceil(maxX-minX),H=Math.ceil(maxY-minY);
  const cv=createCanvas(W,H);const ctx=cv.getContext("2d");ctx.imageSmoothingEnabled=false;
  placed.map((p,i)=>({p,img:imgs[i]})).sort((a,b)=>zIdx(b.p.z)-zIdx(a.p.z)).forEach(({p,img})=>ctx.drawImage(img,p.pos.x-minX,p.pos.y-minY));
  return {cv,W,H,nx:-minX,ny:-minY,bottom:maxY}; // navel在圖內=(-minX,-minY);腳底(navel相對)=maxY
}

// 組多 stance sheet
const app={skin:2000,head:12000,face:20000,hair:30030,coat:1040036,pants:1060026,weapon:1492000};
const STANCES={stand1:[0,1,2],walk1:[0,1,2,3],alert:[0,1,2],jump:[0],swingO1:[0,1,2]};
const body=await getImg("root",2000);
const manifest={anims:{},groundY:0};
const cells=[]; let sheetW=0,sheetH=0;
for(const[stance,frs]of Object.entries(STANCES)){
  manifest.anims[stance]=[];
  for(const fr of frs){
    const r=await frameCompose(app,stance,fr);
    const st=[...body.wzProperties].find(p=>p.name===stance);
    const frNode=[...st.wzProperties].find(p=>p.name===String(fr));
    const delay=frNode?.at?.("delay")?.wzValue||180;
    cells.push({r,stance,x:sheetW}); manifest.anims[stance].push({x:sheetW,y:0,w:r.W,h:r.H,nx:r.nx,ny:r.ny,delay});
    sheetW+=r.W+2; sheetH=Math.max(sheetH,r.H);
    if(stance==="stand1"&&fr===0){manifest.groundY=r.bottom;manifest.nominalH=r.H;} // 站立幀 navel→腳底 + 高度基準
  }
}
const sheet=createCanvas(sheetW,sheetH);const sg=sheet.getContext("2d");sg.imageSmoothingEnabled=false;
for(const c of cells)sg.drawImage(c.r.cv,c.x,0);
writeFileSync("/Users/kevin.chu/develop/sideprojects/deadline-defense/public/wz-avatar/beginner-gun/sheet.png",sheet.toBuffer("image/png"));
writeFileSync("/Users/kevin.chu/develop/sideprojects/deadline-defense/public/wz-avatar/beginner-gun/sheet.json",JSON.stringify(manifest,null,1));
console.log("sheet",sheetW+"x"+sheetH,"groundY="+manifest.groundY);
console.log("walk1 frames:",JSON.stringify(manifest.anims.walk1));
