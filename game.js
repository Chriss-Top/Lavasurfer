'use strict';
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),keys=new Set();
let mode=1,players=[],running=false,paused=false,last=0,time=0,camera=0,cameraY=0,zoom=1,muted=true,audio;
let hazards=[],sparks=[],stormClock=0,spawnClock=0;
let giantWaves=[],cannonballs=[];
let finish=24000;const ui=document.querySelector('#overlay');
function resize(){canvas.width=Math.round(canvas.clientWidth*devicePixelRatio);canvas.height=Math.round(canvas.clientHeight*devicePixelRatio);ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
window.addEventListener('resize',resize);resize();
function wave(x){return 270+65*Math.sin(x/160)+25*Math.sin(x/72)}
function slope(x){return 65/160*Math.cos(x/160)+25/72*Math.cos(x/72)}
function curvature(x){return -65/(160*160)*Math.sin(x/160)-25/(72*72)*Math.sin(x/72)}
const gravity=390;
function boardType(i){return document.querySelector('#board'+(i+1)).value}
function rebuild(p){const others=players.filter(q=>q!==p&&q.alive&&!q.done);p.x=others.length?Math.min(...others.map(q=>q.x)):Math.min(p.x,finish-100);Object.assign(p,{y:wave(p.x)-15,v:65,vy:0,board:100,fuel:100,angle:Math.atan(slope(p.x)),spin:0,airLoops:0,attackTime:0,attackCooldown:0,shield:0,smashes:0,cannonHeld:false,jumpHeld:false,air:false,alive:true,done:false,diamond:boardType(players.indexOf(p)),bonus:0});running=true;paused=false;ui.style.display='none';document.querySelector('#state').textContent='WIEDER AUF DER WELLE';}
function fitCamera(){const w=canvas.clientWidth;const visible=players.length?players:[{x:w*.67,y:244}];const minX=Math.min(...visible.map(p=>p.x))-90,maxX=Math.max(...visible.map(p=>p.x))+120;const minY=Math.min(110,...visible.map(p=>p.y-85)),maxY=Math.max(370,...visible.map(p=>p.y+85));zoom=Math.min(1,w/(maxX-minX),(370-30)/(maxY-minY));camera=(minX+maxX)/2-w/(2*zoom);cameraY=(minY+maxY)/2-370/(2*zoom);}
function select(n){if(running)return;mode=n;document.querySelector('#solo').classList.toggle('selected',n===1);document.querySelector('#duo').classList.toggle('selected',n===2)}
document.querySelector('#solo').onclick=()=>select(1);document.querySelector('#duo').onclick=()=>select(2);
function tone(freq){if(muted)return;audio ||= new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.start();o.stop(audio.currentTime+.18)}
document.querySelector('#sound').onclick=()=>{muted=!muted;document.querySelector('#sound').textContent=muted?'TON AUS':'TON AN';tone(440)};
function start(){players=Array.from({length:mode},(_,i)=>({x:80,y:wave(80)-15-i*5,v:65,vy:0,board:100,fuel:100,angle:0,spin:0,airLoops:0,attackTime:0,attackCooldown:0,shield:0,smashes:0,cannonHeld:false,jumpHeld:false,bonus:0,tricks:0,air:false,alive:true,done:false,diamond:boardType(i),color:i?'#64e0d7':'#fff0cb',controls:i?{backward:'a',forward:'d',brake:'s',jump:'w',turbo:'f',rocket:'e',attack:'q',cannon:'c'}:{backward:'ArrowLeft',forward:'ArrowRight',brake:'ArrowDown',jump:'ArrowUp',turbo:'Shift',rocket:' ',attack:'Enter',cannon:'0'}}));finish=Number(document.querySelector('#level').value);giantWaves=Array.from({length:Math.floor((finish-1000)/3000)},(_,i)=>({x:2500+i*3000,hp:3,shots:8,state:'standing',timer:0,wait:0,blocked:0}));cannonballs=[];camera=0;time=0;hazards=[];sparks=[];stormClock=0;spawnClock=0;running=true;paused=false;ui.style.display='none';document.querySelector('#start').textContent='NEUER RUN ↗';document.querySelector('#state').textContent='RUN LÄUFT';tone(330)}
document.querySelector('#start').onclick=start;
window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter'].includes(e.key))e.preventDefault();keys.add(e.key.length===1?e.key.toLowerCase():e.key);if(e.repeat)return;if(players.some(p=>!p.alive)){players.filter(p=>!p.alive).forEach(rebuild);return;}if(e.key.toLowerCase()==='r')start();if(e.key.toLowerCase()==='p'&&running){paused=!paused;document.querySelector('#state').textContent=paused?'PAUSE · P ZUM FORTSETZEN':'RUN LÄUFT'}});window.addEventListener('keyup',e=>keys.delete(e.key.length===1?e.key.toLowerCase():e.key));window.addEventListener('blur',()=>{keys.clear();if(running){paused=true;document.querySelector('#state').textContent='PAUSE · P ZUM FORTSETZEN'}});
function hasFuel(p){return p.diamond==='diamond'||p.fuel>0}
function activeDrive(p,control){return p.alive&&!p.done&&keys.has(p.controls?.[control])&&hasFuel(p)}
function attacking(p){return p.alive&&!p.done&&(p.diamond==='diamond'?keys.has(p.controls.attack):p.attackTime>0)}
function burst(x,y,color){for(let i=0;i<12;i++)sparks.push({x,y,vx:(Math.random()-.5)*240,vy:-Math.random()*180,life:.6,color})}
function stormPhase(){const phase=stormClock%22;return phase>=6&&phase<8?'warning':phase>=8&&phase<15?'active':'calm'}
function hitDistance(ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));return Math.hypot(ax+dx*t,ay+dy*t)}
function updateHazards(dt){
 stormClock+=dt;
 if(stormPhase()==='active'){
  spawnClock-=dt;
  if(spawnClock<=0){spawnClock=.65;for(const p of players.filter(p=>p.alive&&!p.done)){const meteor=Math.random()<.5;hazards.push({x:p.x+p.v*.9+(Math.random()-.5)*220,y:Math.min(-50,p.y-300),vx:-40-Math.random()*45,vy:90,r:meteor?17:10,meteor,warning:.75,life:7})}}
 }else spawnClock=0;
 for(const h of hazards){
  h.life-=dt;if(h.warning>0){h.warning-=dt;continue}
  const ox=h.x,oy=h.y;h.vy+=gravity*.65*dt;h.x+=h.vx*dt;h.y+=h.vy*dt;
  for(const p of players){
   if(!p.alive||p.done)continue;
   const distance=hitDistance(ox-(p.previousX??p.x),oy-((p.previousY??p.y)-25),h.x-p.x,h.y-(p.y-25));
   if(attacking(p)&&distance<h.r+(p.diamond==='diamond'?105:80)){
    h.life=0;p.smashes++;p.fuel=Math.min(150,p.fuel+10);burst(h.x,h.y,p.diamond==='diamond'?'#8fffff':'#ffd490');tone(700);break;
   }
   if(p.shield<=0&&distance<h.r+25){h.life=0;p.shield=1.2;p.v=Math.max(35,p.v*.6);if(p.diamond!=='diamond'){p.board=Math.max(0,p.board-(h.meteor?24:14));p.fuel=Math.max(0,p.fuel-10)}burst(h.x,h.y,'#ff6735');tone(95);break}
  }
  if(h.y> wave(h.x)+25){h.life=0;burst(h.x,wave(h.x),'#ff8e36')}
 }
 hazards=hazards.filter(h=>h.life>0);
 for(const f of sparks){f.life-=dt;f.x+=f.vx*dt;f.y+=f.vy*dt;f.vy+=gravity*dt}sparks=sparks.filter(f=>f.life>0);
 if(running&&!paused)document.querySelector('#state').textContent=stormPhase()==='warning'?'⚠ LAVASCHAUER IM ANFLUG':stormPhase()==='active'?'☄ AUSWEICHEN ODER ZERSCHMETTERN':'RUN LÄUFT';
}
function drawHazards(){
 for(const h of hazards){
  if(h.warning>0){ctx.strokeStyle='#ffda65';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x,wave(h.x));ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffe795';ctx.font='bold 20px sans-serif';ctx.fillText('!',h.x-4,wave(h.x)-45);continue}
  poly([[h.x-h.r,h.y],[h.x-h.vx*.16,h.y-h.vy*.16],[h.x+h.r,h.y]],'#ff6439');ctx.fillStyle=h.meteor?'#492e29':'#ffb338';ctx.strokeStyle='#ff9a3b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,Math.PI*2);ctx.fill();ctx.stroke();if(h.meteor){ctx.fillStyle='#ffa94b';ctx.fillRect(h.x-7,h.y-5,6,4);ctx.fillRect(h.x+3,h.y+3,4,5)}
 }
 for(const f of sparks){ctx.globalAlpha=Math.max(0,f.life/.6);ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,4,4)}ctx.globalAlpha=1;
}
function cannonTarget(p){return giantWaves.find(w=>w.state==='standing'&&w.x>p.x-30&&w.x-p.x<1300)}
function collapseWave(w,laser=false){if(w.state!=='standing')return;w.state=laser?'laser':'falling';w.timer=0;tone(laser?1200:180);burst(w.x,wave(w.x)-150,'#ffb357')}
function updateGiants(dt){
 for(const w of giantWaves){
  if(w.state==='laser'){w.timer+=dt;if(w.timer>.65){w.state='falling';w.timer=0}}
  else if(w.state==='falling'){w.timer+=dt;if(w.timer>1.3){w.state='smoke';w.timer=0}}
  else if(w.state==='smoke'){w.timer+=dt;if(w.timer>2.5)w.state='clear'}
  else if(w.state==='standing'){
   if(w.shots===0){w.wait+=dt;if(w.wait>1.5)collapseWave(w,true)}
   for(const p of players){if(!p.alive||p.done)continue;const crossed=(p.previousX??p.x)<=w.x-65&&p.x>=w.x-65;
    if(crossed){p.x=w.x-66;p.v=Math.min(p.v,65);w.blocked+=dt;}
   }
   // Emergency clearance also prevents a player without firing from getting stuck.
   if(w.blocked>2)collapseWave(w,true);
  }
 }
 for(const b of cannonballs){const old=b.x;b.x+=1100*dt;b.life-=dt;const w=b.target;
  if(w.state==='standing'&&old<=w.x&&b.x>=w.x){if(b.y>wave(w.x)-330&&b.y<wave(w.x)+20){w.hp--;burst(w.x,b.y,'#ffc47d');if(w.hp<=0)collapseWave(w)}b.life=0;}
 }cannonballs=cannonballs.filter(b=>b.life>0);
}
function drawGiants(){
 for(const w of giantWaves){if(w.state==='clear'||w.x<camera-400||w.x>camera+canvas.clientWidth/zoom+400)continue;
  const base=wave(w.x)+25;ctx.save();ctx.translate(w.x,base);
  if(w.state==='smoke'){ctx.globalAlpha=1-w.timer/2.5;for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#9a7771':'#5d4c4d';ctx.beginPath();ctx.arc((i-4)*20,-w.timer*55-i*13,22+w.timer*14,0,Math.PI*2);ctx.fill()}}
  else{if(w.state==='falling'){ctx.rotate(Math.min(1,w.timer/1.3)*Math.PI/2);ctx.globalAlpha=1-w.timer/1.6}
   poly([[-55,0],[-42,-140],[-20,-270],[0,-345],[60,-320],[85,-265],[32,-265],[12,-170],[60,0]],'#f86625');
   ctx.strokeStyle='#ffd25a';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-45,0);ctx.quadraticCurveTo(-65,-360,55,-322);ctx.stroke();
   for(let i=0;i<3-w.hp;i++){ctx.strokeStyle='#34201e';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-25,-80-i*75);ctx.lineTo(25,-120-i*75);ctx.stroke()}
   if(w.state==='laser'){ctx.strokeStyle='#9fffff';ctx.lineWidth=7;for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(-450,-300+i*55);ctx.lineTo(0,-270+i*55);ctx.stroke()}}
  }ctx.restore();
  if(w.state==='standing'){ctx.fillStyle='#fff3c7';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillText('RIESENWELLE · '+w.hp+' TREFFER · '+w.shots+'/8 SCHÜSSE',w.x,base-365);ctx.textAlign='start'}
 }
 for(const b of cannonballs){poly([[b.x-30,b.y-7],[b.x-70,b.y],[b.x-30,b.y+7]],'#ff7737');ctx.fillStyle='#ffcc77';ctx.beginPath();ctx.arc(b.x,b.y,12,0,Math.PI*2);ctx.fill()}
}
function update(dt){
 time+=dt;
 for(const p of players){
  if(!p.alive||p.done)continue;
  p.previousX=p.x;p.previousY=p.y;
  const fire=keys.has(p.controls.cannon)&&!p.cannonHeld;p.cannonHeld=keys.has(p.controls.cannon);const target=cannonTarget(p);
  if(fire&&target&&target.shots>0){target.shots--;cannonballs.push({x:p.x+30,y:p.y-25,target,life:2});tone(250)}
  p.attackTime=Math.max(0,p.attackTime-dt);p.attackCooldown=Math.max(0,p.attackCooldown-dt);p.shield=Math.max(0,p.shield-dt);
  if(keys.has(p.controls.attack)&&p.attackCooldown<=0){p.attackTime=.25;p.attackCooldown=.45}
  const {backward,forward,brake,jump}=p.controls,boost=activeDrive(p,'turbo'),rocket=activeDrive(p,'rocket');
  const jumpPressed=keys.has(jump)&&!p.jumpHeld;p.jumpHeld=keys.has(jump);
  const oldX=p.x,oldY=p.y,oldSlope=slope(oldX);
  const friction=p.air?1:4;
  const braking=keys.has(brake)?300:0;
  const speedLimit=rocket?640:boost?340:0;
  const thrust=p.v<speedLimit?(boost?150:0)+(rocket?650:0):0;
  // Low glide drag preserves momentum; only the boosters provide powered thrust.
  const acceleration=-friction-braking+(p.air?0:gravity*oldSlope/(1+oldSlope*oldSlope))+thrust;
  p.v=Math.max(35,Math.min(640,p.v+acceleration*dt));
  p.bonus=Math.max(0,p.bonus-dt);
  if(p.diamond!=='diamond')p.board=Math.max(0,p.board-dt*(p.air?.3:boost?2:1.25));
  if((boost||rocket)&&p.diamond!=='diamond')p.fuel=Math.max(0,p.fuel-dt*((boost?23:0)+(rocket?38:0)));
  if(p.board>0&&!p.air){
   // Contact is lost when following a convex crest would require a downward pull.
   if(jumpPressed||curvature(oldX)*p.v*p.v>gravity){
    p.air=true;p.vy=jumpPressed?Math.min(oldSlope*p.v-330,-240):oldSlope*p.v;p.spin=0;p.airLoops=0;tone(600);
   }
  }
  p.x=Math.min(finish,p.x+p.v*dt);
  if(p.board<=0){p.air=true;p.vy+=(gravity-(boost?650:0))*dt;p.y+=p.vy*dt;if(p.y>=wave(p.x)-5){p.y=wave(p.x)-15;p.alive=false;tone(80)}}
  else if(p.air){
   const ay=gravity-(boost?240:0);p.y+=p.vy*dt+.5*ay*dt*dt;p.vy+=ay*dt;
   const rotation=(keys.has(forward)?1:0)-(keys.has(backward)?1:0);p.angle+=rotation*dt*5.8;p.spin+=rotation*dt*5.8;
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
 updateGiants(dt);
 updateHazards(dt);
 const nearby=players.map(cannonTarget).find(Boolean);if(nearby&&running&&!paused)document.querySelector('#state').textContent="⚠ RIESENWELLE · 0 / C KANONE · "+nearby.shots+"/8 SCHÜSSE";
 if(players.every(p=>!p.alive||p.done)){
  running=false;ui.style.display='block';const winners=players.filter(p=>p.done);
  ui.innerHTML=`<p>RUN BEENDET</p><h2>${winners.length?'INSEL ERREICHT!':'NOCH EIN VERSUCH?'}</h2><span>${players.some(p=>!p.alive)?'Beliebige Taste: neu aufbauen. Brett oben auswählen.':'R für einen neuen Run.'}</span>`;
  document.querySelector('#state').textContent=winners.length?'ZIEL ERREICHT':'TASTE DRÜCKEN · NEU AUFBAUEN';
 }
}
function poly(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill()}
function draw(){const w=canvas.clientWidth,h=canvas.clientHeight;fitCamera();ctx.save();ctx.scale(1,h/370);const sky=ctx.createLinearGradient(0,0,0,370);sky.addColorStop(0,'#231922');sky.addColorStop(.7,'#78372c');sky.addColorStop(1,'#ed6b2a');ctx.fillStyle=sky;ctx.fillRect(0,0,w,370);ctx.fillStyle='#fa9c58';ctx.beginPath();ctx.arc(w*.76-camera*.018,108,44,0,Math.PI*2);ctx.fill();for(let i=-1;i<9;i++){let x=i*230-(camera*.13%230);poly([[x,265],[x+70,115+(i%3)*28],[x+100,146],[x+125,127],[x+230,270]],'#39262b');poly([[x+70,115+(i%3)*28],[x+100,146],[x+125,127],[x+108,185]],'#97422c')}ctx.save();ctx.scale(zoom,zoom);ctx.translate(-camera,-cameraY);const bottom=cameraY+370/zoom;for(let layer=0;layer<3;layer++){ctx.beginPath();ctx.moveTo(camera,bottom);for(let x=camera;x<=camera+w/zoom+5;x+=5/zoom)ctx.lineTo(x,wave(x)+layer*16);ctx.lineTo(camera+w/zoom,bottom);ctx.fillStyle=['#ffbd45','#ff6b24','#d73b1c'][layer];ctx.fill();ctx.strokeStyle=['#ffe491','#ffb447','#f9862d'][layer];ctx.lineWidth=3;ctx.stroke()}for(let i=0;i<45;i++){const x=camera+(i*97-camera*.5+w*10)%w/zoom,y=370-((time*22+i*39)%250);ctx.fillStyle=i%2?'#ffad4a':'#d96c3a';ctx.fillRect(x,y,2,3)}const goal=finish;if(goal<camera+w/zoom+150){poly([[goal-20,300],[goal+15,210],[goal+170,200],[goal+230,370],[goal-20,370]],'#40352b');ctx.fillStyle='#ffe8bc';ctx.fillRect(goal+30,140,3,100);poly([[goal+33,140],[goal+85,155],[goal+33,173]],'#64e0d7')}
drawGiants();drawHazards();
const shown=players.length?players:[{x:w*.67,y:244,angle:-.25,board:85,color:'#fff0cb',alive:true,fuel:100}];for(const p of shown){ctx.save();ctx.translate(p.x,p.y);if(!p.alive){ctx.fillStyle=p.color;ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('TASTE → NEUAUFBAU',0,-65);ctx.globalAlpha=.45;}if(p.shield>0){ctx.strokeStyle="#fff5bd";ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-25,48,0,Math.PI*2);ctx.stroke()}ctx.scale(1.5,1.5);ctx.rotate(p.board? p.angle:0);ctx.shadowColor="#171310";ctx.shadowBlur=4;if(p.board){ctx.fillStyle=p.diamond==='diamond'?'#a9ffff':'#ffdd83';ctx.beginPath();ctx.ellipse(0,8,29,Math.max(2,p.board/16),0,0,7);ctx.fill();ctx.strokeStyle='#5c2f25';ctx.lineWidth=2;ctx.stroke();if(p.diamond==='diamond'){for(let k=-2;k<=2;k++)poly([[k*10-5,8],[k*10,3],[k*10+5,8],[k*10,13]],'#36aebd')}}ctx.fillStyle='#777b7a';ctx.fillRect(-19,8,10,8);ctx.fillRect(9,8,10,8);if(activeDrive(p,'rocket')){ctx.fillStyle='#73898d';ctx.fillRect(-35,-4,19,13);poly([[-35,-2],[-78-Math.sin(time*40)*12,3],[-35,8]],'#ff943d');poly([[-35,0],[-60,3],[-35,5]],'#fff2aa')}if(activeDrive(p,'turbo')||!running&&!players.length){poly([[-18,16],[-13,38+Math.sin(time*30)*8],[-9,16]],'#63e6df');poly([[9,16],[14,38+Math.cos(time*30)*8],[19,16]],'#63e6df')}if(attacking(p)){if(p.diamond==='diamond'){poly([[15,-16],[62,0],[15,16]],'#9cffff');ctx.strokeStyle='#2391a5';ctx.lineWidth=2;for(let k=0;k<4;k++){ctx.beginPath();ctx.moveTo(20+k*9,-12+k*3);ctx.lineTo(24+k*9,10-k*2);ctx.stroke()}}else{ctx.fillStyle='#ffe2b7';ctx.fillRect(18,-40,18,15);ctx.fillRect(-36,-33,18,15)}ctx.strokeStyle=p.diamond==='diamond'?'#89ffff':'#ffe2b7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-16,p.diamond==='diamond'?65:50,0,Math.PI*2);ctx.stroke()}ctx.strokeStyle=p.color;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-11,2);ctx.lineTo(-4,-12);ctx.lineTo(8,-4);ctx.lineTo(17,3);ctx.moveTo(-4,-12);ctx.lineTo(0,-29);ctx.lineTo(12,-20);ctx.lineTo(22,-24);ctx.moveTo(0,-28);ctx.lineTo(-13,-20);ctx.lineTo(-21,-22);ctx.stroke();ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(1,-39,7,0,7);ctx.fill();ctx.fillStyle='#322526';ctx.fillRect(0,-42,9,3);ctx.restore()}ctx.restore();ctx.restore();document.querySelector('#hud').innerHTML=players.map((p,i)=>`<div class="playerhud" style="color:${p.color}">P${i+1} · ${p.done?'IM ZIEL':!p.alive?'TASTE: NEUAUFBAU':p.diamond==='diamond'?'DIAMANT ∞':p.board?'BRETT '+Math.ceil(p.board)+'%':'DÜSENFLUG'} <div class="bar"><i style="width:${p.board}%"></i></div>TEMPO ${Math.round(p.v)} · ${p.tricks} LOOPS · ${p.smashes} TREFFER<br>TURBO ${p.diamond==='diamond'?'∞':Math.ceil(p.fuel)+' / 150'} ${activeDrive(p,'rocket')?'· HECKANTRIEB':''} ${p.bonus>0?"· TRICK-BONUS!":""}<div class="bar"><i style="width:${p.diamond==='diamond'?100:p.fuel/150*100}%;background:#64e0d7"></i></div></div>`).join('');document.querySelector('#finish').textContent="FINISH · "+finish.toLocaleString("de-DE")+" m";document.querySelector('#distance').textContent=`${Math.min(finish,Math.floor(Math.max(0,...players.map(p=>p.x))))} / ${finish.toLocaleString('de-DE')} m`}
function frame(now){const dt=Math.min(.035,(now-last)/1000||0);last=now;if(running&&!paused)update(dt);else if(!players.length)time+=dt;draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);
