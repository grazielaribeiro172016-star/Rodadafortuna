// ═══ AUDIO ENGINE ═════════════════════════════════════════════
let _AC=null,_muted=true,_mG=null,_sG=null,_bG=null;
function getAC(){
  if(!_AC){_AC=new(window.AudioContext||window.webkitAudioContext)();_mG=_AC.createGain();_mG.gain.value=0.7;_sG=_AC.createGain();_sG.gain.value=1.0;_bG=_AC.createGain();_bG.gain.value=0.18;_sG.connect(_mG);_bG.connect(_mG);_mG.connect(_AC.destination);startAmb();}
  if(_AC.state==="suspended")_AC.resume();return _AC;
}
export function activateAudio(){if(_muted){_muted=false;if(_mG)_mG.gain.value=0.7;}getAC().resume().catch(()=>{});}
function pT(f,t="sine",a=.01,d=.1,s=.6,r=.2,dur=.3,dest){if(_muted)return;const ac=getAC();const o=ac.createOscillator();const g=ac.createGain();o.connect(g);g.connect(dest||_sG);o.type=t;o.frequency.value=f;const n=ac.currentTime;g.gain.setValueAtTime(0,n);g.gain.linearRampToValueAtTime(.5,n+a);g.gain.linearRampToValueAtTime(.5*s,n+a+d);g.gain.setValueAtTime(.5*s,n+dur);g.gain.linearRampToValueAtTime(0,n+dur+r);o.start(n);o.stop(n+dur+r+.05);}
function pN(dur=.2,fc=2000,gv=.3,dest){if(_muted)return;const ac=getAC();const sz=Math.floor(ac.sampleRate*dur);const b=ac.createBuffer(1,sz,ac.sampleRate);const d=b.getChannelData(0);for(let i=0;i<sz;i++)d[i]=Math.random()*2-1;const src=ac.createBufferSource();src.buffer=b;const fl=ac.createBiquadFilter();fl.type="lowpass";fl.frequency.value=fc;const gn=ac.createGain();gn.gain.setValueAtTime(gv,ac.currentTime);gn.gain.linearRampToValueAtTime(0,ac.currentTime+dur);src.connect(fl);fl.connect(gn);gn.connect(dest||_sG);src.start();src.stop(ac.currentTime+dur);}
export function sWin(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>pT(f,"sine",.01,.08,.6,.2,.15),i*80));}
export function sBig(){[261,329,392,523].forEach((f,i)=>setTimeout(()=>pT(f,"sawtooth",.02,.15,.7,.5,.8),i*30));[1047,1319,1568].forEach((f,i)=>setTimeout(()=>pT(f,"sine",.001,.02,.8,.4,.5),200+i*120));}
export function sDragon(){pT(55,"sawtooth",.1,.3,.8,1,1.5);pT(82,"sawtooth",.05,.3,.7,1,1.5);setTimeout(()=>[523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>pT(f,"sine",.01,.1,.8,.6,.8),i*100)),300);}
export function sLoss(){pT(392,"sine",.01,.1,.5,.3,.15);setTimeout(()=>pT(330,"sine",.01,.1,.5,.3,.15),120);setTimeout(()=>pT(262,"sine",.01,.15,.4,.4,.25),240);}
export function sBomb(){pN(.4,300,.5);pT(60,"sawtooth",.001,.1,.6,.5,.4);}
export function sCash(){[880,1109,1319,1568].forEach((f,i)=>setTimeout(()=>pT(f,"sine",.001,.05,.8,.2,.25),i*60));}
export function sCard(){pN(.08,3000,.2);pT(440,"sine",.001,.05,.2,.1,.06);}
export function sDice(){for(let i=0;i<8;i++)(j=>setTimeout(()=>pN(.04,1500,.15),j*60))(i);}
export function sTreasure(){[784,988,1175,1568].forEach((f,i)=>setTimeout(()=>pT(f,"sine",.001,.05,.8,.2,.2),i*60));}
export function sFloor(){pT(440,"sine",.01,.05,.6,.2,.12);setTimeout(()=>pT(554,"sine",.01,.05,.6,.2,.12),80);}
export function sPeg(){pT(300+Math.random()*200,"sine",.001,.03,.3,.05,.06);}
export function sKeno(){pT(880,"sine",.001,.04,.6,.1,.1);}
export function sBJ(){[523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>pT(f,"sine",.001,.06,.9,.3,.4),i*90));}
let _cR=null;
export function sCrashStart(){if(_muted)return;const ac=getAC();_cR=ac.createOscillator();const g=ac.createGain();g.gain.value=.06;_cR.connect(g);g.connect(_sG);_cR.type="sawtooth";_cR.frequency.setValueAtTime(80,ac.currentTime);_cR.frequency.exponentialRampToValueAtTime(800,ac.currentTime+30);_cR.start();}
export function sCrashStop(){if(_cR){try{_cR.stop();}catch(e){}_cR=null;}}
let _rW=null;
export function sRolStart(){if(_muted)return;const ac=getAC();const sz=Math.floor(ac.sampleRate*.5);const b=ac.createBuffer(1,sz,ac.sampleRate);const d=b.getChannelData(0);for(let i=0;i<sz;i++)d[i]=Math.random()*2-1;_rW=ac.createBufferSource();_rW.buffer=b;_rW.loop=true;const fl=ac.createBiquadFilter();fl.type="bandpass";fl.frequency.value=600;fl.Q.value=2;const g=ac.createGain();g.gain.value=.12;fl.frequency.setValueAtTime(1200,ac.currentTime);fl.frequency.linearRampToValueAtTime(200,ac.currentTime+3.5);_rW.connect(fl);fl.connect(g);g.connect(_sG);_rW.start();}
export function sRolStop(){if(_rW){try{_rW.stop();}catch(e){}_rW=null;}pT(220,"square",.001,.1,.3,.15,.2);}
export function startAmb(){if(_muted)return;const jn=[196,220,247,261,294,330,349,392,440,494];function p(){if(!_bG)return;pT(55,"sine",.05,.3,.4,.8,1,_bG);setTimeout(p,2000+Math.random()*1000);}setTimeout(p,500);function j(){if(!_bG)return;pT(jn[Math.floor(Math.random()*jn.length)]*2,"sine",.02,.1,.3,.8,.4,_bG);setTimeout(j,800+Math.random()*2400);}setTimeout(j,1200);}

// Exposed so the header mute button can control the shared audio engine
export function setAudioMuted(isMuted){
  _muted = isMuted;
  if(_mG) _mG.gain.value = isMuted ? 0 : .7;
}
