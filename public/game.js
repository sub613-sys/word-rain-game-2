
const socket=io()

let name=""

const emojis=["🎉","🌸","🐰","💖","🍓","⭐","🎀","✨","👏"]

function join(){

 name=document.getElementById("name").value || "student"
 socket.emit("join",name)

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

   el.remove()
   clearInterval(fall)

  }

 },50)

})

document.getElementById("answer").addEventListener("keydown",(e)=>{

 if(e.key==="Enter"){

  socket.emit("answer",{answer:e.target.value})
  e.target.value=""

 }

})

socket.on("wordSolved",(data)=>{

 const em=emojis[Math.floor(Math.random()*emojis.length)]

 const msg=document.createElement("div")
 msg.className="emoji"
 msg.innerText=em+" "+data.player+" +"+data.points

 document.body.appendChild(msg)

 setTimeout(()=>msg.remove(),2000)

})

socket.on("players",(players)=>{

 const arr=Object.values(players).sort((a,b)=>b.score-a.score)

 document.getElementById("leaderboard").innerHTML=
 "🏆 LIVE RANK<br>"+arr.map((p,i)=>`${i+1}. ${p.name} ${p.score}`).join("<br>")

})

socket.on("gameEnd",(players)=>{

 const arr=Object.values(players).sort((a,b)=>b.score-a.score)

 alert("🏆 FINAL RANK\n"+
 arr.map((p,i)=>`${i+1}. ${p.name} ${p.score}`).join("\n"))

})
