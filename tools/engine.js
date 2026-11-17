// ===== engine: IS 800:2007 steel beam design (no DOM) =====
const AUTHOR = "Aarakshya Kandel";
const E_S = 200000, G_S = 76900, GM0 = 1.10, GM1 = 1.25;
const GRADES = {
  E250:{n:"E 250 (Fe 410 W)", fy:[250,240,230], fu:410},
  E275:{n:"E 275 (Fe 430)", fy:[275,265,255], fu:430},
  E300:{n:"E 300 (Fe 440)", fy:[300,290,280], fu:440},
  E350:{n:"E 350 (Fe 490)", fy:[350,330,320], fu:490},
  E410:{n:"E 410 (Fe 540)", fy:[410,390,380], fu:540},
  E450:{n:"E 450 (Fe 570)", fy:[450,430,420], fu:570}
};
const FAMS = {
  ISJB:{k:"I",t:"ISJB junior beams"}, ISLB:{k:"I",t:"ISLB light beams"}, ISMB:{k:"I",t:"ISMB medium beams"},
  ISWB:{k:"I",t:"ISWB wide flange beams"}, ISHB:{k:"I",t:"ISHB H-beams"}, ISSC:{k:"I",t:"ISSC column sections"},
  NPB:{k:"I",t:"NPB parallel flange beams"}, WPB:{k:"I",t:"WPB wide parallel flange beams"},
  ISJC:{k:"C",t:"ISJC junior channels"}, ISLC:{k:"C",t:"ISLC light channels"}, ISMC:{k:"C",t:"ISMC medium channels"},
  ISMPC:{k:"C",t:"ISMPC parallel flange channels"},
  SHS:{k:"R",t:"SHS square hollow"}, RHS:{k:"R",t:"RHS rectangular hollow"}, CHS:{k:"O",t:"CHS circular hollow"},
  WELD:{k:"I",t:"Welded I-section from plates",welded:true}
};
const SUP_NAME = {ss:"Simply supported", cant:"Cantilever (fixed at left end)", fixed:"Fixed at both ends", propped:"Propped cantilever (fixed left, roller right)", cont2:"Continuous over two spans"};
const LOAD_NAME = {P:"Point load", U:"Uniform line load", V:"Varying line load", M:"Applied moment"};
const CASE_NAME = {D:"Dead", L:"Imposed"};
// Table 15: simply supported beams (normal, destabilizing) and whether +2D applies
const T15 = [
  ["Torsion fully restrained, warping restrained in both flanges", 0.70, 0.85, 0],
  ["Torsion fully restrained, compression flange warping restrained", 0.75, 0.90, 0],
  ["Torsion fully restrained, both flanges partially restrained", 0.85, 1.00, 0],
  ["Torsion fully restrained, compression flange partially restrained", 0.90, 1.05, 0],
  ["Torsion fully restrained, warping not restrained", 1.00, 1.20, 0],
  ["Torsion partly restrained by bottom flange support connection", 1.00, 1.20, 1],
  ["Torsion partly restrained by bottom flange bearing support", 1.20, 1.40, 1]
];
// Table 16: cantilevers, [support][tip] -> [normal, destabilizing]
const T16S = ["Continuous, lateral restraint to top flange only","Continuous, partial torsional restraint","Continuous, lateral and torsional restraint","Built in: lateral, torsional and plan rotation restraint"];
const T16T = ["Free","Lateral restraint to top flange","Torsional restraint","Lateral and torsional restraint"];
const T16 = [
  [[3.0,7.5],[2.7,7.5],[2.4,4.5],[2.1,3.6]],
  [[2.0,5.0],[1.8,5.0],[1.6,3.0],[1.4,2.4]],
  [[1.0,2.5],[0.9,2.5],[0.8,1.5],[0.7,1.2]],
  [[0.8,1.4],[0.7,1.4],[0.6,0.6],[0.5,0.5]]
];
const DEFL = {nc:["Floor or roof, elements not susceptible to cracking",300,150], c:["Floor or roof, elements susceptible to cracking",360,180], custom:["User-defined limits",null,null]};
const CLS = ["Plastic","Compact","Semi-compact","Slender"];

const f = (x,p=2) => (x===null||x===undefined||!isFinite(x)) ? "–" : Number(x).toLocaleString("en-US",{minimumFractionDigits:p,maximumFractionDigits:p});
const f3 = x => f(x,3);
const sg = (x,p=1) => (x>=0?"+":"−")+f(Math.abs(x),p);
const refLabel = r => /^(\d|Table|Annex)/.test(r) ? "IS 800 "+r : r;
const strip = s => String(s).replace(/<sub>(.*?)<\/sub>/g,"$1").replace(/<sup>(.*?)<\/sup>/g,"^$1").replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");

function secProps(v, SEC){
  const F = FAMS[v.fam]; if(!F) return null;
  let s;
  if(v.fam==="WELD"){
    const D=v.wD, B=v.wB, tw=v.wtw, tf=v.wtf, hw=D-2*tf;
    if(!(D>0&&B>0&&tw>0&&tf>0&&hw>0)) return null;
    const A=2*B*tf+hw*tw, Iz=(B*D**3-(B-tw)*hw**3)/12, Iy=(2*tf*B**3+hw*tw**3)/12;
    s={name:`Welded I ${f(D,0)} × ${f(B,0)}, web ${f(tw,0)}, flanges ${f(tf,0)}`, kind:"I", welded:true, mass:A*7850e-6, A, D, B, tw, tf, R1:0, Iz, Iy,
       Zz:2*Iz/D, Zpz:B*tf*(D-tf)+tw*hw*hw/4, It:(2*B*tf**3+hw*tw**3)/3, Iw:Iy*(D-tf)**2/4, src:"computed from the plate sizes", itCalc:true, iwCalc:true};
  } else {
    const row=(SEC[v.fam]||[]).find(r=>r[0]===v.sec); if(!row) return null;
    if(F.k==="I"||F.k==="C"){
      const [name,mass,A,D,B,tw,tf,R1,Iz,Iy,Zz,Zpz,It,Iw]=row, hw=D-2*tf;
      s={name, kind:F.k, welded:false, mass, A:A*100, D, B, tw, tf, R1:R1||0, Iz:Iz*1e4, Iy:Iy*1e4, Zz:Zz*1e3, Zpz:Zpz*1e3, It:It?It*1e4:null, Iw:Iw?Iw*1e6:null, src:"IS 808 section table"};
      if(!s.It){ s.It=(2*B*tf**3+hw*tw**3)/3; s.itCalc=true; }
      if(!s.Iw){ const h=D-tf; s.Iw = F.k==="I" ? s.Iy*h*h/4 : tf*B**3*h*h/12*(3*B*tf+2*h*tw)/(6*B*tf+h*tw); s.iwCalc=true; }
    } else if(F.k==="R"){
      const [name,mass,A,D,B,t,Iz,Iy,Zz,Zpz]=row, Am=(B-t)*(D-t), p=2*((B-t)+(D-t));
      s={name, kind:"R", welded:false, mass, A:A*100, D, B, tw:t, tf:t, t, R1:t, Iz:Iz*1e4, Iy:Iy*1e4, Zz:Zz*1e3, Zpz:Zpz*1e3, It:4*Am*Am*t/p, Iw:0, src:"IS 4923:1997 section table", itCalc:true};
    } else {
      const [name,mass,A,D,t,I,Z]=row;
      s={name, kind:"O", welded:false, mass, A:A*100, D, B:D, tw:t, tf:t, t, R1:0, Iz:I*1e4, Iy:I*1e4, Zz:Z*1e3, Zpz:(D**3-(D-2*t)**3)/6, It:2*I*1e4, Iw:0, src:"IS 1161:2014 sizes"};
    }
  }
  s.fam=v.fam; s.famT=F.t; s.rz=Math.sqrt(s.Iz/s.A); s.ry=Math.sqrt(s.Iy/s.A);
  return s;
}

