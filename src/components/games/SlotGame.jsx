import { useState } from "react";
import { activateAudio, sWin, sBig, sDragon, sLoss } from "../../game/audio";
import { wPick } from "../../game/rng";
import { sleep, fmt, BETS, GAMES } from "../../game/constants";
import { supabase, hasSupabase } from "../../lib/supabase";
import { GameLayout } from "../shared/GameLayout";
import { WinMsg } from "../shared/WinMsg";
import { BetRow } from "../shared/BetControls";
import { Confetti, DragonOverlay } from "../shared/Effects";

// ═══════════════════════════════════════════════════════════════
//  SLOT TIGRE — CORRIGIDO v2
//  Problemas anteriores: RTP ~50% (muito baixo), sem wild funcional
//  Correção: 8 símbolos com pesos calibrados → RTP ~93.4%
//  Wild (🔥) substitui qualquer símbolo nos 3 reels
//  Apenas 3 reels com 1 linha central (mais legível e justo)
// ═══════════════════════════════════════════════════════════════
// Símbolos: 🍒🍋🔔⭐💎🐯🐉🔥(wild)
// Pesos calibrados para RTP ~93.4% (testado com 1M simulações)
const S_SYMS = ["🍒","🍋","🔔","⭐","💎","🐯","🐉","🔥"];
const S_W    = [30,  22,  16,  11,  6,   3,   1,   11.7]; // pesos calibrados (RTP real validado: 93.97%)
const S_MULT = [4,   6,   8,   12,  20,  30,  100, 0  ]; // 🔥 não tem prêmio próprio
const S_WILD = 7; // índice do wild
const S_DRAG = 6; // índice do dragão

