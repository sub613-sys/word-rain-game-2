const socket=io()

let id=null

const emojis=["🎉","🌸","💖","🐰","✨","🍓","⭐"]

function join(){

const name=document.getElementById("name").value

socket.emit("join",name)

id=socket.id

}

socket.on("spawnWord",(w)=>{

const el=document.createElement("div")
el.className="word"

el.innerText=w.word+" ⭐"+w.points

el.style.left=Math.random()*80+"%"
el.style.top="60px"

document.body.appendChild(el)

let pos=60

const fall=setInterval(()=>{

pos+=w.speed*2
el.style.top=pos+"px"

if(pos>window.innerHeight){
clearInterval(fall)
el.remove()
}

},50)

})

document.getElementById("answer").addEventListener("keydown",(e)=>{

if(e.key==="Enter"){

socket.emit("answer",{
answer:e.target.value,
id:id
})

e.target.value=""

}

})

socket.on("wordSolved",(d)=>{

const e=emojis[Math.floor(Math.random()*emojis.length)]

const msg=document.createElement("div")

msg.innerText=e+" "+d.player+" +"+d.points

msg.style.position="fixed"
msg.style.top="50%"
msg.style.left="50%"
msg.style.fontSize="30px"

document.body.appendChild(msg)

setTimeout(()=>msg.remove(),2000)

})

socket.on("players",(players)=>{

const arr=Object.values(players).sort((a,b)=>b.score-a.score)

document.getElementById("leaderboard").innerHTML=
"🏆 LIVE RANK<br>"+arr.map((p,i)=>`${i+1}. ${p.name} ${p.score}`).join("<br>")

})
