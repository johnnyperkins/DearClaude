import { sunTimes } from './sun.mjs';
for (const [name, lat, lon] of [['Singapore',1.35,103.82],['Quito',-0.18,-78.47],['Nairobi',-1.29,36.82],['Lagos',6.52,3.38],['Bogota',4.71,-74.07]]) {
  let ms=[99], mr=[-99], Ms=[-99];
  for (let i=0;i<365;i++){ const d=new Date(Date.UTC(2026,0,1+i)); const t=sunTimes(2026,d.getUTCMonth()+1,d.getUTCDate(),lat,lon);
    if(t.set<ms[0]) ms=[t.set,d.toISOString().slice(5,10)]; if(t.rise>mr[0]) mr=[t.rise,d.toISOString().slice(5,10)]; if(t.set>Ms[0]) Ms=[t.set,d.toISOString().slice(5,10)]; }
  console.log(name, 'earliest set', ms[1], 'latest rise', mr[1], 'latest set', Ms[1]);
}
