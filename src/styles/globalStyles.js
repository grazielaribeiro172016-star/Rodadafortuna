// ═══ CSS ══════════════════════════════════════════════════════
export const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=Rajdhani:wght@500;600;700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#05070f;color:#eeeaf0;min-height:100vh;overflow-x:hidden;font-family:'Rajdhani',sans-serif;}
.cd{font-family:'Cinzel Decorative',serif!important;}
.cn{font-family:'Cinzel',serif!important;}
@keyframes floatUp{0%{transform:translateY(100vh) scale(0);opacity:0;}10%{opacity:.6;}90%{opacity:.3;}100%{transform:translateY(-10vh);opacity:0;}}
.particle{position:absolute;border-radius:50%;animation:floatUp linear infinite;opacity:0;pointer-events:none;}
@keyframes auP{0%{opacity:.6;}100%{opacity:1.2;}}
@keyframes lglow{from{box-shadow:0 0 15px rgba(245,200,66,.5);}to{box-shadow:0 0 35px rgba(245,200,66,.5),0 0 60px rgba(245,200,66,.2);}}
.lglow{animation:lglow 3s ease-in-out infinite alternate;}
@keyframes bp{0%,100%{opacity:1;}50%{opacity:.7;}}
.bp{animation:bp 2s ease-in-out infinite;}
@keyframes wcell{from{box-shadow:0 0 15px rgba(245,200,66,.5);}to{box-shadow:0 0 35px rgba(245,200,66,.5),0 0 60px rgba(245,200,66,.3) inset;}}
.win-cell{animation:wcell .5s ease-in-out infinite alternate;border-color:#f5c842!important;}
@keyframes dcell{from{box-shadow:0 0 20px rgba(194,100,255,.5);}to{box-shadow:0 0 50px rgba(194,100,255,.5),0 0 80px rgba(194,100,255,.3) inset;}}
.dragon-cell{animation:dcell .4s ease-in-out infinite alternate;border-color:#c264ff!important;}
@keyframes kH{0%{transform:scale(1.2);}100%{transform:scale(1);}}
.kH{animation:kH .4s ease-in-out;}
@keyframes tActive{from{box-shadow:0 0 5px rgba(245,200,66,.2);}to{box-shadow:0 0 15px rgba(245,200,66,.5);}}
.tA{animation:tActive .8s ease-in-out infinite alternate;}
@keyframes confF{from{transform:translateY(-20px) rotate(0deg);opacity:1;}to{transform:translateY(105vh) rotate(720deg);opacity:0;}}
.conf{position:absolute;animation:confF linear forwards;}

/* ═══ FASE 6 — MICROINTERAÇÕES ═══ */
.btn-press{transition:transform .15s cubic-bezier(.34,1.56,.64,1),box-shadow .2s ease,filter .2s ease;}
.btn-press:active:not(:disabled){transform:scale(.94);filter:brightness(.92);}
.btn-press:hover:not(:disabled){transform:translateY(-1px);}
.btn-press:disabled{transform:none!important;}

@keyframes spin360{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,.25);border-top-color:currentColor;border-radius:50%;animation:spin360 .6s linear infinite;}

@keyframes cardHover{from{transform:translateY(0) scale(1);}to{transform:translateY(-8px) scale(1.025);}}
.card-lift{transition:transform .35s cubic-bezier(.175,.885,.32,1.275),box-shadow .35s ease;}
.card-lift:hover{transform:translateY(-8px) scale(1.025);}

@keyframes chipPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,200,66,.5);}50%{box-shadow:0 0 0 6px rgba(245,200,66,0);}}
.chip-active{animation:chipPulse 1.6s ease-in-out infinite;}

@keyframes softGlowPulse{0%,100%{filter:drop-shadow(0 0 6px currentColor);}50%{filter:drop-shadow(0 0 14px currentColor);}}
.icon-glow-pulse{animation:softGlowPulse 2.2s ease-in-out infinite;}

