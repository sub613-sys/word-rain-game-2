const express=require("express")
const http=require("http")
const {Server}=require("socket.io")

const app=express()
const server=http.createServer(app)
const io=new Server(server)

app.use(express.static("public"))

let players={}
let words=[]
let activeWords=[]
let running=false

io.on("connection",(socket)=>{

socket.on("join",(name)=>{
players[socket.id]={name,score:0}
io.emit("players",players)
})

socket.on("setWords",(list)=>{
words=list
})

socket.on("startGame",(time)=>{

running=true
spawnLoop()

setTimeout(()=>{
running=false
io.emit("gameEnd",players)
},time*1000)

})

socket.on("answer",(msg)=>{

const w=activeWords.find(x=>x.meaning===msg.answer)

if(!w) return

players[msg.id].score+=w.points

activeWords=activeWords.filter(x=>x!==w)

io.emit("wordSolved",{
player:players[msg.id].name,
points:w.points
})

io.emit("players",players)

})

})

function spawnLoop(){

if(!running) return

const w=words[Math.floor(Math.random()*words.length)]

const speed=Math.random()*3+1

let points=2
if(speed>3) points=6
else if(speed>2) points=4

if(Math.random()<0.08) points=10

const word={
word:w.word,
meaning:w.meaning,
speed,
points
}

activeWords.push(word)

io.emit("spawnWord",word)

setTimeout(spawnLoop,1500)

}

server.listen(3000)
