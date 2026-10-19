(function(){
var $=function(s){return document.querySelector(s)};
var FIELDS=[
 {k:'date',l:'Date',syn:['date','sale date','order date','transaction date','day','time']},
 {k:'product',l:'Product or item',syn:['product','item','sku','description','name','product name']},
 {k:'category',l:'Category',syn:['category','group','type','department']},
 {k:'customer',l:'Customer',syn:['customer','client','buyer','customer name']},
 {k:'qty',l:'Quantity',syn:['qty','quantity','units','count','pcs']},
 {k:'price',l:'Unit price',syn:['unit price','selling price','price','rate']},
 {k:'sales',l:'Sales amount (line total)',syn:['total','line total','amount','sales','revenue','subtotal','value']},
 {k:'ucost',l:'Unit cost',syn:['unit cost','buying price','cost price','cost per unit']},
 {k:'cost',l:'Total cost',syn:['cost','total cost','cogs']}];
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var table=null, map={};window.KIPApp={};

function msg(t,err){var m=$('#msg');m.textContent=t||'';m.className='msg'+(err?' err':'');}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fmt(n){return Math.round(n).toLocaleString('en-US')}

function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');
  var first=text.split(/\r?\n/,1)[0];
  var d=[',',';','\t'].map(function(c){return [c,first.split(c).length]}).sort(function(a,b){return b[1]-a[1]})[0][0];
  var out=[],row=[],cur='',q=false;
  for(var i=0;i<text.length;i++){var c=text[i];
    if(q){if(c=='"'){if(text[i+1]=='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c=='"')q=true;
    else if(c==d){row.push(cur);cur=''}
    else if(c=='\n'||c=='\r'){if(c=='\r'&&text[i+1]=='\n')i++;row.push(cur);cur='';out.push(row);row=[]}
    else cur+=c;
  }
  if(cur!==''||row.length){row.push(cur);out.push(row)}
  return out;
}
function toTable(grid){
  grid=grid.filter(function(r){return r.some(function(v){return String(v).trim()!==''})});
  var h=0;for(;h<grid.length;h++){if(grid[h].filter(function(v){return String(v).trim()!==''}).length>=2)break}
  if(h>=grid.length||grid.length-h<2)return null;
  var heads=grid[h].map(function(v,i){v=String(v).trim();return v||('Column '+(i+1))});
  return {heads:heads,rows:grid.slice(h+1)};
}
function detect(heads,fields){fields=fields||FIELDS;
  var used={},m={},norm=heads.map(function(h){return h.toLowerCase().replace(/[_\-]+/g,' ').trim()});
  [0,1].forEach(function(pass){fields.forEach(function(f){
    if(m[f.k]!==undefined)return;
    for(var s=0;s<f.syn.length;s++)for(var i=0;i<norm.length;i++){
      if(used[i])continue;
      if(pass==0?norm[i]==f.syn[s]:norm[i].indexOf(f.syn[s])>-1){m[f.k]=i;used[i]=1;return}
    }
  })});
  return m;
}
function num(v){
  if(typeof v=='number')return v;
  var s=String(v).trim();if(!s)return NaN;
  var neg=/^\(.*\)$/.test(s)||s.charAt(0)=='-';
  s=s.replace(/[^0-9.,]/g,'');
  if(/,\d{1,2}$/.test(s)&&s.indexOf('.')<0)s=s.replace(',','.');else s=s.replace(/,/g,'');
  var n=parseFloat(s);return isNaN(n)?NaN:(neg?-n:n);
}
function date(v,dayFirst){
  if(v instanceof Date)return isNaN(v)?null:new Date(Date.UTC(v.getFullYear(),v.getMonth(),v.getDate()));
  if(typeof v=='number'&&v>20000&&v<80000)return new Date(Math.round((v-25569)*864e5));
  var s=String(v).trim(),m;
  if(m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))return new Date(Date.UTC(+m[1],m[2]-1,+m[3]));
  if(m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/)){
    var a=+m[1],b=+m[2],y=+m[3];if(y<100)y+=2000;
    var dd=dayFirst?a:b,mm=dayFirst?b:a;
    if(mm>12){var t=dd;dd=mm;mm=t}
    if(mm<1||mm>12||dd<1||dd>31)return null;
    return new Date(Date.UTC(y,mm-1,dd));
  }
  var p=Date.parse(s);if(isNaN(p))return null;var x=new Date(p);
  return new Date(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()));
}
function iso(d){return d.toISOString().slice(0,10)}

function build(){
  var dayFirst=$('#dfirst').value=='1',rows=[],skipped=0;
  table.rows.forEach(function(r){
    var d=date(r[map.date],dayFirst);if(!d){skipped++;return}
    var q=map.qty!==undefined?num(r[map.qty]):1;if(isNaN(q))q=1;
    var sales=map.sales!==undefined?num(r[map.sales]):(map.price!==undefined?num(r[map.price])*q:NaN);
    if(isNaN(sales)){skipped++;return}
    var cost=null;
    if(map.cost!==undefined){var c=num(r[map.cost]);if(!isNaN(c))cost=c}
    else if(map.ucost!==undefined){var u=num(r[map.ucost]);if(!isNaN(u))cost=u*q}
    var g=function(k){return map[k]!==undefined?String(r[map[k]]).trim():''};
    rows.push({d:d,q:q,sales:sales,cost:cost,product:g('product'),category:g('category'),customer:g('customer')});
  });
  return {rows:rows,skipped:skipped};
}
function sum(a,k){return a.reduce(function(s,x){return s+(x[k]||0)},0)}
function group(rows,key){
  var m={};rows.forEach(function(r){var k=r[key];if(!k)return;
    var o=m[k]||(m[k]={name:k,sales:0,profit:0,n:0});o.sales+=r.sales;o.n++;if(r.cost!==null)o.profit+=r.sales-r.cost});
  return Object.keys(m).map(function(k){return m[k]}).sort(function(a,b){return b.sales-a.sales});
}
function tableHTML(title,list,hasCost,cur,max){
  if(!list.length)return '';
  var h='<div><h2>'+title+'</h2><table><tr><th>Name</th><th>Sales ('+esc(cur)+')</th>'+(hasCost?'<th>Profit</th>':'<th>Orders</th>')+'</tr>';
  list.slice(0,max).forEach(function(o){h+='<tr><td>'+esc(o.name)+'</td><td>'+fmt(o.sales)+'</td><td>'+(hasCost?fmt(o.profit):o.n)+'</td></tr>'});
  return h+'</table></div>';
}
function chart(rows,hasCost){
  var m={};rows.forEach(function(r){var k=r.d.getUTCFullYear()*100+r.d.getUTCMonth();
    var o=m[k]||(m[k]={k:k,s:0,p:0});o.s+=r.sales;if(r.cost!==null)o.p+=r.sales-r.cost});
  var ks=Object.keys(m).map(Number).sort(function(a,b){return a-b}),list=ks.map(function(k){return m[k]});
  if(!list.length)return '';
  var W=640,H=230,L=8,B=28,T=14,max=Math.max.apply(null,list.map(function(o){return Math.max(o.s,o.p)}))||1;
  var bw=(W-L)/list.length,svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Monthly sales bar chart">';
  list.forEach(function(o,i){
    var x=L+i*bw,h1=(H-B-T)*o.s/max,w=bw*(hasCost?.36:.64),y=H-B-h1;
    svg+='<rect x="'+(x+bw*.1)+'" y="'+y+'" width="'+w+'" height="'+Math.max(h1,0)+'" fill="#E8E8E3" rx="2"><title>'+MON[o.k%100]+' sales '+fmt(o.s)+'</title></rect>';
    if(hasCost){var h2=Math.max((H-B-T)*o.p/max,0);svg+='<rect x="'+(x+bw*.1+w+2)+'" y="'+(H-B-h2)+'" width="'+w+'" height="'+h2+'" fill="#2DD4BF" rx="2"><title>'+MON[o.k%100]+' gross profit '+fmt(o.p)+'</title></rect>'}
    svg+='<text x="'+(x+bw/2)+'" y="'+(H-10)+'" text-anchor="middle">'+MON[o.k%100]+' '+String(Math.floor(o.k/100)).slice(2)+'</text>';
  });
  svg+='<text x="'+L+'" y="10">'+fmt(max)+'</text></svg>';
  return svg+'<div class="legend"><i style="background:#E8E8E3"></i>Sales'+(hasCost?'<i style="background:#2DD4BF"></i>Gross profit':'')+'</div>';
}
function render(keepDates){
  if(map.date===undefined||(map.sales===undefined&&map.price===undefined)){
    $('#out').hidden=true;msg('Choose which column holds the date, and which holds either the sales amount or the unit price.',true);return}
  var b=build(),all=b.rows;
  if(!all.length){$('#out').hidden=true;msg('No usable rows found. Check the date column and the date format below.',true);return}
  var ds=all.map(function(r){return r.d.getTime()}),mn=new Date(Math.min.apply(null,ds)),mx=new Date(Math.max.apply(null,ds));
  if(!keepDates){$('#from').value=iso(mn);$('#to').value=iso(mx)}
  var f=$('#from').value,t=$('#to').value;
  var rows=all.filter(function(r){var s=iso(r.d);return s>=f&&s<=t});
  var cur=$('#cur').value||'',withCost=rows.filter(function(r){return r.cost!==null}),hasCost=withCost.length>0;
  var sales=sum(rows,'sales'),gp=hasCost?sales-sum(withCost,'cost')-0+0:0;
  if(hasCost)gp=sum(withCost,'sales')-sum(withCost,'cost');
  var k=[['Total sales ('+cur+')',fmt(sales)],['Orders',fmt(rows.length)],['Average order ('+cur+')',rows.length?fmt(sales/rows.length):'0']];
  if(hasCost){var sb=sum(withCost,'sales');k.splice(1,0,['Gross profit ('+cur+')',fmt(gp)],['Gross margin',sb?(gp/sb*100).toFixed(1)+'%':'0%'])}
  $('#kpis').innerHTML=k.map(function(x){return '<div class="kpi"><span>'+esc(x[0])+'</span><b>'+x[1]+'</b></div>'}).join('');
  $('#chart').innerHTML=chart(rows,hasCost);
  $('#tables').innerHTML=tableHTML('Top products',group(rows,'product'),hasCost,cur,5)+tableHTML('Categories',group(rows,'category'),hasCost,cur,8)+tableHTML('Top customers',group(rows,'customer'),hasCost,cur,5);
  $('#out').hidden=false;window.KIPApp.state={all:all,rows:rows,hasCost:hasCost,cur:cur,from:f,to:t,sales:sales,gp:gp,biz:(window.KIP700||{}).businessName||''};if(document.dispatchEvent)document.dispatchEvent(new Event('kip:render'));
  msg(all.length+' rows loaded'+(b.skipped?', '+b.skipped+' skipped (missing date or amount).':'.')+(hasCost?'':' No cost column matched, so profit is not shown.'));
}
function mapUI(){
  var g=$('#mapGrid');g.innerHTML='';
  FIELDS.forEach(function(f){
    var l=document.createElement('label'),s=document.createElement('select');
    l.appendChild(document.createTextNode(f.l));
    var o=new Option('Not in my file','');s.appendChild(o);
    table.heads.forEach(function(h,i){s.appendChild(new Option(h,i))});
    s.value=map[f.k]!==undefined?map[f.k]:'';
    s.addEventListener('change',function(){if(s.value==='')delete map[f.k];else map[f.k]=+s.value;render(true)});
    l.appendChild(s);g.appendChild(l);
  });
  $('#mapping').hidden=false;
}
function load(t){
  if(!t){msg('That file has no table in it. Use a file with a header row and at least one row of data.',true);return}
  table=t;map=detect(t.heads);mapUI();render(false);
}
function readTable(file,cb,onErr){
  var xl=/\.xlsx?$/i.test(file.name),fr=new FileReader();
  fr.onerror=function(){onErr('Could not read that file.')};
  if(!xl){fr.onload=function(){cb(toTable(parseCSV(fr.result)))};fr.readAsText(file);return}
  var go=function(){fr.onload=function(){
    try{var wb=XLSX.read(fr.result,{type:'array',cellDates:true}),ws=wb.Sheets[wb.SheetNames[0]];
      cb(toTable(XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''})))}
    catch(e){onErr('Could not open that Excel file. Try saving it as CSV.')}};fr.readAsArrayBuffer(file)};
  if(window.XLSX)return go();
  var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload=go;s.onerror=function(){onErr('Excel support could not load (check your internet). Save the file as CSV and try again.')};
  document.head.appendChild(s);
}
function readFile(file){if(!file)return;msg('Reading '+file.name+'...');readTable(file,load,function(m){msg(m,true)})}
function sample(){
  var seed=7,r=function(){seed=(seed*16807)%2147483647;return seed/2147483647};
  var items=[['Graphic Tee','Apparel',1500,700],['Hoodie','Apparel',3500,1700],['Sneakers','Footwear',4800,2900],['Sandals','Footwear',1800,900],['Cap','Accessories',900,380],['Tote Bag','Accessories',1200,500],['Scented Candle','Home',1400,600],['Body Lotion','Beauty',1100,480],['Coffee Beans','Food',1600,900]];
  var names=['Amina W.','Brian O.','Cynthia M.','David K.','Esther N.','Felix A.','Grace L.','Hassan I.'];
  var g=[['Sale date','Item','Group','Client','Units','Selling price','Line total','Buying price']];
  for(var i=0;i<220;i++){
    var it=items[Math.floor(r()*items.length)],q=1+Math.floor(r()*3),mo=Math.floor(r()*12),day=1+Math.floor(r()*28);
    var y=mo<2?2025:2026,m=((mo+10)%12)+1;if(m>=11)y=2025;else y=2026;
    g.push([('0'+day).slice(-2)+'/'+('0'+m).slice(-2)+'/'+y,it[0],it[1],names[Math.floor(r()*names.length)],q,it[2],q*it[2],it[3]]);
  }
  load(toTable(g));
}
Object.assign(window.KIPApp,{readTable:readTable,num:num,date:date,iso:iso,fmt:fmt,esc:esc,group:group,detect:detect,MON:MON});
$('#file').addEventListener('change',function(e){readFile(e.target.files[0])});
$('#sampleBtn').addEventListener('click',sample);
['from','to','cur'].forEach(function(id){$('#'+id).addEventListener('input',function(){if(table)render(id!='cur'?true:true)})});
$('#dfirst').addEventListener('change',function(){if(table)render(false)});
var dz=$('#drop');
['dragenter','dragover'].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.add('over')})});
['dragleave','drop'].forEach(function(ev){dz.addEventListener(ev,function(e){e.preventDefault();dz.classList.remove('over')})});
dz.addEventListener('drop',function(e){readFile(e.dataTransfer.files[0])});
})();
