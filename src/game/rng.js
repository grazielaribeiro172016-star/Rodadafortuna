let _s=[1,2,3,4];
(function(){const b=new Uint32Array(4);crypto.getRandomValues(b);_s=[b[0]||1,b[1]||2,b[2]||3,b[3]||4];})();
let _cnt=0;
function rotl(x,k){return(x<<k)|(x>>>(32-k));}
export function rnd(){
  const r=(_s[0]+_s[3])>>>0;const t=(_s[1]<<9)>>>0;
  _s[2]^=_s[0];_s[3]^=_s[1];_s[1]^=_s[2];_s[0]^=_s[3];_s[2]^=t;_s[3]=rotl(_s[3],11);
  if(++_cnt%50===0){const b=new Uint32Array(1);crypto.getRandomValues(b);_s[_cnt%4]^=b[0]||1;}
  return r*(1/4294967296);
}
export function wPick(w){const t=w.reduce((a,b)=>a+b,0);let r=rnd()*t;for(let i=0;i<w.length;i++){r-=w[i];if(r<0)return i;}return w.length-1;}
export function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