@keyframes fadeSlideIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
.fade-in-up{animation:fadeSlideIn .3s cubic-bezier(.16,1,.3,1) both;}

@keyframes shimmerLoad{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
.skeleton{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmerLoad 1.4s ease-in-out infinite;border-radius:8px;}

/* ═══ FASE 7 — CELEBRAÇÃO DE VITÓRIAS EM CAMADAS ═══ */
@keyframes screenShake{0%,100%{transform:translate(0,0);}10%{transform:translate(-3px,2px);}20%{transform:translate(3px,-2px);}30%{transform:translate(-4px,0);}40%{transform:translate(4px,1px);}50%{transform:translate(-2px,-2px);}60%{transform:translate(2px,2px);}70%{transform:translate(-3px,0);}80%{transform:translate(3px,-1px);}90%{transform:translate(-1px,1px);}}
.screen-shake{animation:screenShake .5s cubic-bezier(.36,.07,.19,.97) both;}

@keyframes flashBig{0%{opacity:0;}8%{opacity:1;}100%{opacity:0;}}
.flash-overlay{position:fixed;inset:0;pointer-events:none;z-index:998;animation:flashBig .7s ease-out forwards;}

@keyframes winPopSmall{0%{transform:scale(.9);opacity:0;}60%{transform:scale(1.03);}100%{transform:scale(1);opacity:1;}}
.win-pop-sm{animation:winPopSmall .35s cubic-bezier(.34,1.56,.64,1) both;}

@keyframes winPopMed{0%{transform:scale(.7) rotate(-2deg);opacity:0;}50%{transform:scale(1.12) rotate(1deg);}75%{transform:scale(.97) rotate(0deg);}100%{transform:scale(1);opacity:1;}}
.win-pop-md{animation:winPopMed .55s cubic-bezier(.34,1.56,.64,1) both;}

@keyframes winPopBig{0%{transform:scale(.4) rotate(-6deg);opacity:0;}45%{transform:scale(1.25) rotate(3deg);}65%{transform:scale(.92) rotate(-1deg);}85%{transform:scale(1.06) rotate(.5deg);}100%{transform:scale(1) rotate(0deg);opacity:1;}}
.win-pop-lg{animation:winPopBig .8s cubic-bezier(.34,1.56,.64,1) both;}

@keyframes glowPulseSm{0%,100%{box-shadow:0 0 12px rgba(245,200,66,.3);}50%{box-shadow:0 0 24px rgba(245,200,66,.55);}}
.glow-pulse-sm{animation:glowPulseSm 1.2s ease-in-out 2;}

@keyframes glowPulseLg{0%,100%{box-shadow:0 0 25px rgba(245,200,66,.5),0 0 50px rgba(245,200,66,.2);}50%{box-shadow:0 0 50px rgba(245,200,66,.8),0 0 90px rgba(245,200,66,.4);}}
.glow-pulse-lg{animation:glowPulseLg .9s ease-in-out 3;}

.count-up-num{font-variant-numeric:tabular-nums;}
@keyframes dFloat{from{transform:translateY(0) scale(1);}to{transform:translateY(-12px) scale(1.05);}}
.dF{animation:dFloat 1s ease-in-out infinite alternate;}
.gc{position:relative;border-radius:18px;overflow:hidden;cursor:pointer;background:rgba(10,15,30,.9);border:1px solid rgba(255,255,255,.06);transition:transform .25s cubic-bezier(.175,.885,.32,1.275),border-color .25s,box-shadow .25s;}
.gc:hover{transform:translateY(-6px) scale(1.02);border-color:rgba(255,255,255,.18);}
.ns::-webkit-scrollbar{display:none;}.ns{-ms-overflow-style:none;scrollbar-width:none;}
.qa{border-color:#f5c842!important;color:#f5c842!important;background:rgba(245,200,66,.1)!important;}
`;
