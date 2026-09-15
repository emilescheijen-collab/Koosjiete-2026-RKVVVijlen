const grid=document.getElementById('plotGrid');
const count=document.getElementById('count');
const total=document.getElementById('total');
const btn=document.getElementById('continueBtn');
const modal=document.getElementById('modal');
const selected=new Set();

// Demo: later vervangen we dit door actuele status uit Supabase.
const sold=new Set(['A1','A2','B4','C7','F12','J10','M18','T20']);

function label(row,col){return String.fromCharCode(65+row)+(col+1)}
for(let r=0;r<20;r++){
  for(let c=0;c<20;c++){
    const id=label(r,c);
    const el=document.createElement('button');
    el.className='plot';
    el.textContent=id;
    el.title=`Kavel ${id}`;
    if(sold.has(id)){el.classList.add('is-sold');el.disabled=true}
    el.addEventListener('click',()=>{
      if(selected.has(id)){selected.delete(id);el.classList.remove('is-selected')}
      else{selected.add(id);el.classList.add('is-selected')}
      update();
    });
    grid.appendChild(el);
  }
}
function update(){
  const n=selected.size;
  count.textContent=`${n} ${n===1?'kavel':'kavels'}`;
  total.textContent=new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n*5);
  btn.disabled=n===0;
}
btn.addEventListener('click',()=>{
  const list=[...selected].sort();
  document.getElementById('selectionText').textContent='Gekozen kavels: '+list.join(', ');
  document.getElementById('modalTotal').textContent=`Totaal: €${(list.length*5).toFixed(2).replace('.',',')}`;
  modal.hidden=false;
});
document.getElementById('closeModal').onclick=()=>modal.hidden=true;
modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true});
