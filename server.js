import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const app=express(),http=createServer(app),io=new Server(http);
const root=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(root,'public')));
app.get('/health',(_,res)=>res.json({ok:true,game:'Rush Rivals v3'}));
const rooms=new Map();
const modes=['match','runner'];
const cfg={easy:{rounds:4,seconds:45,target:650},normal:{rounds:4,seconds:40,target:900},hard:{rounds:6,seconds:35,target:1250}};
const words=['Spark','Nova','Pixel','Comet','Turbo','Glow'];
const uid=(n=12)=>randomBytes(n).toString('hex');
const safeName=s=>String(s||'Player').replace(/[<>]/g,'').trim().slice(0,18)||'Player';
function players(r){return Object.entries(r.players).map(([id,p])=>({id,name:p.name,score:p.score,online:!!p.socketId,combo:p.combo,boosts:p.boosts,ready:p.ready})).sort((a,b)=>b.score-a.score)}
function state(r){return {code:r.code,host:r.host,phase:r.phase,difficulty:r.difficulty,round:r.round,totalRounds:r.totalRounds,mode:r.mode,time:r.time,city:r.city,goal:r.goal,players:players(r),events:r.events.slice(-5),result:r.result,roundSeed:r.roundSeed}}
function broadcast(r){io.to(r.code).emit('state',state(r))}
function event(r,s){r.events.push(s);if(r.events.length>25)r.events.shift()}
function stop(r){if(r.timer){clearInterval(r.timer);r.timer=null}}
function finish(r){stop(r);r.phase='finished';const rank=players(r),top=rank[0]?.score??0;r.result={ranking:rank,winners:rank.filter(p=>p.score===top),success:r.city>=60};event(r,r.result.success?'City saved! Brilliant teamwork!':'Mission complete! Try for a brighter city!');broadcast(r)}
function nextRound(r){stop(r);r.round++;if(r.round>r.totalRounds)return finish(r);r.mode=modes[(r.round-1)%2];r.roundSeed=Math.floor(Math.random()*2147483647);r.time=cfg[r.difficulty].seconds;r.phase='playing';for(const p of Object.values(r.players)){p.combo=0;p.actions=0;p.lastAction=0;p.ready=false;p.boosts=Math.min(3,p.boosts+1)}event(r,`Round ${r.round}: ${r.mode==='match'?'MATCH THE COLORS':'DODGE & COLLECT'}!`);broadcast(r);r.timer=setInterval(()=>{if(r.phase!=='playing')return;r.time=Math.max(0,r.time-1);if(r.time===0){r.city=Math.max(0,r.city-6);if(r.round>=r.totalRounds)finish(r);else nextRound(r)}else broadcast(r)},1000)}
function cleanup(r){clearTimeout(r.cleanup);r.cleanup=setTimeout(()=>{if(Object.values(r.players).every(p=>!p.socketId)){stop(r);rooms.delete(r.code)}},15*60*1000);r.cleanup.unref?.()}
function action(r,p,kind,payload){if(r.phase!=='playing'||!p.socketId)return;const now=Date.now();if(now-p.lastAction<120)return;p.lastAction=now;const mode=r.mode;if(kind==='match'&&mode==='match'){
  const count=Number(payload?.count);if(!Number.isInteger(count)||count<3||count>7)return;
  const bonus=count>=5?2:count===4?1:0;p.combo=Math.min(12,p.combo+1);const gained=(count*12+bonus*25)*Math.min(3,1+Math.floor(p.combo/4)*.5);p.score+=Math.round(gained);r.city=Math.min(100,r.city+Math.min(3,count-1));p.actions++;if(count>=5)event(r,`${p.name} unleashed a COLOR BLAST!`);
}else if(kind==='runner'&&mode==='runner'){
  if(payload?.item!=='orb'&&payload?.item!=='star')return;
  if(p.actions>120)return;p.actions++;p.combo=Math.min(12,p.combo+1);p.score+=payload.item==='star'?80:20;r.city=Math.min(100,r.city+(payload.item==='star'?2:1));
}else if(kind==='hit'&&mode==='runner'){
  if(now-(p.lastHit||0)<700)return;p.lastHit=now;p.combo=0;r.city=Math.max(0,r.city-2);event(r,`${p.name} bumped into a barrier!`);
}else if(kind==='boost'){
  if(p.boosts<1)return;p.boosts--;p.score+=100;r.city=Math.min(100,r.city+5);event(r,`${p.name} used a SUPER CHARGE!`);
}else return;
  broadcast(r);
}
io.on('connection',socket=>{
 socket.on('join',(data={},ack=()=>{})=>{
  if(socket.data.code)return ack({error:'Already joined. Refresh to reconnect.'});let code=String(data.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);let r=code?rooms.get(code):null;if(code&&!r)return ack({error:'Room not found. Check the room code.'});
  if(!r){do{code=uid(3).toUpperCase()}while(rooms.has(code));r={code,host:null,players:{},phase:'lobby',difficulty:'normal',round:0,totalRounds:4,mode:'match',time:0,city:25,goal:80,events:['Welcome! Invite friends to join.'],result:null,roundSeed:0,timer:null,cleanup:null};rooms.set(code,r)}
  const token=typeof data.token==='string'?data.token:'';let id=Object.keys(r.players).find(k=>token&&r.players[k].token===token);
  if(!id){if(r.phase!=='lobby')return ack({error:'Game underway. Only returning players can rejoin.'});if(Object.keys(r.players).length>=4)return ack({error:'Room full (4 players).'});id=uid();const newToken=uid(24);r.players[id]={name:safeName(data.name),token:newToken,score:0,combo:0,boosts:1,ready:false,actions:0,lastAction:0,socketId:null};if(!r.host)r.host=id}
  const p=r.players[id];if(p.socketId&&p.socketId!==socket.id){const old=io.sockets.sockets.get(p.socketId);if(old){old.data.code=null;old.data.id=null;old.leave(code);old.emit('session-replaced')}}
  p.socketId=socket.id;socket.data.code=code;socket.data.id=id;socket.join(code);clearTimeout(r.cleanup);r.cleanup=null;ack({code,id,token:p.token,name:p.name});event(r,`${p.name} joined the party!`);broadcast(r);
 });
 socket.on('difficulty',value=>{const r=rooms.get(socket.data.code);if(r&&r.phase==='lobby'&&r.host===socket.data.id&&cfg[value]){r.difficulty=value;broadcast(r)}});
 socket.on('start',()=>{const r=rooms.get(socket.data.code);if(!r||r.host!==socket.data.id||r.phase!=='lobby')return;r.totalRounds=cfg[r.difficulty].rounds;r.round=0;r.city=25;r.result=null;for(const p of Object.values(r.players)){p.score=0;p.boosts=1;p.combo=0}nextRound(r)});
 socket.on('action',(kind,payload)=>{const r=rooms.get(socket.data.code),p=r?.players[socket.data.id];if(!r||!p||p.socketId!==socket.id)return;action(r,p,kind,payload)});
 socket.on('rematch',()=>{const r=rooms.get(socket.data.code);if(!r||r.host!==socket.data.id||r.phase!=='finished')return;stop(r);r.phase='lobby';r.round=0;r.city=25;r.result=null;event(r,'Rematch ready!');broadcast(r)});
 socket.on('disconnect',()=>{const r=rooms.get(socket.data.code),p=r?.players[socket.data.id];if(!r||!p||p.socketId!==socket.id)return;p.socketId=null;event(r,`${p.name} disconnected`);if(Object.values(r.players).every(x=>!x.socketId))cleanup(r);broadcast(r)});
});
const port=Number(process.env.PORT)||3000;http.listen(port,'0.0.0.0',()=>console.log('Rush Rivals v3 running on port '+port));