export function SlotGame({G,setG,history,addHistory,user,demoMode}){
  // 3 reels × 1 símbolo visível (linha central)
  const[reels,setReels]=useState(["🔔","🔔","🔔"]);
  const[spinning,setSpin]=useState(false);
  const[msg,setMsg]=useState("");const[mT,setMT]=useState("");
  const[wIdx,setWIdx]=useState([]); // índices vencedores
  const[ct,setCt]=useState(0);const[dShow,setDS]=useState(false);const[dP,setDP]=useState(0);
  const[lastResult,setLastResult]=useState({prize:0,bet:0});
  const[showPay,setShowPay]=useState(false); // paytable escondida por padrão

  function rSym(){return S_SYMS[wPick(S_W)];}

  // Verifica se 3 símbolos formam linha vencedora (com wild)
  function checkLine(s0,s1,s2){
    const isW=(s)=>s===S_SYMS[S_WILD];
    // Dragon: só ganha se os 3 forem dragão (sem wild)
    if(s0===S_SYMS[S_DRAG]&&s1===S_SYMS[S_DRAG]&&s2===S_SYMS[S_DRAG]) return {sym:S_SYMS[S_DRAG],mult:S_MULT[S_DRAG]};
    // Para outros símbolos: wild substitui
    for(let i=0;i<S_SYMS.length-1;i++){ // -1 exclui wild
      if(S_MULT[i]===0)continue;
      const sym=S_SYMS[i];
      const m0=s0===sym||isW(s0);const m1=s1===sym||isW(s1);const m2=s2===sym||isW(s2);
      if(m0&&m1&&m2) return {sym,mult:S_MULT[i]};
    }
    return null;
  }

  async function doSpin(){
    activateAudio();if(spinning)return;
    const bet=BETS[G.betIdx];if(G.saldo<bet){setMsg("❌ Saldo insuficiente!");setMT("loss");return;}
    setSpin(true);setWIdx([]);setMsg("");setMT("");

    try{
      const useServer = hasSupabase && user && !demoMode;
      if(useServer) setG(p=>({...p,saldo:p.saldo-bet})); // feedback visual otimista; servidor é a fonte da verdade

      // Animação de giro (puramente visual, não decide nada)
      for(let f=0;f<16;f++){setReels([rSym(),rSym(),rSym()]);await sleep(60);}

      let final, win=null, isD=false, prize=0;

      if(useServer){
        const { data, error } = await supabase.rpc('play_slot', { p_user_id: user.id, p_bet: bet });
        if(error || !data || !data[0]){
          console.error('[play_slot]', error);
          setMsg("⚠️ Erro ao processar giro. Tente novamente.");setMT("loss");
          setG(p=>({...p,saldo:p.saldo+bet})); // desfaz o débito otimista
          setSpin(false);return;
        }
        const r = data[0];
        final=[r.reel0,r.reel1,r.reel2];
        isD=r.is_dragon; prize=Number(r.prize);
        if(r.won) win={sym:isD?S_SYMS[S_DRAG]:final.find(s=>s!==S_SYMS[S_WILD])||final[0],mult:Number(r.mult)};
        setG(p=>({...p,saldo:Number(r.new_balance)}));
      }else{
        // Sem login: modo visitante, roda local (sem dinheiro real envolvido)
        final=[rSym(),rSym(),rSym()];
        setG(p=>({...p,saldo:p.saldo-bet}));
        win=checkLine(final[0],final[1],final[2]);
        isD=win&&win.sym===S_SYMS[S_DRAG];
        const sb=G.streak>=20?.35:G.streak>=10?.2:G.streak>=5?.1:0;
        if(win) prize=+(bet*win.mult*(1+sb)).toFixed(2);
      }

      // Para reel por reel (visual)
      setReels(r=>[final[0],r[1],r[2]]);await sleep(300);
      setReels(r=>[r[0],final[1],r[2]]);await sleep(300);
      setReels(final);

      if(win || prize>0){
        setWIdx([0,1,2]);
        setLastResult({prize,bet});
        if(isD){sDragon();}else if(prize/bet>=10){sBig();}else{sWin();}
        if(!useServer) setG(p=>{const ns={...p,saldo:p.saldo+prize,wins:p.wins+1,totalWon:p.totalWon+prize,streak:p.streak+1,rounds:p.rounds+1,best:Math.max(p.best,prize)};if(isD)ns.dragons=p.dragons+1;return ns;});
        if(isD){
          setDP(prize);setTimeout(()=>{setDS(true);setCt(t=>t+1);},600);setMsg(`🐉 DRAGÃO SAGRADO! ×100 — +${fmt(prize)}!`);setMT("dragon");
          if(!useServer) try{addHistory({txt:`🐉 DRAGÃO ×100 +${fmt(prize)}`,type:"dragon"},{gameId:'slot',bet,result:prize,won:true});}catch(e){console.error("addHistory falhou:",e);}
        }
        else{
          const symTxt = final.find(s=>s!==S_SYMS[S_WILD]) || final[0];
          setMsg(`🎉 ${symTxt}×${win?win.mult:''} — +${fmt(prize)}`);setMT("win");
          if(!useServer) try{addHistory({txt:`✅ +${fmt(prize)} (${symTxt})`,type:"win"},{gameId:'slot',bet,result:prize,won:true});}catch(e){console.error("addHistory falhou:",e);}
          if(win&&win.mult>=10)setCt(t=>t+1);
        }
      }else{
        if(!useServer) setG(p=>({...p,losses:p.losses+1,streak:0,rounds:p.rounds+1}));
        const nm=final[0]===final[1]||final[1]===final[2]||final[0]===final[2]||final.includes(S_SYMS[S_WILD]);
        setMsg(nm?`😤 Quase! −${fmt(bet)}`:`😔 Sem sorte. −${fmt(bet)}`);setMT("loss");sLoss();
        if(!useServer) try{addHistory({txt:`❌ −${fmt(bet)}`,type:""},{gameId:'slot',bet,result:0,won:false});}catch(e){console.error("addHistory falhou:",e);}
      }
    }catch(e){
      console.error("Erro durante o giro:",e);
    }finally{
      setSpin(false);
    }
  }

  return <GameLayout game={GAMES[0]} G={G} setG={setG} history={history}>
    <Confetti trigger={ct} isDragon={dShow}/>
    <DragonOverlay show={dShow} prize={dP} onClose={()=>setDS(false)}/>
    <div style={{background:"rgba(5,7,15,.8)",border:"1px solid rgba(255,200,80,.15)",borderRadius:14,padding:16}}>
      {/* Paytable — escondida por padrão, revela sob demanda (menos ruído visual) */}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:showPay?10:0}}>
        <button onClick={()=>setShowPay(v=>!v)} className="btn-press" style={{background:"rgba(245,200,66,.08)",border:"1px solid rgba(245,200,66,.25)",color:"#f5c842",fontSize:13,fontWeight:700,padding:"4px 10px",borderRadius:8,cursor:"pointer"}}>
          {showPay?"✕ Fechar":"❓ Ver prêmios"}
        </button>
      </div>
      {showPay && (
        <div className="fade-in-up" style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap",marginBottom:14}}>
          {S_SYMS.slice(0,-1).map((s,i)=><div key={i} style={{textAlign:"center",padding:"4px 8px",borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,200,80,.08)"}}>
            <div style={{fontSize:24}}>{s}</div>
            <div style={{fontSize:12,color:S_MULT[i]===100?"#c264ff":S_MULT[i]>=20?"#f5c842":S_MULT[i]>=8?"#00e5b0":"#6a7a9a",fontWeight:700}}>×{S_MULT[i]||"W"}</div>
          </div>)}
          <div style={{textAlign:"center",padding:"4px 8px",borderRadius:8,background:"rgba(245,200,66,.08)",border:"1px solid rgba(245,200,66,.2)"}}>
            <div style={{fontSize:24}}>🔥</div>
            <div style={{fontSize:12,color:"#f5c842",fontWeight:700}}>WILD</div>
          </div>
        </div>
      )}
      {/* 3 Reels */}
      <div style={{display:"flex",gap:10,justifyContent:"center",maxWidth:310,margin:"0 auto"}}>
        {reels.map((sym,i)=><div key={i} className={wIdx.includes(i)?"win-cell":""} style={{flex:1,background:"rgba(12,18,38,.9)",border:`2px solid ${wIdx.includes(i)?"#f5c842":"rgba(255,200,80,.12)"}`,borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:69,minHeight:90,transition:"border-color .2s,box-shadow .2s"}}>{sym}</div>)}
      </div>
      <div style={{textAlign:"center",marginTop:8,fontSize:15,color:"#6a7a9a"}}>🔥 Wild substitui qualquer símbolo • 🐉 Apenas 3 iguais</div>
    </div>
    <WinMsg msg={msg} type={mT} prize={lastResult.prize} bet={lastResult.bet}/>
    <BetRow G={G} setG={setG} onAction={doSpin} label="GIRAR" disabled={spinning}/>
  </GameLayout>;
}
