(function(){
const A=window.KIPApp,$=s=>document.querySelector(s),cfg=window.KIP700||{};
let unlocked=false,expRows=null,stockRows=null;
const kpi=(l,v)=>'<div class="kpi"><span>'+A.esc(l)+'</span><b>'+v+'</b></div>';
const tbl=(h,r)=>'<table><tr>'+h.map(x=>'<th>'+A.esc(x)+'</th>').join('')+'</tr>'+r.map(c=>'<tr>'+c.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</table>';
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const norm=k=>String(k).trim().toUpperCase();

// ---- licence ----
async function valid(k){
  if(!window.crypto||!crypto.subtle)throw new Error('nocrypto');
  return (cfg.licenseHashes||[]).indexOf(await sha(norm(k)))>-1;
}
function setUnlocked(on){unlocked=on;$('#lock').hidden=on;$('#pro').hidden=!on;if(on)refresh()}
async function tryUnlock(){
  const k=$('#key').value,m=$('#keyMsg');
  if(!k.trim()){m.textContent='Enter your licence key.';m.className='msg err';return}
  try{
    if(await valid(k)){try{localStorage.setItem('kip700_key',norm(k))}catch(e){}m.textContent='';setUnlocked(true)}
    else{m.textContent='That key is not valid. Check for typos, or contact us for a new one.';m.className='msg err'}
  }catch(e){m.textContent='Keys can only be checked on a secure (https) page. Open the live site and try again.';m.className='msg err'}
}
async function restore(){
  let k=null;try{k=localStorage.getItem('kip700_key')}catch(e){}
  if(k){try{if(await valid(k))setUnlocked(true)}catch(e){}}
}

// ---- helpers ----
function pickMap(box,table,fields,map,onChange){
  box.innerHTML='';
  fields.forEach(f=>{
    const l=document.createElement('label'),s=document.createElement('select');
    l.appendChild(document.createTextNode(f.l));s.appendChild(new Option('Not in my file',''));
    table.heads.forEach((h,i)=>s.appendChild(new Option(h,i)));
    s.value=map[f.k]!==undefined?map[f.k]:'';
    s.addEventListener('change',()=>{s.value===''?delete map[f.k]:map[f.k]=+s.value;onChange()});
    l.appendChild(s);box.appendChild(l);
  });
}
const EXP=[{k:'date',l:'Date',syn:['date','paid','day']},{k:'cat',l:'Category',syn:['category','type','expense','description','item']},{k:'amt',l:'Amount',syn:['amount','total','cost','value','paid']}];
const STK=[{k:'name',l:'Product',syn:['product','item','sku','name','description']},{k:'qty',l:'Stock on hand',syn:['stock','on hand','quantity','qty','available','inventory','balance']}];
let expT=null,expM={},stkT=null,stkM={};

function loadExp(t){
  if(!t){$('#expOut').innerHTML='<p class="note low">That file has no table in it.</p>';return}
  expT=t;expM=A.detect(t.heads,EXP);pickMap($('#expMap'),t,EXP,expM,buildExp);buildExp();
}
function buildExp(){
  const df=$('#dfirst').value=='1';expRows=[];
  if(expT&&expM.date!==undefined&&expM.amt!==undefined)expT.rows.forEach(r=>{
    const d=A.date(r[expM.date],df),a=A.num(r[expM.amt]);
    if(d&&!isNaN(a))expRows.push({d,a,c:expM.cat!==undefined?String(r[expM.cat]).trim():''});
  });
  refresh();
}
function loadStock(t){
  if(!t){$('#stockOut').innerHTML='<p class="note low">That file has no table in it.</p>';return}
  stkT=t;stkM=A.detect(t.heads,STK);pickMap($('#stockMap'),t,STK,stkM,buildStock);buildStock();
}
function buildStock(){
  stockRows=[];
  if(stkT&&stkM.name!==undefined&&stkM.qty!==undefined)stkT.rows.forEach(r=>{
    const n=String(r[stkM.name]).trim(),q=A.num(r[stkM.qty]);if(n&&!isNaN(q))stockRows.push({n,q});
  });
  refresh();
}

// ---- reports ----
function refresh(){
  const S=A.state;if(!unlocked||!S)return;
  const rows=S.rows,cur=S.cur,L=[],mo={};
  rows.forEach(r=>{const k=r.d.getUTCFullYear()*100+r.d.getUTCMonth();mo[k]=(mo[k]||0)+r.sales});
  const best=Object.keys(mo).sort((a,b)=>mo[b]-mo[a])[0],P=A.group(rows,'product'),C=A.group(rows,'category');
  L.push('Sales were '+cur+' '+A.fmt(S.sales)+' from '+rows.length+' orders.');
  if(best)L.push('Best month: '+A.MON[best%100]+' '+Math.floor(best/100)+' ('+cur+' '+A.fmt(mo[best])+').');
  if(P[0])L.push('Top product: '+A.esc(P[0].name)+' ('+cur+' '+A.fmt(P[0].sales)+').');
  if(C[0])L.push('Top category: '+A.esc(C[0].name)+', '+Math.round(C[0].sales/S.sales*100)+'% of sales.');
  if(S.hasCost)L.push('Gross profit was '+cur+' '+A.fmt(S.gp)+'.');

  // expenses
  const inR=(expRows||[]).filter(e=>A.iso(e.d)>=S.from&&A.iso(e.d)<=S.to),tot=inR.reduce((s,e)=>s+e.a,0);
  let h='';
  if(expRows&&expRows.length){
    const net=S.gp-tot,cats={};inR.forEach(e=>{const k=e.c||'Other';cats[k]=(cats[k]||0)+e.a});
    h=kpi('Expenses ('+cur+')',A.fmt(tot));
    if(S.hasCost){h+=kpi('Net profit ('+cur+')',A.fmt(net))+kpi('Net margin',S.sales?(net/S.sales*100).toFixed(1)+'%':'0%');L.push('After expenses of '+cur+' '+A.fmt(tot)+', net profit was '+cur+' '+A.fmt(net)+'.')}
    h='<div class="kpigrid">'+h+'</div>'+(S.hasCost?'':'<p class="note">Add a cost column to your sales file to see net profit.</p>');
    const cl=Object.keys(cats).map(k=>[k,cats[k]]).sort((a,b)=>b[1]-a[1]);
    if(cl.length)h+=tbl(['Expense',cur],cl.map(x=>[A.esc(x[0]),A.fmt(x[1])]));
  }else h='<p class="note">Upload your expenses to see net profit.</p>';
  $('#expOut').innerHTML=h;

  // customers
  const by={};rows.forEach(r=>{if(!r.customer)return;const o=by[r.customer]||(by[r.customer]={n:r.customer,c:0,s:0,l:r.d});o.c++;o.s+=r.sales;if(r.d>o.l)o.l=r.d});
  const cl=Object.keys(by).map(k=>by[k]).sort((a,b)=>b.s-a.s);
  if(cl.length){
    const rep=cl.filter(o=>o.c>1).length,rate=Math.round(rep/cl.length*100);
    L.push(cl.length+' customers bought, and '+rate+'% came back for more than one order.');
    $('#custOut').innerHTML='<div class="kpigrid">'+kpi('Customers',A.fmt(cl.length))+kpi('Repeat customers',A.fmt(rep))+kpi('Repeat rate',rate+'%')+kpi('Avg spend ('+cur+')',A.fmt(S.sales/cl.length))+'</div>'+
      tbl(['Top customers','Orders','Spent ('+cur+')','Last order'],cl.slice(0,10).map(o=>[A.esc(o.n),o.c,A.fmt(o.s),A.iso(o.l)]));
  }else $('#custOut').innerHTML='<p class="note">Match a customer column in your sales file to see customer insights.</p>';

  // stock
  if(stockRows&&stockRows.length){
    const days=Math.max(1,(new Date(S.to)-new Date(S.from))/864e5+1),thr=+$('#thr').value||14,sold={};
    rows.forEach(r=>{const k=r.product.toLowerCase();sold[k]=(sold[k]||0)+r.q});
    const sr=stockRows.map(s=>{const v=(sold[s.n.toLowerCase()]||0)/days;return {n:s.n,q:s.q,sold:sold[s.n.toLowerCase()]||0,left:v>0?s.q/v:Infinity}}).sort((a,b)=>a.left-b.left);
    const low=sr.filter(x=>x.left<thr);
    if(low.length)L.push('Reorder soon: '+low.slice(0,5).map(x=>A.esc(x.n)).join(', ')+'.');
    $('#stockOut').innerHTML='<p class="note">'+low.length+' product'+(low.length==1?'':'s')+' will run out within '+thr+' days at the current sales pace.</p>'+
      tbl(['Product','In stock','Sold in period','Days left'],sr.map(x=>[A.esc(x.n),A.fmt(x.q),A.fmt(x.sold),x.left===Infinity?'No sales':(x.left<thr?'<span class="low">'+Math.floor(x.left)+' (reorder)</span>':Math.floor(x.left))]));
  }else $('#stockOut').innerHTML='<p class="note">Upload your stock levels to get low-stock alerts.</p>';

  $('#summary').innerHTML='<h2>Summary</h2><ul class="sumlist">'+L.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
  $('#printHead').innerHTML='<h1>'+A.esc(S.biz||'Business')+' report</h1><p>'+S.from+' to '+S.to+'</p>';
}

// ---- samples ----
function sampleExp(){
  const g=[['Date paid','Expense','Amount']];
  for(let m=0;m<12;m++){const y=m<2?2025:2026,mm=((m+10)%12)+1,yy=mm>=11?2025:2026,p=('0'+mm).slice(-2);
    g.push(['01/'+p+'/'+yy,'Rent',15000],['05/'+p+'/'+yy,'Marketing',3000+m*150],['10/'+p+'/'+yy,'Utilities',3200+(m%4)*200],['15/'+p+'/'+yy,'Salaries',12000]);}
  loadExp(A.toTableSample(g));
}
function sampleStock(){
  const g=[['Item','On hand']],d={'Graphic Tee':40,'Hoodie':1,'Sneakers':9,'Sandals':60,'Cap':80,'Tote Bag':14,'Scented Candle':25,'Body Lotion':2,'Coffee Beans':120};
  Object.keys(d).forEach(k=>g.push([k,d[k]]));loadStock(A.toTableSample(g));
}
const toT=g=>({heads:g[0].map(String),rows:g.slice(1)});A.toTableSample=toT;

$('#unlock').addEventListener('click',tryUnlock);
$('#key').addEventListener('keydown',e=>{if(e.key==='Enter')tryUnlock()});
$('#removeKey').addEventListener('click',()=>{try{localStorage.removeItem('kip700_key')}catch(e){}setUnlocked(false)});
$('#printBtn').addEventListener('click',()=>window.print());
$('#expFile').addEventListener('change',e=>e.target.files[0]&&A.readTable(e.target.files[0],loadExp,m=>{$('#expOut').innerHTML='<p class="note low">'+m+'</p>'}));
$('#stockFile').addEventListener('change',e=>e.target.files[0]&&A.readTable(e.target.files[0],loadStock,m=>{$('#stockOut').innerHTML='<p class="note low">'+m+'</p>'}));
$('#expSample').addEventListener('click',sampleExp);$('#stockSample').addEventListener('click',sampleStock);
$('#thr').addEventListener('input',refresh);$('#dfirst').addEventListener('change',()=>{if(expT)buildExp()});
document.addEventListener('kip:render',refresh);
restore();
})();