function supportsOf(v){
  const L=v.L;
  switch(v.sup){
    case "ss": return [{x:v.aL,t:"pin"},{x:L-v.aR,t:"roller"}];
    case "cant": return [{x:0,t:"fixed"}];
    case "fixed": return [{x:0,t:"fixed"},{x:L,t:"fixed"}];
    case "propped": return [{x:0,t:"fixed"},{x:L,t:"roller"}];
    case "cont2": return [{x:0,t:"pin"},{x:v.xi,t:"roller"},{x:L,t:"roller"}];
  }
  return [];
}
function anaLoads(loads, cs){
  return loads.filter(l=>l.cs===cs).map(l=>{
    if(l.type==="P") return {k:"P",x:l.x,P:l.P};
    if(l.type==="M") return {k:"M",x:l.x,C:l.C};
    if(l.type==="U") return {k:"w",a:l.a,b:l.b,w1:l.w1,w2:l.w1};
    return {k:"w",a:l.a,b:l.b,w1:l.w1,w2:l.w2};
  });
}
function geomProblems(v){
  const p=[], L=v.L;
  if(!(L>0)) { p.push("the beam length must be positive"); return p; }
  if(v.sup==="ss"){
    if(v.aL<0||v.aR<0) p.push("overhangs cannot be negative");
    if(L-v.aL-v.aR<=0.05) p.push("the overhangs leave no span between the supports");
  }
  if(v.sup==="cont2" && !(v.xi>0.05 && v.xi<L-0.05)) p.push("the interior support must lie inside the beam");
  (v.loads||[]).forEach((l,i)=>{
    const n=`load ${i+1}`;
    if(l.type==="P"||l.type==="M"){ if(!(l.x>=0&&l.x<=L+1e-9)) p.push(`${n} is off the beam`); }
    else { if(!(l.a>=0 && l.b<=L+1e-9 && l.b>l.a)) p.push(`${n} must run from a start to a later end on the beam`); }
    const vals = l.type==="P"?[l.P]:l.type==="M"?[l.C]:l.type==="U"?[l.w1]:[l.w1,l.w2];
    if(vals.some(x=>!isFinite(x))) p.push(`${n} has a missing value`);
  });
  return p;
}

// Euler-Bernoulli beam, banded stiffness, EI = 1. Loads down positive, couples clockwise positive.
function solveBeam(L, sups, loads){
  const keys=[0,L]; sups.forEach(s=>keys.push(s.x));
  loads.forEach(l=>{ if(l.k==="w"){ keys.push(l.a,l.b); } else keys.push(l.x); });
  const ks=[...new Set(keys.map(x=>+Math.min(Math.max(x,0),L).toFixed(6)))].sort((a,b)=>a-b);
  const xs=[], hmax=L/240;
  for(let i=0;i<ks.length-1;i++){ const a=ks[i], b=ks[i+1]; if(b-a<1e-9) continue; const n=Math.max(1,Math.ceil((b-a)/hmax)); for(let j=0;j<n;j++) xs.push(a+(b-a)*j/n); }
  xs.push(L);
  const nn=xs.length, nd=2*nn, hb=3, W=2*hb+1, K=new Float64Array(nd*W), F=new Float64Array(nd), at=(i,j)=>i*W+(j-i+hb);
  for(let e=0;e<nn-1;e++){
    const Le=xs[e+1]-xs[e], L2=Le*Le, L3=L2*Le;
    const k=[[12/L3,6/L2,-12/L3,6/L2],[6/L2,4/Le,-6/L2,2/Le],[-12/L3,-6/L2,12/L3,-6/L2],[6/L2,2/Le,-6/L2,4/Le]];
    const dofs=[2*e,2*e+1,2*e+2,2*e+3], fe=[0,0,0,0], xm=(xs[e]+xs[e+1])/2;
    loads.forEach(l=>{ if(l.k!=="w" || xm<l.a || xm>l.b) return;
      const q=s=>l.w1+(l.w2-l.w1)*(s-l.a)/(l.b-l.a), q1=-q(xs[e]), q2=-q(xs[e+1]);
      fe[0]+=Le/20*(7*q1+3*q2); fe[1]+=L2/60*(3*q1+2*q2); fe[2]+=Le/20*(3*q1+7*q2); fe[3]-=L2/60*(2*q1+3*q2); });
    for(let i=0;i<4;i++){ F[dofs[i]]+=fe[i]; for(let j=0;j<4;j++) K[at(dofs[i],dofs[j])]+=k[i][j]; }
  }
  const nodeOf=x=>{ let b=0, bd=1e9; for(let i=0;i<nn;i++){ const d=Math.abs(xs[i]-x); if(d<bd){ bd=d; b=i; } } return b; };
  loads.forEach(l=>{ if(l.k==="P") F[2*nodeOf(l.x)]-=l.P; if(l.k==="M") F[2*nodeOf(l.x)+1]-=l.C; });
  const fixed=new Set(); sups.forEach(s=>{ const n=nodeOf(s.x); fixed.add(2*n); if(s.t==="fixed") fixed.add(2*n+1); });
  const Kc=K.slice(), Fc=F.slice();
  fixed.forEach(d=>{ for(let j=Math.max(0,d-hb);j<=Math.min(nd-1,d+hb);j++){ Kc[at(d,j)]=0; Kc[at(j,d)]=0; } Kc[at(d,d)]=1; Fc[d]=0; });
  for(let k=0;k<nd;k++){ const p=Kc[at(k,k)]; for(let i=k+1;i<=Math.min(nd-1,k+hb);i++){ const m=Kc[at(i,k)]/p; if(!m) continue; for(let j=k;j<=Math.min(nd-1,k+hb);j++) Kc[at(i,j)]-=m*Kc[at(k,j)]; Fc[i]-=m*Fc[k]; } }
  const d=new Float64Array(nd);
  for(let i=nd-1;i>=0;i--){ let s=Fc[i]; for(let j=i+1;j<=Math.min(nd-1,i+hb);j++) s-=Kc[at(i,j)]*d[j]; d[i]=s/Kc[at(i,i)]; }
  const r=new Float64Array(nd);
  for(let i=0;i<nd;i++){ let s=0; for(let j=Math.max(0,i-hb);j<=Math.min(nd-1,i+hb);j++) s+=K[at(i,j)]*d[j]; r[i]=s-F[i]; }
  return {xs, v:Array.from({length:nn},(_,i)=>d[2*i]), reac:sups.map(s=>{ const n=nodeOf(s.x); return {x:xs[n], t:s.t, Rv:r[2*n], Rm:s.t==="fixed"?r[2*n+1]:0}; })};
}
function scaleLoads(ls,k){ return ls.map(l=>l.k==="P"?{...l,P:l.P*k}:l.k==="M"?{...l,C:l.C*k}:{...l,w1:l.w1*k,w2:l.w2*k}); }
function combine(parts){ // parts: [{res, loads, k}]
  const reac=parts[0].res.reac.map((r,i)=>({x:r.x,t:r.t,Rv:parts.reduce((s,p)=>s+p.k*p.res.reac[i].Rv,0),Rm:parts.reduce((s,p)=>s+p.k*p.res.reac[i].Rm,0)}));
  const v=parts[0].res.v.map((_,i)=>parts.reduce((s,p)=>s+p.k*p.res.v[i],0));
  const loads=[].concat(...parts.map(p=>scaleLoads(p.loads,p.k)));
  return {reac, v, loads, xs:parts[0].res.xs};
}
function statics(x, reac, loads, side){
  const inc = xi => side<0 ? xi < x-1e-9 : xi <= x+1e-9;
  let V=0, M=0;
  reac.forEach(r=>{ if(inc(r.x)){ V+=r.Rv; M+=r.Rv*(x-r.x)-r.Rm; } });
  loads.forEach(l=>{
    if(l.k==="P"){ if(inc(l.x)){ V-=l.P; M-=l.P*(x-l.x); } }
    else if(l.k==="M"){ if(inc(l.x)) M+=l.C; }
    else { const u=Math.max(0,Math.min(x,l.b)-l.a); if(u>0){ const k=(l.w2-l.w1)/(l.b-l.a), X=x-l.a; V-=l.w1*u+k*u*u/2; M-=l.w1*(X*u-u*u/2)+k*(X*u*u/2-u*u*u/3); } }
  });
  return {V,M};
}

