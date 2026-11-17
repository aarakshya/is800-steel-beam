const E=require('./engine.js'); const SEC=require('./sections.json');
const base={fam:'ISMB',sec:'ISMB 400',grade:'E250',sup:'ss',L:6,aL:0,aR:0,xi:3,sw:'no',gD:1.5,gL:1.5,loads:[{type:'U',cs:'D',a:0,b:6,w1:10}],
 lat:'restrained',Lu:6,t15:4,cSup:3,cTip:0,dest:'normal',C1:1,b1s:100,b1p:75,defl:'nc',nSpan:300,nCant:150};
const run=(o)=>E.design(Object.assign({},base,o),SEC);
let M=run({}); console.log('SS UDL Mmax',M.Mpos.M.toFixed(3),'exp',1.5*10*36/8, 'V',M.Vmax.V.toFixed(2),'exp 45');
M=run({loads:[{type:'U',cs:'L',a:0,b:6,w1:10}]}); const EI=M.EI; console.log('defl',M.defl[0].d.toFixed(3),'exp',(5*10*6**4/384/EI*1000).toFixed(3), 'Md',M.Md.toFixed(2));
M=run({sup:'fixed'}); console.log('fixed: hog',M.Mneg.M.toFixed(3),'exp',15*36/12,'sag',M.Mpos.M.toFixed(3),'exp',15*36/24);
M=run({sup:'propped'}); console.log('propped: hog',M.Mneg.M.toFixed(3),'exp',15*36/8,'sag',M.Mpos.M.toFixed(3),'exp',9/128*15*36);
M=run({sup:'cant',loads:[{type:'P',cs:'L',x:6,P:10}]}); console.log('cant: hog',M.Mneg.M.toFixed(3),'exp',90,'tip',M.defl.map(d=>d.lab+' '+d.d.toFixed(2)),'exp',(10*216/3/M.EI*1000).toFixed(2));
M=run({sup:'cont2',xi:3,loads:[{type:'U',cs:'D',a:0,b:6,w1:10}]}); console.log('cont2 mid hog',M.Mneg.M.toFixed(3),'exp',15*9/8);
M=run({sup:'ss',loads:[{type:'M',cs:'D',x:3,C:20}]}); console.log('couple: M left/right of mid', M.st.filter(p=>Math.abs(p.x-3)<1e-6).map(p=>p.M.toFixed(2)), 'exp -15 , +15');
M=run({loads:[{type:'V',cs:'D',a:0,b:6,w1:0,w2:10}]}); console.log('triangle Mmax',M.Mpos.M.toFixed(3),'exp',(1.5*10*36/(9*Math.sqrt(3))).toFixed(3), 'R',M.U.reac.map(r=>r.Rv.toFixed(2)),'exp 15, 30');
M=run({lat:'unrestrained',Lu:6,t15:4}); console.log('LTB',M.Mcr/1e6, M.lamLT, M.chi, M.MdLT);
M=run({sup:'ss',aL:1,aR:1.5,loads:[{type:'P',cs:'L',x:0,P:10},{type:'U',cs:'D',a:0,b:6,w1:5}]}); console.log('overhang', M.U.reac.map(r=>r.Rv.toFixed(2)), M.defl.map(d=>d.lab+' '+d.d.toFixed(2)+'/'+d.lim.toFixed(1)));
console.log(M.checks.map(k=>`${k.ok?'ok ':'XX '} ${E? '':''}${k.name} | ${k.demand} | ${k.capacity}`).join('\n'));
let t=Date.now(); for(const r of SEC.WPB) E.design(Object.assign({},base,{fam:'WPB',sec:r[0]}),SEC); console.log('119 designs ms',Date.now()-t);

// ----- section builder -----
{
  let bad=0; const near=(n,g,w,tol)=>{ const ok=Math.abs(g-w)<=tol; if(!ok) bad++; console.log(`${ok?'ok ':'XX '} builder: ${n}: ${g.toFixed(3)} (expected ${(+w).toFixed(3)})`); };
  const B={...base,fam:'BUILT',bType:'plate',bFam:'ISMB',bSec:'ISMB 600',bp:250,tp:16,gap:100};
  // ISMB 600 + 2 plates 250 x 16 by hand: Iz = 90200e4 + 2(250*16^3/12 + 4000*308^2)
  let s=E.secProps(B,SEC); near('plated I, Iz (cm4)', s.Iz/1e4, (90200e4+2*(250*16**3/12+4000*308**2))/1e4, 0.01);
  near('plated I, Zp (cm3)', s.Zpz/1e3, (3450e3+2*4000*308)/1e3, 0.01);
  near('plated I, D (mm)', s.D, 632, 1e-9);
  // two ISMC 300 back to back: Iz doubles; gap for ry = rz gives equal radii
  s=E.secProps({...B,bType:'btb',bFam:'ISMC',bSec:'ISMC 300'},SEC); near('2 x ISMC 300, Iz (cm4)', s.Iz/1e4, 12800, 0.01);
  const c=E.buComp({bFam:'ISMC',bSec:'ISMC 300'},SEC), g=E.buGapFor(c,'btb',1);
  s=E.secProps({...B,bType:'btb',bFam:'ISMC',bSec:'ISMC 300',gap:g},SEC); near('2 x ISMC 300 at the computed gap, ry/rz', s.ry/s.rz, 1, 1e-6);
  // twin section: shear area is two rolled webs
  M=run({fam:'BUILT',bType:'side',bFam:'ISMB',bSec:'ISMB 300',gap:100}); near('2 x ISMB 300, Vd (kN)', M.Vd, 2*300*7.7*250/Math.sqrt(3)/1.1/1000, 0.01);
  console.log(bad? `${bad} builder checks FAIL` : 'all builder checks pass');
}
