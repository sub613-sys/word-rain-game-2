
const express=require("express")
const http=require("http")
const {Server}=require("socket.io")

const app=express()
const server=http.createServer(app)
const io=new Server(server)

app.use(express.static("public"))

let players={}
let words=[]
let active=[]
let running=false
let combo={}

function spawn(){

 if(!running) return

 const w=words[Math.floor(Math.random()*words.length)]

 const speed=Math.random()*2+1

 let points=2
 if(speed>2.5) points=5
 else if(speed>1.7) points=3

 if(Math.random()<0.1) points=10 // golden word

 const obj={
  word:w.word,
  meaning:w.meaning,
  speed,
  points,
  id:Math.random()
 }

 active.push(obj)

 io.emit("spawnWord",obj)

 setTimeout(spawn,1800)
}

function endGame(){

 running=false
 io.emit("gameEnd",players)

}

io.on("connection",(socket)=>{

 socket.on("join",(name)=>{

  players[socket.id]={name,score:0}
  combo[socket.id]=0
  io.emit("players",players)

 })

 socket.on("setWords",(list)=>{

  words=list

 })

 socket.on("startGame",(time)=>{

  running=true
  spawn()
  setTimeout(endGame,time*1000)

 })

 socket.on("answer",(msg)=>{

  const w=active.find(x=>x.meaning===msg.answer)

  if(!w) return

  const p=players[socket.id]

  let score=w.points

  combo[socket.id]+=1

  if(combo[socket.id]>=3){
   score+=2
  }

  p.score+=score

  active=active.filter(x=>x!==w)

  io.emit("wordSolved",{
   player:p.name,
   points:score,
   word:w.word
  })

  io.emit("players",players)

 })

})

server.listen(3000,()=>console.log("Word Rain PRO running"))