// cached analysis of the three unit load sets (forces do not depend on EI for a prismatic beam)
let _anaKey=null, _ana=null;
function analyse(v){
  const key=JSON.stringify([v.L,v.sup,v.aL,v.aR,v.xi,v.loads]);
  if(key===_anaKey) return _ana;
  const sups=supportsOf(v), lD=anaLoads(v.loads,"D"), lL=anaLoads(v.loads,"L"), lS=[{k:"w",a:0,b:v.L,w1:1,w2:1}];
  const allL=[...lD,...lL,...lS];
  const solve=ls=>solveBeam(v.L,sups,[...ls,...allL.map(l=>l.k==="w"?{k:"w",a:l.a,b:l.b,w1:0,w2:0}:l.k==="P"?{k:"P",x:l.x,P:0}:{k:"M",x:l.x,C:0})]);
  _ana={sups, lD, lL, lS, D:solve(lD), Lr:solve(lL), S:solve(lS)};
  _anaKey=key; return _ana;
}

function design(v, SEC){
  const steps=[], checks=[]; let part="";
  const P = n => { part=n; };
  const Sx = (title, ref, lines, note) => steps.push({part,title,ref,lines:lines.filter(Boolean),note});
  const C = (group,name,ref,demand,capacity,ok,info) => checks.push({group,name,ref,demand,capacity,ok,info});
  const sp=secProps(v,SEC), G=GRADES[v.grade];
  const probs=geomProblems(v);
  const inRows=inputRows(v,sp);
  if(!sp || probs.length){ return {v,sp,steps,checks,early:true,probs:probs.length?probs:["the section is not defined"],inRows,allOk:false,failed:[],sumRows:[],outcomeRow:["Outcome","FAIL","Fix the inputs","FAIL"],actions:[]}; }
  const kind=sp.kind, isI=kind==="I"||kind==="C";
  // ===== A =====
  P("A. Section, material and classification");
  Sx("Section properties", sp.src,
    [`${sp.name} (${sp.famT}); mass ${f(sp.mass,2)} kg/m; A = ${f(sp.A,0)} mm²`,
     kind==="O" ? `D = ${f(sp.D,1)} mm, t = ${f(sp.t,1)} mm` : `D = ${f(sp.D,1)} mm, b<sub>f</sub> = ${f(sp.B,1)} mm, t<sub>w</sub> = ${f(sp.tw,1)} mm, t<sub>f</sub> = ${f(sp.tf,1)} mm` + (isI&&sp.R1?`, root radius R<sub>1</sub> = ${f(sp.R1,1)} mm`:""),
     `I<sub>z</sub> = ${f(sp.Iz/1e4,1)} cm⁴, I<sub>y</sub> = ${f(sp.Iy/1e4,1)} cm⁴, r<sub>y</sub> = ${f(sp.ry,1)} mm`,
     `Z<sub>e,z</sub> = ${f(sp.Zz/1e3,1)} cm³, Z<sub>p,z</sub> = ${f(sp.Zpz/1e3,1)} cm³, shape factor = ${f(sp.Zpz/sp.Zz,3)}`,
     kind==="O" ? "" : `I<sub>t</sub> = ${f(sp.It/1e4,2)} cm⁴${sp.itCalc?" (computed)":""}, I<sub>w</sub> = ${f(sp.Iw/1e6,0)} cm⁶${sp.iwCalc&&sp.Iw?" (computed)":""}`],
    sp.itCalc||sp.iwCalc ? "Torsion constants marked computed are found from the plate sizes (I<sub>t</sub> = Σbt³/3, I<sub>w</sub> = I<sub>y</sub>h²/4 for an I-section, Bredt's formula for hollow sections)." : "");
  const tmax=Math.max(sp.tf,sp.tw), band=tmax<20?0:(tmax<=40?1:2), fy=G.fy[band], fu=G.fu, eps=Math.sqrt(250/fy);
  Sx("Material", "IS 2062:2011 Table 2, IS 800 2.2.4, Table 5",
    [`Grade ${G.n}; thickest element ${f(tmax,1)} mm, so f<sub>y</sub> = <span class="r">${fy} MPa</span> (band ${["< 20","20 to 40","> 40"][band]} mm), f<sub>u</sub> = ${fu} MPa`,
     `E = 2.0 × 10⁵ MPa, G = 0.769 × 10⁵ MPa, γ<sub>m0</sub> = 1.10, γ<sub>m1</sub> = 1.25`,
     `ε = √(250/f<sub>y</sub>) = <span class="r">${f3(eps)}</span>`]);
  // classification
  let fl, web, rows;
  if(kind==="O"){
    const r=sp.D/sp.t, lim=[42,52,146].map(k=>k*eps*eps), c=r<=lim[0]?0:r<=lim[1]?1:r<=lim[2]?2:3;
    fl={c, r, lim, txt:`Tube in bending, D/t = ${f(sp.D,1)}/${f(sp.t,1)} = <span class="r">${f(r,2)}</span>; limits 42ε² = ${f(lim[0],1)}, 52ε² = ${f(lim[1],1)}, 146ε² = ${f(lim[2],1)}`}; web={c:0, txt:""};
  } else {
    let b, bl, k1;
    if(kind==="R"){ b=sp.B-3*sp.t; k1=[29.3,33.5,42]; bl=`Compression flange (internal element), b = B − 3t = ${f(b,1)} mm`; }
    else { b = kind==="I" ? sp.B/2 : sp.B; k1 = sp.welded ? [8.4,9.4,13.6] : [9.4,10.5,15.7]; bl=`Flange outstand (${sp.welded?"welded":"rolled"}), b = ${kind==="I"?"b<sub>f</sub>/2":"b<sub>f</sub>"} = ${f(b,1)} mm`; }
    const rf=b/sp.tf, lf=k1.map(k=>k*eps), cf=rf<=lf[0]?0:rf<=lf[1]?1:rf<=lf[2]?2:3;
    const d = kind==="R" ? sp.D-3*sp.t : sp.D-2*(sp.tf+sp.R1), rw=d/sp.tw, lw=[84,105,126].map(k=>k*eps), cw=rw<=lw[0]?0:rw<=lw[1]?1:rw<=lw[2]?2:3;
    fl={c:cf, r:rf, lim:lf, txt:`${bl}; b/t<sub>f</sub> = <span class="r">${f(rf,2)}</span>; limits ${k1[0]}ε = ${f(lf[0],2)}, ${k1[1]}ε = ${f(lf[1],2)}, ${k1[2]}ε = ${f(lf[2],2)} → ${CLS[cf]}`};
    web={c:cw, r:rw, d, lim:lw, txt:`Web with neutral axis at mid-depth, d = ${kind==="R"?"D − 3t":"D − 2(t<sub>f</sub> + R<sub>1</sub>)"} = ${f(d,1)} mm; d/t<sub>w</sub> = <span class="r">${f(rw,2)}</span>; limits 84ε = ${f(lw[0],1)}, 105ε = ${f(lw[1],1)}, 126ε = ${f(lw[2],1)} → ${CLS[cw]}`};
  }
  const cls=Math.max(fl.c,web.c), betab = cls<=1 ? 1 : sp.Zz/sp.Zpz;
  Sx("Section classification","Table 2, 3.7.2",
    [fl.txt, web.txt, `Section class = <span class="r">${CLS[cls]}</span>; β<sub>b</sub> = ${cls<=1?"1.0 (plastic or compact)":`Z<sub>e</sub>/Z<sub>p</sub> = ${f3(betab)} (semi-compact)`}`],
    cls===3 ? "Slender sections need the effective section of 7.3.2.1 and are not covered by this sheet. Choose a heavier or more compact section." : "");
  C("Section and material","Section is not slender","Table 2, 3.7.2","Plastic, compact or semi-compact",CLS[cls], cls<3);
  if(isI){ const lim=200*eps, d=sp.D-2*sp.tf; C("Section and material","Web slenderness without stiffeners, d/t<sub>w</sub> ≤ 200ε","8.6.1.1",`≤ ${f(lim,1)}`,f(d/sp.tw,1), d/sp.tw<=lim); }

  // ===== B =====
  P("B. Loads and analysis");
  const A=analyse(v), sw = v.sw==="yes" ? sp.mass*9.81/1000 : 0, gD=v.gD, gL=v.gL;
  const parts = (kD,kL) => [{res:A.D,loads:A.lD,k:kD},{res:A.Lr,loads:A.lL,k:kL},{res:A.S,loads:A.lS,k:kD*sw}];
  const U=combine(parts(gD,gL)), Sv=combine(parts(1,1)), LL=combine(parts(0,1));
  const EI=E_S*sp.Iz/1e9; // kN m2
  const nD=v.loads.filter(l=>l.cs==="D").length, nL=v.loads.filter(l=>l.cs==="L").length;
  Sx("Load cases and combination","Table 4, 5.3",
    [`${SUP_NAME[v.sup]}, length ${f(v.L,3)} m; supports at x = ${A.sups.map(s=>f(s.x,3)).join(", ")} m (${A.sups.map(s=>s.t).join(", ")})`,
     `${v.loads.length} user load${v.loads.length===1?"":"s"}: ${nD} dead, ${nL} imposed` + (v.sw==="yes" ? `; self weight ${f(sp.mass,2)} × 9.81/1000 = <span class="r">${f(sw,3)} kN/m</span> added as dead load` : "; self weight not included"),
     `Strength: ${f(gD,2)} × dead + ${f(gL,2)} × imposed (Table 4, γ<sub>f</sub> = 1.5 for both in the dead plus imposed combination)`,
     `Serviceability: 1.0 × dead + 1.0 × imposed; the deflection check uses the imposed load alone (Table 6)`],
    "Loads act downward and couples clockwise when positive. x is measured from the left end of the beam.");
  // stations
  const st=[]; U.xs.forEach(x=>{ [-1,1].forEach(s=>{ if((s<0&&x<=1e-9)||(s>0&&x>=v.L-1e-9)) return; const r=statics(x,U.reac,U.loads,s); st.push({x,V:r.V,M:r.M}); }); });
  let Mpos={M:0,x:0}, Mneg={M:0,x:0}, Vmax={V:0,x:0};
  st.forEach(p=>{ if(p.M>Mpos.M) Mpos={M:p.M,x:p.x}; if(-p.M>Mneg.M) Mneg={M:-p.M,x:p.x}; if(Math.abs(p.V)>Math.abs(Vmax.V)) Vmax={V:p.V,x:p.x}; });
  const Mmax=Math.max(Mpos.M,Mneg.M);
  Sx("Factored reactions and design actions","Statics, stiffness analysis",
    [...U.reac.map((r,i)=>`Support ${i+1} at x = ${f(r.x,3)} m: R<sub>u</sub> = <span class="r">${f(r.Rv,2)} kN</span>${r.t==="fixed"?`, M<sub>u</sub> = ${sg(-r.Rm,2)} kN·m (sagging positive)`:""}; service R = ${f(Sv.reac[i].Rv,2)} kN`),
     `Largest sagging moment M<sub>u</sub> = <span class="r">${f(Mpos.M,2)} kN·m</span>${Mpos.M>0?` at x = ${f(Mpos.x,3)} m`:""}`,
     `Largest hogging moment M<sub>u</sub> = <span class="r">${f(Mneg.M,2)} kN·m</span>${Mneg.M>0?` at x = ${f(Mneg.x,3)} m`:""}`,
     `Largest shear V<sub>u</sub> = <span class="r">${f(Math.abs(Vmax.V),2)} kN</span> at x = ${f(Vmax.x,3)} m`,
     `Equilibrium: ΣR = ${f(U.reac.reduce((s,r)=>s+r.Rv,0),2)} kN, total factored load = ${f(U.loads.reduce((s,l)=>s+(l.k==="P"?l.P:l.k==="w"?(l.w1+l.w2)/2*(l.b-l.a):0),0),2)} kN`],
    v.sup==="ss"||v.sup==="cant" ? "" : "The beam is statically indeterminate. It is solved by the stiffness method with a uniform EI, so the forces do not depend on the section chosen.");
  const uplift=U.reac.filter(r=>r.Rv<0);
  if(uplift.length) C("Section and material","Supports in compression (no uplift)","Statics","R<sub>u</sub> ≥ 0",uplift.map(r=>f(r.Rv,1)).join(", ")+" kN", false, true);

  // ===== C: shear =====
  P("C. Shear");
  let Av, avTxt, dw=null, nweb=1;
  if(kind==="O"){ Av=2*sp.A/Math.PI; avTxt=`A<sub>v</sub> = 2A/π = ${f(Av,0)} mm²`; }
  else if(kind==="R"){ Av=sp.A*sp.D/(sp.B+sp.D); dw=sp.D-3*sp.t; nweb=2; avTxt=`A<sub>v</sub> = AD/(B + D) = ${f(sp.A,0)} × ${f(sp.D,0)}/(${f(sp.B,0)} + ${f(sp.D,0)}) = ${f(Av,0)} mm²`; }
  else if(sp.welded){ dw=sp.D-2*sp.tf; Av=dw*sp.tw; avTxt=`A<sub>v</sub> = d t<sub>w</sub> = ${f(dw,1)} × ${f(sp.tw,1)} = ${f(Av,0)} mm² (welded)`; }
  else { dw=sp.D-2*sp.tf; Av=sp.D*sp.tw; avTxt=`A<sub>v</sub> = D t<sub>w</sub> = ${f(sp.D,1)} × ${f(sp.tw,1)} = ${f(Av,0)} mm² (hot rolled)`; }
  const Vp=Av*fy/Math.sqrt(3)/1e3;
  let Vn=Vp, sbTxt="", sbNeed=false, tauTxt="";
  if(dw){
    const r=dw/sp.tw; sbNeed = r>67*eps;
    sbTxt=`Web d/t<sub>w</sub> = ${f(dw,1)}/${f(sp.tw,1)} = ${f(r,2)}; 67ε = ${f(67*eps,2)}: ${sbNeed?"shear buckling must be checked (8.4.2.1)":"no shear buckling check needed"}`;
    if(sbNeed){
      const Kv=5.35, tcr=Kv*Math.PI**2*E_S/(12*(1-0.09)*r*r), lw=Math.sqrt(fy/(Math.sqrt(3)*tcr));
      const tb = lw<=0.8 ? fy/Math.sqrt(3) : (lw<1.2 ? (1-0.8*(lw-0.8))*fy/Math.sqrt(3) : fy/(Math.sqrt(3)*lw*lw));
      const Vcr=nweb*dw*sp.tw*tb/1e3; Vn=Math.min(Vp,Vcr);
      tauTxt=`Simple post-critical method, no transverse stiffeners: K<sub>v</sub> = 5.35; τ<sub>cr,e</sub> = K<sub>v</sub>π²E/[12(1 − μ²)(d/t<sub>w</sub>)²] = ${f(tcr,1)} MPa; λ<sub>w</sub> = ${f3(lw)}; τ<sub>b</sub> = ${f(tb,1)} MPa; V<sub>cr</sub> = ${nweb>1?"2":""}d t<sub>w</sub>τ<sub>b</sub> = <span class="r">${f(Vcr,1)} kN</span>`;
    }
  }
  const Vd=Vn/GM0, Vu=Math.abs(Vmax.V);
  Sx("Design shear strength","8.4, 8.4.1, 8.4.2",
    [avTxt, `V<sub>p</sub> = A<sub>v</sub>f<sub>yw</sub>/√3 = ${f(Av,0)} × ${fy}/√3/10³ = ${f(Vp,1)} kN`, sbTxt, tauTxt,
     `V<sub>d</sub> = V<sub>n</sub>/γ<sub>m0</sub> = ${f(Vn,1)}/1.10 = <span class="r">${f(Vd,1)} kN</span>; V<sub>u</sub> = ${f(Vu,1)} kN; utilisation <span class="r">${f3(Vu/Vd)}</span>`,
     `0.6V<sub>d</sub> = ${f(0.6*Vd,1)} kN: ${Vu>0.6*Vd?"high shear exists somewhere along the beam, so the moment capacity is reduced there (9.2.2)":"low shear everywhere, so the moment capacity is not reduced"}`]);
  C("Shear","Shear strength","8.4.1",`V<sub>u</sub> = ${f(Vu,1)} kN`,`V<sub>d</sub> = ${f(Vd,1)} kN`, Vu<=Vd);

  // ===== D: bending =====
  P("D. Bending");
  const capF = v.sup==="cant" ? 1.5 : 1.2;
  const MdP=betab*sp.Zpz*fy/GM0/1e6, MdCap=capF*sp.Zz*fy/GM0/1e6, Md=Math.min(MdP,MdCap);
  const Mfd = kind==="O" ? 0 : sp.B*sp.tf*(sp.D-sp.tf)*fy/GM0/1e6;
  Sx("Design bending strength, laterally supported","8.2.1.2",
    [`M<sub>d</sub> = β<sub>b</sub>Z<sub>p</sub>f<sub>y</sub>/γ<sub>m0</sub> = ${f3(betab)} × ${f(sp.Zpz/1e3,1)} × 10³ × ${fy}/1.10/10⁶ = ${f(MdP,2)} kN·m`,
     `Limit ${capF}Z<sub>e</sub>f<sub>y</sub>/γ<sub>m0</sub> (${v.sup==="cant"?"cantilever":"beams with spans"}) = ${capF} × ${f(sp.Zz/1e3,1)} × 10³ × ${fy}/1.10/10⁶ = ${f(MdCap,2)} kN·m`,
     `M<sub>d</sub> = <span class="r">${f(Md,2)} kN·m</span>`,
     kind==="O" ? "" : `Plastic moment of the flanges alone, M<sub>fd</sub> = b<sub>f</sub>t<sub>f</sub>(D − t<sub>f</sub>)f<sub>y</sub>/γ<sub>m0</sub> = ${f(Mfd,2)} kN·m (used for high shear)`]);
  // LTB
  let ltbApplies = v.lat!=="restrained" && kind!=="O" && !(kind==="R" && sp.Iy>=sp.Iz*0.999);
  let MdLT=Md, LLT=null, Mcr=null, lamLT=null, chi=1, ltbLines=[], ltbNote="";
  if(v.lat==="restrained") ltbLines=["The compression flange is laterally supported along its length, so lateral-torsional buckling does not occur (8.2.1.1)"];
  else if(!ltbApplies) ltbLines=[kind==="O"?"Circular hollow sections do not buckle laterally":"A square hollow section has equal stiffness about both axes and does not buckle laterally"];
  else {
    let k, add=0, lt;
    if(v.sup==="cant"){ k=T16[v.cSup][v.cTip][v.dest==="destab"?1:0]; lt=`Table 16, support: ${T16S[v.cSup].toLowerCase()}; tip: ${T16T[v.cTip].toLowerCase()}; ${v.dest==="destab"?"destabilizing":"normal"} loading: L<sub>LT</sub> = ${k}L`; }
    else { const row=T15[v.t15]; k=row[v.dest==="destab"?2:1]; add=row[3]?2*sp.D/1000:0; lt=`Table 15, ${row[0].toLowerCase()}; ${v.dest==="destab"?"destabilizing":"normal"} loading: L<sub>LT</sub> = ${k}L${row[3]?" + 2D":""}`; }
    LLT=k*v.Lu+add;
    const Lm=LLT*1000, a=Math.PI**2*E_S*sp.Iy/(Lm*Lm);
    Mcr=v.C1*Math.sqrt(a*(G_S*sp.It+Math.PI**2*E_S*sp.Iw/(Lm*Lm)));
    lamLT=Math.sqrt(betab*sp.Zpz*fy/Mcr);
    const aLT=sp.welded?0.49:0.21, phi=0.5*(1+aLT*(lamLT-0.2)+lamLT*lamLT);
    chi=Math.min(1/(phi+Math.sqrt(phi*phi-lamLT*lamLT)),1);
    const fbd=chi*fy/GM0, MdL=betab*sp.Zpz*fbd/1e6;
    if(lamLT<=0.4){ MdLT=Md; ltbNote="λ<sub>LT</sub> ≤ 0.4, so lateral-torsional buckling need not be considered (8.2.2)."; }
    else MdLT=Math.min(MdL,Md);
    ltbLines=[lt, `Laterally unsupported length L = ${f(v.Lu,3)} m, so L<sub>LT</sub> = <span class="r">${f(LLT,3)} m</span>`,
      `M<sub>cr</sub> = C<sub>1</sub>√{(π²EI<sub>y</sub>/L<sub>LT</sub>²)[GI<sub>t</sub> + π²EI<sub>w</sub>/L<sub>LT</sub>²]} with C<sub>1</sub> = ${f(v.C1,3)}: π²EI<sub>y</sub>/L<sub>LT</sub>² = ${f(a/1e3,1)} kN; M<sub>cr</sub> = <span class="r">${f(Mcr/1e6,2)} kN·m</span>`,
      `λ<sub>LT</sub> = √(β<sub>b</sub>Z<sub>p</sub>f<sub>y</sub>/M<sub>cr</sub>) = <span class="r">${f3(lamLT)}</span>; α<sub>LT</sub> = ${aLT} (${sp.welded?"welded":"rolled"})`,
      `φ<sub>LT</sub> = 0.5[1 + α<sub>LT</sub>(λ<sub>LT</sub> − 0.2) + λ<sub>LT</sub>²] = ${f3(phi)}; χ<sub>LT</sub> = 1/[φ<sub>LT</sub> + √(φ<sub>LT</sub>² − λ<sub>LT</sub>²)] = <span class="r">${f3(chi)}</span>`,
      `f<sub>bd</sub> = χ<sub>LT</sub>f<sub>y</sub>/γ<sub>m0</sub> = ${f(fbd,1)} MPa; M<sub>d</sub> = β<sub>b</sub>Z<sub>p</sub>f<sub>bd</sub> = <span class="r">${f(MdL,2)} kN·m</span>${MdL>Md?` (capped at ${f(Md,2)} kN·m)`:""}`];
    if(kind==="C") ltbNote=(ltbNote?ltbNote+" ":"")+"For a channel the formula assumes the load passes through the shear centre. Loads on the web face add torsion, which this sheet does not cover.";
    if(v.C1!==1) ltbNote=(ltbNote?ltbNote+" ":"")+"C<sub>1</sub> other than 1.0 must match the moment shape in Annex E, Table 42.";
  }
  Sx("Lateral-torsional buckling","8.2.2, 8.3, Annex E", ltbLines, ltbNote);
  // combined check along the beam
  const Mdv = V => { const a=Math.abs(V); if(a<=0.6*Vd) return Md; if(cls<=1){ const b=Math.pow(2*a/Vd-1,2); return Math.min(Md-b*(Md-Mfd), 1.2*sp.Zz*fy/GM0/1e6); } return sp.Zz*fy/GM0/1e6; };
  let gov={u:-1};
  st.forEach(p=>{ const cap=Math.min(MdLT, Mdv(p.V)), u=Math.abs(p.M)/cap; if(u>gov.u) gov={u,x:p.x,M:p.M,V:p.V,cap,mdv:Mdv(p.V)}; });
  const hs=Math.abs(gov.V)>0.6*Vd;
  Sx("Moment check along the beam","8.2, 9.2.2",
    [`At every section the capacity is the smaller of the lateral-torsional value ${f(MdLT,2)} kN·m and M<sub>dv</sub>, which equals M<sub>d</sub> unless V &gt; 0.6V<sub>d</sub>`,
     `Governing section x = ${f(gov.x,3)} m: M<sub>u</sub> = <span class="r">${f(Math.abs(gov.M),2)} kN·m</span> (${gov.M>=0?"sagging":"hogging"}), V<sub>u</sub> = ${f(Math.abs(gov.V),2)} kN`,
     hs ? (cls<=1 ? `High shear: β = (2V/V<sub>d</sub> − 1)² = ${f3(Math.pow(2*Math.abs(gov.V)/Vd-1,2))}; M<sub>dv</sub> = M<sub>d</sub> − β(M<sub>d</sub> − M<sub>fd</sub>) = ${f(gov.mdv,2)} kN·m` : `High shear on a semi-compact section: M<sub>dv</sub> = Z<sub>e</sub>f<sub>y</sub>/γ<sub>m0</sub> = ${f(gov.mdv,2)} kN·m`) : `Low shear at this section (V<sub>u</sub> ≤ 0.6V<sub>d</sub> = ${f(0.6*Vd,1)} kN), M<sub>dv</sub> = M<sub>d</sub>`,
     `Capacity = <span class="r">${f(gov.cap,2)} kN·m</span>; utilisation <span class="r">${f3(gov.u)}</span>`],
    v.lat!=="restrained" && ltbApplies && (Mneg.M>0 && Mpos.M>0) ? "The lateral-torsional value is applied to both sagging and hogging moments. Check that the unsupported length entered fits the flange that is in compression in each region." : "");
  C("Bending","Moment capacity, laterally supported","8.2.1.2",`M<sub>u</sub> = ${f(Mmax,2)} kN·m`,`M<sub>d</sub> = ${f(Md,2)} kN·m`, Mmax<=Md);
  if(ltbApplies) C("Bending","Lateral-torsional buckling","8.2.2",`M<sub>u</sub> = ${f(Mmax,2)} kN·m`,`M<sub>d</sub> = ${f(MdLT,2)} kN·m`, Mmax<=MdLT);
  C("Bending",`Moment with shear at the governing section (x = ${f(gov.x,2)} m)`,"9.2.2",`M<sub>u</sub> = ${f(Math.abs(gov.M),2)} kN·m`,`${f(gov.cap,2)} kN·m`, gov.u<=1);

  // ===== E: web under concentrated forces =====
  P("E. Web bearing and buckling under concentrated forces");
  const webs=[];
  if(kind!=="O"){
    U.reac.forEach((r,i)=>{ if(r.Rv>0.01) webs.push({x:r.x, F:r.Rv, lab:`Support ${i+1}`, b1:v.b1s}); });
    const pts={}; U.loads.forEach(l=>{ if(l.k==="P" && l.P>0){ const k=l.x.toFixed(4); pts[k]=(pts[k]||0)+l.P; } });
    Object.keys(pts).forEach(k=>{ const x=+k; if(A.sups.some(s=>Math.abs(s.x-x)<1e-6)) return; webs.push({x, F:pts[k], lab:`Point load at x = ${f(x,3)} m`, b1:v.b1p}); });
    const tw=nweb*sp.tw, dcl = kind==="R" ? sp.D-3*sp.t : sp.D-2*(sp.tf+sp.R1), n2s=2.5*(sp.tf+sp.R1), n1s=sp.D/2;
    const lam=2.5*dcl/sp.tw, lamN=Math.sqrt(fy*lam*lam/(Math.PI**2*E_S)), ph=0.5*(1+0.49*(lamN-0.2)+lamN*lamN), fcd=Math.min(fy/GM0/(ph+Math.sqrt(ph*ph-lamN*lamN)), fy/GM0);
    webs.forEach(w=>{
      const left=Math.max(0,w.x*1000-w.b1/2), right=Math.max(0,(v.L-w.x)*1000-w.b1/2);
      const n2=Math.min(n2s,left)+Math.min(n2s,right), n1=Math.min(n1s,left)+Math.min(n1s,right);
      w.Fw=(w.b1+n2)*tw*fy/GM0/1e3; w.Fb=(w.b1+n1)*tw*fcd/1e3; w.n1=n1; w.n2=n2; w.ok=w.F<=Math.min(w.Fw,w.Fb);
      Sx(`${w.lab}: web bearing and buckling`,"8.7.4, 8.7.3.1, 7.1.2.1",
        [`Factored force F = <span class="r">${f(w.F,2)} kN</span>; stiff bearing length b<sub>1</sub> = ${f(w.b1,0)} mm${nweb>1?"; two webs":""}`,
         `Bearing: n<sub>2</sub> = 2.5(t<sub>f</sub> + R<sub>1</sub>) per side, limited by the beam end = ${f(n2,1)} mm; F<sub>w</sub> = (b<sub>1</sub> + n<sub>2</sub>)t<sub>w</sub>f<sub>yw</sub>/γ<sub>m0</sub> = (${f(w.b1,0)} + ${f(n2,1)}) × ${f(tw,1)} × ${fy}/1.10/10³ = <span class="r">${f(w.Fw,1)} kN</span>`,
         `Buckling: λ = 2.5d/t<sub>w</sub> = 2.5 × ${f(dcl,1)}/${f(sp.tw,1)} = ${f(lam,1)}; buckling class c gives f<sub>cd</sub> = ${f(fcd,1)} MPa`,
         `n<sub>1</sub> = D/2 per side, limited by the beam end = ${f(n1,1)} mm; F<sub>cdw</sub> = (b<sub>1</sub> + n<sub>1</sub>)t<sub>w</sub>f<sub>cd</sub> = <span class="r">${f(w.Fb,1)} kN</span>`,
         `Utilisation ${f3(w.F/Math.min(w.Fw,w.Fb))}${w.ok?"":"; bearing stiffeners are needed here (8.7.1.1)"}`]);
      C("Web under concentrated forces",`${w.lab}, web bearing`,"8.7.4",`F = ${f(w.F,1)} kN`,`F<sub>w</sub> = ${f(w.Fw,1)} kN`, w.F<=w.Fw);
      C("Web under concentrated forces",`${w.lab}, web buckling`,"8.7.3.1",`F = ${f(w.F,1)} kN`,`F<sub>cdw</sub> = ${f(w.Fb,1)} kN`, w.F<=w.Fb);
    });
    if(!webs.length) Sx("No concentrated forces","8.7",["There are no compressive reactions or point loads to check"]);
  } else Sx("Circular hollow section","8.7",["Web bearing and buckling formulae in 8.7 are for flanged sections. Local bearing on a tube needs a saddle or end plate and is outside this sheet."]);

  // ===== F: deflection =====
  P("F. Serviceability");
  const D6=DEFL[v.defl], nS = v.defl==="custom" ? v.nSpan : D6[1], nC = v.defl==="custom" ? v.nCant : D6[2];
  const vx=LL.xs, vLL=LL.v.map(y=>y/EI), vTot=Sv.v.map(y=>y/EI);
  const sx=A.sups.map(s=>s.x).sort((a,b)=>a-b), defl=[];
  for(let i=0;i<sx.length-1;i++){ const a=sx[i], b=sx[i+1]; let m=0, xm=a, mt=0; vx.forEach((x,j)=>{ if(x>a&&x<b){ if(Math.abs(vLL[j])>Math.abs(m)){ m=vLL[j]; xm=x; } if(Math.abs(vTot[j])>Math.abs(mt)) mt=vTot[j]; } });
    defl.push({lab:sx.length>2?`Span ${i+1}`:"Span", Lspan:b-a, d:Math.abs(m)*1000, dt:Math.abs(mt)*1000, x:xm, lim:(b-a)*1000/nS, n:nS}); }
  const tipL=sx[0], tipR=v.L-sx[sx.length-1];
  if(v.sup==="cant" || tipL>1e-6 || tipR>1e-6){
    if(tipL>1e-6 && v.sup!=="cant") defl.push({lab:"Left overhang tip", Lspan:tipL, d:Math.abs(vLL[0])*1000, dt:Math.abs(vTot[0])*1000, x:0, lim:tipL*1000/nC, n:nC, cant:true});
    if(tipR>1e-6) defl.push({lab:v.sup==="cant"?"Cantilever tip":"Right overhang tip", Lspan:tipR, d:Math.abs(vLL[vLL.length-1])*1000, dt:Math.abs(vTot[vTot.length-1])*1000, x:v.L, lim:tipR*1000/nC, n:nC, cant:true});
  }
  Sx("Deflection","5.6.1, Table 6",
    [`EI = 2.0 × 10⁵ × ${f(sp.Iz/1e4,1)} × 10⁴ = ${f(EI,0)} kN·m²; limits: ${D6[0].toLowerCase()}${v.defl==="custom"?"":""}, span/${nS} and cantilever/${nC}`,
     ...defl.map(d=>`${d.lab} (${f(d.Lspan,3)} m): imposed load deflection <span class="r">${f(d.d,2)} mm</span>${d.cant?"":` at x = ${f(d.x,3)} m`} against ${d.cant?"L":"span"}/${d.n} = ${f(d.lim,2)} mm; total (dead + imposed) ${f(d.dt,2)} mm = ${d.cant?"L":"span"}/${d.dt>0?f(d.Lspan*1000/d.dt,0):"∞"}`)],
    "Table 6 limits apply to deflection under imposed load. The total deflection is shown for information; precamber can offset the dead load part.");
  defl.forEach(d=>C("Deflection",`${d.lab}, imposed load`,"Table 6",`≤ ${f(d.lim,2)} mm (${d.cant?"L":"span"}/${d.n})`,`${f(d.d,2)} mm`, d.d<=d.lim));

  // ===== outcome =====
  const failed=checks.filter(k=>!k.ok && !k.info), allOk=!failed.length;
  const webU = webs.length ? Math.max(...webs.map(w=>w.F/Math.min(w.Fw,w.Fb))) : null, defU = defl.length ? Math.max(...defl.map(d=>d.d/d.lim)) : 0;
  const shU=Vu/Vd, utils=[["Bending",gov.u],["Shear",shU],["Web",webU||0],["Deflection",defU]];
  const govU=utils.reduce((a,b)=>b[1]>a[1]?b:a);
  const st2 = ok => ok ? "PASS" : "FAIL";
  const sumRows=[
    {g:"Section"}, ["Section", sp.name, `${f(sp.mass,2)} kg/m, ${GRADES[v.grade].n}, f<sub>y</sub> = ${fy} MPa`, ""],
    ["Classification", CLS[cls], `β<sub>b</sub> = ${f3(betab)}`, st2(cls<3)],
    {g:"Strength"},
    ["Bending", `M<sub>u</sub> = ${f(Math.abs(gov.M),1)} kN·m`, `capacity ${f(gov.cap,1)} kN·m at x = ${f(gov.x,2)} m${ltbApplies?`, χ<sub>LT</sub> = ${f3(chi)}`:""}; ratio ${f3(gov.u)}`, st2(gov.u<=1 && Mmax<=Md)],
    ["Shear", `V<sub>u</sub> = ${f(Vu,1)} kN`, `V<sub>d</sub> = ${f(Vd,1)} kN; ratio ${f3(shU)}`, st2(Vu<=Vd)],
    ["Web under point forces", webs.length?`${webs.length} location${webs.length>1?"s":""}`:"–", webs.length?`largest ratio ${f3(webU)}`:(kind==="O"?"not applicable":"none"), webs.length?st2(webs.every(w=>w.ok)):""],
    {g:"Serviceability"},
    ["Deflection", defl.length?`${f(Math.max(...defl.map(d=>d.d)),2)} mm`:"–", defl.length?`largest ratio ${f3(defU)} of the Table 6 limit`:"", st2(defl.every(d=>d.d<=d.lim))]
  ];
  const outcomeRow=["Outcome", allOk?"Section is adequate":"Section is not adequate", `Governing: ${govU[0].toLowerCase()}, ratio ${f3(govU[1])}`, allOk?"PASS":"FAIL"];
  const actions=failed.map(k=>[k.name,k.ref,k.demand,k.capacity,actionFor(k)]);
  return {v,sp,fy,fu,eps,cls,betab,steps,checks,failed,allOk,early:false,inRows,U,Sv,LL,EI,st,vx,vLL,vTot,Mpos,Mneg,Vmax,Md,MdLT,Vd,LLT,Mcr,lamLT,chi,gov,webs,defl,sumRows,outcomeRow,actions,sups:A.sups,sw,govU,ltbApplies};
}
function actionFor(k){
  const n=strip(k.name);
  if(/slender/i.test(n)) return "Use a section with thicker flanges or web, or a higher class section.";
  if(/web slenderness/i.test(n)) return "Use a thicker web or add transverse stiffeners.";
  if(/^Shear/i.test(n)) return "Use a section with a deeper or thicker web, or add web stiffeners.";
  if(/lateral-torsional/i.test(n)) return "Add lateral restraints to the compression flange to cut the unsupported length, or use a wider flange section.";
  if(/moment/i.test(n)) return "Use a deeper or heavier section, or a higher steel grade.";
  if(/bearing|buckling/i.test(n)) return "Provide bearing stiffeners, or increase the stiff bearing length.";
  if(/deflection|imposed/i.test(n)) return "Use a deeper section (higher I<sub>z</sub>), or shorten the span.";
  if(/uplift|compression/i.test(n)) return "Hold the support down against uplift.";
  return "Revise the section.";
}
function inputRows(v,sp){
  const G=GRADES[v.grade]||GRADES.E250, r=[];
  r.push(["Section", sp?sp.name:(v.sec||"–"), ""]);
  r.push(["Steel grade", G.n, ""]);
  r.push(["Support condition", SUP_NAME[v.sup], ""]);
  r.push(["Beam length, L", f(v.L,3), "m"]);
  if(v.sup==="ss") r.push(["Overhangs left / right", `${f(v.aL,3)} / ${f(v.aR,3)}`, "m"]);
  if(v.sup==="cont2") r.push(["Interior support at x", f(v.xi,3), "m"]);
  r.push(["Self weight", v.sw==="yes"?"Included":"Not included", ""]);
  r.push(["Load factors, dead / imposed", `${f(v.gD,2)} / ${f(v.gL,2)}`, ""]);
  (v.loads||[]).forEach((l,i)=>{
    const where = (l.type==="P"||l.type==="M") ? `at x = ${f(l.x,3)} m` : `from ${f(l.a,3)} to ${f(l.b,3)} m`;
    const val = l.type==="P" ? `${f(l.P,2)} kN` : l.type==="M" ? `${f(l.C,2)} kN·m` : l.type==="U" ? `${f(l.w1,2)} kN/m` : `${f(l.w1,2)} to ${f(l.w2,2)} kN/m`;
    r.push([`Load ${i+1}: ${LOAD_NAME[l.type].toLowerCase()} (${CASE_NAME[l.cs].toLowerCase()})`, `${val} ${where}`, ""]);
  });
  r.push(["Compression flange", v.lat==="restrained"?"Laterally supported throughout":"Laterally unsupported", ""]);
  if(v.lat!=="restrained"){
    r.push(["Laterally unsupported length", f(v.Lu,3), "m"]);
    r.push(["End restraint (LTB)", v.sup==="cant" ? `${T16S[v.cSup]}; tip: ${T16T[v.cTip]}` : T15[v.t15][0], ""]);
    r.push(["Loading", v.dest==="destab"?"Destabilizing":"Normal", ""]);
    r.push(["Moment factor C1", f(v.C1,3), ""]);
  }
  r.push(["Stiff bearing at supports / under point loads", `${f(v.b1s,0)} / ${f(v.b1p,0)}`, "mm"]);
  r.push(["Deflection limits", v.defl==="custom" ? `span/${v.nSpan}, cantilever/${v.nCant}` : `${DEFL[v.defl][0]} (span/${DEFL[v.defl][1]}, cantilever/${DEFL[v.defl][2]})`, ""]);
  return r;
}
if(typeof module!=="undefined") module.exports={design,secProps,solveBeam,statics,GRADES,FAMS,analyse};
