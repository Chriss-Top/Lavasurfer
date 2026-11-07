'use strict';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),keys=new Set();
let mode=1,players=[],running=false,paused=false,last=0,time=0,camera=0,cameraY=0,zoom=1,muted=true,audio;
const finish=12000,ui=document.querySelector('#overlay');
function resize(){canvas.width=Math.round(canvas.clientWidth*devicePixelRatio);canvas.height=Math.round(canvas.clientHeight*devicePixelRatio);ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
window.addEventListener('resize',resize);resize();
function wave(x){return 270+65*Math.sin(x/160)+25*Math.sin(x/72)}
function slope(x){return 65/160*Math.cos(x/160)+25/72*Math.cos(x/72)}
function curvature(x){return -65/(160*160)*Math.sin(x/160)-25/(72*72)*Math.sin(x/72)}
const gravity=390;
function boardType(i){return document.querySelector('#board'+(i+1)).value}
function rebuild(p){const others=players.filter(q=>q!==p&&q.alive&&!q.done);p.x=others.length?Math.min(...others.map(q=>q.x)):Math.min(p.x,finish-100);Object.assign(p,{y:wave(p.x)-15,v:65,vy:0,board:100,fuel:100,angle:Math.atan(slope(p.x)),spin:0,airLoops:0,jumpHeld:false,air:false,alive:true,done:false,diamond:boardType(players.indexOf(p)),bonus:0});running=true;paused=false;ui.style.display='none';document.querySelector('#state').textContent='WIEDER AUF DER WELLE';}
function fitCamera(){const w=canvas.clientWidth;const visible=players.length?players:[{x:w*.67,y:244}];const minX=Math.min(...visible.map(p=>p.x))-90,maxX=Math.max(...visible.map(p=>p.x))+120;const minY=Math.min(110,...visible.map(p=>p.y-85)),maxY=Math.max(370,...visible.map(p=>p.y+85));zoom=Math.min(1,w/(maxX-minX),(370-30)/(maxY-minY));camera=(minX+maxX)/2-w/(2*zoom);cameraY=(minY+maxY)/2-370/(2*zoom);}
function select(n){if(running)return;mode=n;document.querySelector('#solo').classList.toggle('selected',n===1);document.querySelector('#duo').classList.toggle('selected',n===2)}
document.querySelector('#solo').onclick=()=>select(1);document.querySelector('#duo').onclick=()=>select(2);
function tone(freq){if(muted)return;audio ||= new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.start();o.stop(audio.currentTime+.18)}
document.querySelector('#sound').onclick=()=>{muted=!muted;document.querySelector('#sound').textContent=muted?'TON AUS':'TON AN';tone(440)};
function start(){players=Array.from({length:mode},(_,i)=>({x:80,y:wave(80)-15-i*5,v:65,vy:0,board:100,fuel:100,angle:0,spin:0,airLoops:0,jumpHeld:false,bonus:0,tricks:0,air:false,alive:true,done:false,diamond:boardType(i),color:i?'#64e0d7':'#fff0cb',controls:i?{accelerate:'d',brake:'s',jump:'w',rotate:'a',turbo:'f'}:{accelerate:'ArrowRight',brake:'ArrowDown',jump:'ArrowUp',rotate:'ArrowLeft',turbo:'Shift'}}));camera=0;time=0;running=true;paused=false;ui.style.display='none';document.querySelector('#start').textContent='NEUER RUN ↗';document.querySelector('#state').textContent='RUN LÄUFT';tone(330)}
document.querySelector('#start').onclick=start;
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.length===1?e.key.toLowerCase():e.key);if(e.repeat)return;if(players.some(p=>!p.alive)){players.filter(p=>!p.alive).forEach(rebuild);return;}if(e.key.toLowerCase()==='r')start();if(e.key.toLowerCase()==='p'&&running){paused=!paused;document.querySelector('#state').textContent=paused?'PAUSE · P ZUM FORTSETZEN':'RUN LÄUFT'}});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',()=>{keys.clear();if(running){paused=true;document.querySelector('#state').textContent='PAUSE · P ZUM FORTSETZEN'}});
function update(dt){
 time+=dt;
 for(const p of players){
  if(!p.alive||p.done)continue;
  const {accelerate,brake,jump,rotate,turbo}=p.controls,boost=keys.has(turbo)&&p.fuel>0;
  const jumpPressed=keys.has(jump)&&!p.jumpHeld;p.jumpHeld=keys.has(jump);
  const oldX=p.x,oldY=p.y,oldSlope=slope(oldX);
  const input=((keys.has(accelerate)?240:0)-(keys.has(brake)?300:0)-22)+(boost?150:0);
  // Gravity projected onto the wave tangent accelerates downhill and slows uphill.
  const acceleration=p.air?input*.3:input+gravity*oldSlope/(1+oldSlope*oldSlope);
  p.v=Math.max(35,Math.min(boost?340:270,p.v+acceleration*dt));
  p.bonus=Math.max(0,p.bonus-dt);
  if(p.diamond!=='diamond')p.board=Math.max(0,p.board-dt*(p.air?.3:boost?2:1.25));
  if(boost)p.fuel=Math.max(0,p.fuel-dt*23);
  if(p.board>0&&!p.air){
   // Contact is lost when following a convex crest would require a downward pull.
   if(jumpPressed||curvature(oldX)*p.v*p.v>gravity){
    p.air=true;p.vy=jumpPressed?Math.min(oldSlope*p.v-220,-150):oldSlope*p.v;p.spin=0;p.airLoops=0;tone(600);
   }
  }
  p.x=Math.min(finish,p.x+p.v*dt);
  if(p.board<=0){p.air=true;p.vy+=(gravity-(boost?650:0))*dt;p.y+=p.vy*dt;if(p.y>=wave(p.x)-5){p.y=wave(p.x)-15;p.alive=false;tone(80)}}
  else if(p.air){
   const ay=gravity-(boost?240:0);p.y+=p.vy*dt+.5*ay*dt*dt;p.vy+=ay*dt;
   const rotation=keys.has(rotate)?-1:0;p.angle+=rotation*dt*5.8;p.spin+=rotation*dt*5.8;
   const loops=Math.floor((Math.abs(p.spin)+.001)/(Math.PI*2));
   if(loops>p.airLoops){const count=loops-p.airLoops;p.airLoops=loops;p.tricks+=count;p.fuel=Math.min(150,p.fuel+35*count);p.bonus=2;tone(850)}
   const surface=wave(p.x)-15;
   // Detect crossing the surface relative to its changing height, even on rising waves.
   if(p.y>=surface&&oldY<=wave(oldX)-15+.01){
    const tangent=slope(p.x),landing=Math.abs(Math.atan2(Math.sin(p.angle-Math.atan(tangent)),Math.cos(p.angle-Math.atan(tangent))));
    if(landing>1.2){if(p.diamond!=='diamond')p.board=Math.max(0,p.board-18);tone(100)}else if(p.airLoops){p.fuel=Math.min(150,p.fuel+15);p.bonus=2;tone(1000)}
    p.v=Math.max(35,(p.v+p.vy*tangent)/(1+tangent*tangent));p.y=surface;p.vy=0;p.air=false;p.angle=Math.atan(tangent);
   }
  }else{p.y=wave(p.x)-15;p.angle=Math.atan(slope(p.x));}
  if(p.x>=finish){p.done=true;tone(1000)}
 }
 if(players.every(p=>!p.alive||p.done)){
  running=false;ui.style.display='block';const winners=players.filter(p=>p.done);
  ui.innerHTML=`<p>RUN BEENDET</p><h2>${winners.length?'INSEL ERREICHT!':'NOCH EIN VERSUCH?'}</h2><span>${players.some(p=>!p.alive)?'Beliebige Taste: neu aufbauen. Brett oben auswählen.':'R für einen neuen Run.'}</span>`;
  document.querySelector('#state').textContent=winners.length?'ZIEL ERREICHT':'TASTE DRÜCKEN · NEU AUFBAUEN';
 }
}
function poly(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;fitCamera();ctx.save();ctx.scale(1,h/370);const sky=ctx.createLinearGradient(0,0,0,370);sky.addColorStop(0,'#231922');sky.addColorStop(.7,'#78372c');sky.addColorStop(1,'#ed6b2a');ctx.fillStyle=sky;ctx.fillRect(0,0,w,370);ctx.fillStyle='#fa9c58';ctx.beginPath();ctx.arc(w*.76-camera*.018,108,44,0,Math.PI*2);ctx.fill();for(let i=-1;i<9;i++){let x=i*230-(camera*.13%230);poly([[x,265],[x+70,115+(i%3)*28],[x+100,146],[x+125,127],[x+230,270]],'#39262b');poly([[x+70,115+(i%3)*28],[x+100,146],[x+125,127],[x+108,185]],'#97422c')}ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camera,-cameraY);const bottom=cameraY+370/zoom;for(let layer=0;layer<3;layer++){ctx.beginPath();ctx.moveTo(camera,bottom);for(let x=camera;x<=camera+w/zoom+5;x+=5/zoom)ctx.lineTo(x,wave(x)+layer*16);ctx.lineTo(camera+w/zoom,bottom);ctx.fillStyle=['#ffbd45','#ff6b24','#d73b1c'][layer];ctx.fill();ctx.strokeStyle=['#ffe491','#ffb447','#f9862d'][layer];ctx.lineWidth=3;ctx.stroke()}for(let i=0;i<45;i++){const x=camera+(i*97-camera*.5+w*10)%w/zoom,y=370-((time*22+i*39)%250);ctx.fillStyle=i%2?'#ffad4a':'#d96c3a';ctx.fillRect(x,y,2,3)}const goal=finish;if(goal<camera+w/zoom+150){poly([[goal-20,300],[goal+15,210],[goal+170,200],[goal+230,370],[goal-20,370]],'#40352b');ctx.fillStyle='#ffe8bc';ctx.fillRect(goal+30,140,3,100);poly([[goal+33,140],[goal+85,155],[goal+33,173]],'#64e0d7')}
const shown=players.length?players:[{x:w*.67,y:244,angle:-.25,board:85,color:'#fff0cb',alive:true,fuel:100}];for(const p of shown){ctx.save();ctx.translate(p.x,p.y);if(!p.alive){ctx.fillStyle=p.color;ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('TASTE → NEUAUFBAU',0,-65);ctx.globalAlpha=.45;}ctx.scale(1.5,1.5);ctx.rotate(p.board? p.angle:0);ctx.shadowColor="#171310";ctx.shadowBlur=4;if(p.board){ctx.fillStyle=p.diamond==='diamond'?'#a9ffff':'#ffdd83';ctx.beginPath();ctx.ellipse(0,8,29,Math.max(2,p.board/16),0,0,7);ctx.fill();ctx.strokeStyle='#5c2f25';ctx.lineWidth=2;ctx.stroke();if(p.diamond==='diamond'){for(let k=-2;k<=2;k++)poly([[k*10-5,8],[k*10,3],[k*10+5,8],[k*10,13]],'#36aebd')}}ctx.fillStyle='#777b7a';ctx.fillRect(-19,8,10,8);ctx.fillRect(9,8,10,8);if(keys.has(p.controls?.turbo)&&p.fuel>0||!running&&!players.length){poly([[-18,16],[-13,38+Math.sin(time*30)*8],[-9,16]],'#63e6df');poly([[9,16],[14,38+Math.cos(time*30)*8],[19,16]],'#63e6df')}ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-11,2);ctx.lineTo(-4,-12);ctx.lineTo(8,-4);ctx.lineTo(17,3);ctx.moveTo(-4,-12);ctx.lineTo(0,-29);ctx.lineTo(12,-20);ctx.lineTo(22,-24);ctx.moveTo(0,-28);ctx.lineTo(-13,-20);ctx.lineTo(-21,-22);ctx.stroke();ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(1,-39,7,0,7);ctx.fill();ctx.fillStyle='#322526';ctx.fillRect(0,-42,9,3);ctx.restore()}ctx.restore();ctx.restore();document.querySelector('#hud').innerHTML=players.map((p,i)=>`<div class="playerhud" style="color:${p.color}">P${i+1} · ${p.done?'IM ZIEL':!p.alive?'TASTE: NEUAUFBAU':p.diamond==='diamond'?'DIAMANT ∞':p.board?'BRETT '+Math.ceil(p.board)+'%':'DÜSENFLUG'} <div class="bar"><i style="width:${p.board}%"></i></div>TEMPO ${Math.round(p.v)} · ${p.tricks} LOOPS<br>TURBO ${Math.ceil(p.fuel)} / 150 ${p.bonus>0?"· TRICK-BONUS!":""}<div class="bar"><i style="width:${p.fuel/150*100}%;background:#64e0d7"></i></div></div>`).join('');document.querySelector('#distance').textContent=`${Math.min(finish,Math.floor(Math.max(0,...players.map(p=>p.x))))} / 12.000 m`}
function frame(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;if(running&&!paused)update(dt);else if(!players.length)time+=dt;draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
