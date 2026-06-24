import ort from 'onnxruntime-node';
import { Jimp } from 'jimp';
import { readFileSync } from 'fs';

const SZ = 640;

export class YoloDetector {
  constructor(model, names, conf = 0.45) {
    this.model = model;
    this.names = readFileSync(names, 'utf8').trim().split('\n').map(l => l.trim());
    this.conf  = conf;
    this.sess  = null;
  }

  async load() { this.sess = await ort.InferenceSession.create(this.model); }

  async detect(jpegBuf, camId = 'cam') {
    if (!this.sess) return null;
    const img = await Jimp.fromBuffer(jpegBuf);
    const W = img.bitmap.width, H = img.bitmap.height;
    img.resize({ w: SZ, h: SZ });
    const px = img.bitmap.data, t = new Float32Array(3*SZ*SZ);
    for (let i = 0; i < SZ*SZ; i++) { t[i]=px[i*4]/255; t[SZ*SZ+i]=px[i*4+1]/255; t[2*SZ*SZ+i]=px[i*4+2]/255; }
    const out = await this.sess.run({ [this.sess.inputNames[0]]: new ort.Tensor('float32',t,[1,3,SZ,SZ]) });
    return this._parse(out[this.sess.outputNames[0]], W, H, camId);
  }

  _parse(out, W, H, camId) {
    const d = out.data, R = 8400, nc = this.names.length, xs = W/SZ, ys = H/SZ;
    const boxes=[], scores=[], cls=[];
    for (let i=0; i<R; i++) {
      let mc=0, mi=0;
      for (let c=0; c<nc; c++) { const v=d[(4+c)*R+i]; if(v>mc){mc=v;mi=c;} }
      if (mc<this.conf) continue;
      boxes.push([(d[0*R+i]-d[2*R+i]/2)*xs,(d[1*R+i]-d[3*R+i]/2)*ys,d[2*R+i]*xs,d[3*R+i]*ys]);
      scores.push(mc); cls.push(mi);
    }
    const keep = nms(boxes, scores, 0.5);
    return { camera_id:camId, timestamp:Date.now(), objects: keep.map(i=>({ class:this.names[cls[i]], confidence:Math.round(scores[i]*100)/100, bbox:boxes[i].map(Math.round) })) };
  }
}

function nms(boxes,scores,thr){
  const idx=scores.map((_,i)=>i).sort((a,b)=>scores[b]-scores[a]),sup=new Uint8Array(boxes.length),keep=[];
  for(const i of idx){if(sup[i])continue;keep.push(i);for(const j of idx)if(!sup[j]&&j!==i&&iou(boxes[i],boxes[j])>thr)sup[j]=1;}
  return keep;
}
function iou([ax,ay,aw,ah],[bx,by,bw,bh]){const ix=Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx)),iy=Math.max(0,Math.min(ay+ah,by+bh)-Math.max(ay,by));return(ix*iy)/(aw*ah+bw*bh-ix*iy||1);}
