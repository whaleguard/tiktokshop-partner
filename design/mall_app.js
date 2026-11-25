/* ===== mall controller ===== */
const L=['ko','en','zh','ja','vi'];
let lang='ko';
try{const s=localStorage.getItem('kj_lang');if(L.includes(s))lang=s;else{const n=(navigator.language||'ko').slice(0,2);if(L.includes(n))lang=n}}catch(e){}
const t=k=>{const a=I18N[k];if(!a)return k;return a[L.indexOf(lang)]||a[1]||a[0]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
const okUrl=u=>/^https:\/\//i.test(String(u||''));
const imgSrc=u=>{u=String(u||'');return okUrl(u)||/^img\/[a-z0-9-]+\.(jpg|png|webp)$/i.test(u)?u:''};
let cur='KRW';try{const c=localStorage.getItem('kj_cur');if(c==='KRW'||c==='JPY')cur=c;else if(lang==='ja')cur='JPY'}catch(e){}
const money=v=>{const n=Number(v)||0;try{return new Intl.NumberFormat(cur==='JPY'?'ja-JP':'ko-KR',{style:'currency',currency:cur,maximumFractionDigits:0}).format(n)}catch(e){return (cur==='JPY'?'¥':'₩')+Math.round(n)}};
const fmtDate=ms=>{try{return new Intl.DateTimeFormat({ko:'ko-KR',en:'en-US',zh:'zh-CN',ja:'ja-JP',vi:'vi-VN'}[lang],{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(ms))}catch(e){return new Date(ms).toISOString().slice(0,16)}};
const toast=m=>{const el=$('#toast');el.textContent=m;el.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>el.classList.remove('on'),2200)};
const copyText=async x=>{try{await navigator.clipboard.writeText(x);toast(t('m_copied'))}catch(e){}};
const textHtml=s=>esc(s||'').replace(/\n/g,'<br>');

const SB_URL='https://eqsswegpkkyiargzggug.supabase.co',SB_KEY='sb_publishable_5uTiEe3t4tbkbHyvWZfaig_0PIAmMJt';
let sb=null;try{if(window.supabase)sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:false}})}catch(e){sb=null}

let rows=[],cfg={},loaded=false,state={cat:'all',q:'',sort:'recommended'},detail={id:null,img:0,qty:1,opts:{},tab:'description'},lastOrder=null,olState={orderNo:'',email:'',result:null,error:''};

/* --- product model --- */
const CATS=['beauty','fashion','food','health','living','kids','tech','hobby','etc'];
const G={beauty:["뷰티","Beauty","美妆","ビューティー","Làm đẹp"],fashion:["패션","Fashion","服饰","ファッション","Thời trang"],food:["식품","Food","食品","食品","Thực phẩm"],health:["건강","Health","健康","健康","Sức khỏe"],living:["리빙","Home","家居","リビング","Nhà cửa"],kids:["키즈","Kids","母婴","キッズ","Mẹ & bé"],tech:["디지털","Tech","数码","デジタル","Điện tử"],hobby:["굿즈","Goods","周边","グッズ","Đồ sưu tầm"],etc:["기타","Other","其他","その他","Khác"]};
const gname=c=>(G[c]||[c])[L.indexOf(lang)]||c;
function parseOptions(s){
 return String(s||'').split('|').map((g,i)=>{const [n,v]=g.split(':');if(!v)return null;const vals=v.split(',').map(x=>x.trim()).filter(Boolean);return vals.length?{id:'o'+i,name:n.trim(),required:true,values:vals.map(x=>({id:x,name:x}))}:null}).filter(Boolean);
}
const soldLabel=n=>{n=+n||0;if(!n)return '';let s;if(lang==='ko'||lang==='ja'||lang==='zh'){s=n>=10000?(Math.round(n/1000)/10)+(lang==='ko'?'만':'万'):n.toLocaleString()}else{s=n>=1000?(Math.round(n/100)/10)+'K':String(n)}return t('m_sold_fmt').replace('{n}',s)};
function toP(r){
 const price=cur==='JPY'?r.price_jpy:r.price_krw,list=cur==='JPY'?r.list_price_jpy:r.list_price_krw;
 const imgs=[r.img_url,...(Array.isArray(r.images)?r.images:[])].map(imgSrc).filter(Boolean);
 const disc=list>price&&price>0?Math.round((1-price/list)*100):0;
 return {id:r.id,name:r.name,brand:r.brand||'',category:r.category||'etc',section:r.section||'',
  image:imgs[0]||'',images:imgs.length?imgs:[''],price:+price||0,originalPrice:+list||0,discount:disc,
  rating:r.rating||null,reviewCount:null,sold:+r.sold||0,soldLabel:soldLabel(r.sold),freeShipping:!!r.free_ship,sample:!!r.sample,live:!!r.live,coupon:false,
  stock:r.stock==null?null:+r.stock,options:parseOptions(r.options),tiktokUrl:okUrl(r.tts_url)?r.tts_url:'',
  description:r.descr||'',safeDescriptionHtml:textHtml(r.detail||r.descr||''),safeShippingHtml:textHtml(cfg.shipNote||t('m_ship_note')),safeReturnHtml:textHtml(cfg.returnNote||t('m_return_note')),
  shippingNote:t('m_shipping_at_checkout'),returnNote:t('m_return_note'),origin:'',deliveryEstimate:'',detailImages:[],sort:+r.sort||0,updated:Date.parse(r.updated_at)||0,
  hasPrice:price!=null&&price!==''};
}
const prods=()=>rows.map(toP).filter(p=>p.hasPrice);
const byId=id=>prods().find(p=>String(p.id)===String(id));
function sortList(a,sort){a=a.slice();if(sort==='bestselling')a.sort((x,y)=>y.sold-x.sold);else if(sort==='price_asc')a.sort((x,y)=>x.price-y.price);else if(sort==='price_desc')a.sort((x,y)=>y.price-x.price);else a.sort((x,y)=>x.sort-y.sort||y.sold-x.sold);return a}

/* --- cart --- */
const CK='kj_cart';
const loadCart=()=>{try{const a=JSON.parse(localStorage.getItem(CK)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.productId&&x.qty>0):[]}catch(e){return[]}};
const saveCart=a=>{try{localStorage.setItem(CK,JSON.stringify(a.slice(0,50)))}catch(e){};renderCart()};
function cartLines(){return loadCart().map(l=>{const p=byId(l.productId);return p?{lineId:l.lineId,productId:p.id,name:p.name,image:p.image,optionLabel:l.optionLabel||'',qty:l.qty,unitPrice:p.price,maxQty:p.stock==null?999:Math.max(1,p.stock)}:null}).filter(Boolean)}
function addToCart(p,qty,optLabel){const a=loadCart();const key=p.id+'|'+optLabel;const ex=a.find(x=>x.lineId===key);if(ex)ex.qty=Math.min(999,ex.qty+qty);else a.push({lineId:key,productId:p.id,optionLabel:optLabel,qty});saveCart(a)}
function renderCart(){const items=cartLines();const n=items.reduce((s,x)=>s+x.qty,0);$('#cartCount').textContent=n;$('#cartBody').innerHTML=MALL_UI.cartBody({items});$('#cartFoot').innerHTML=MALL_UI.cartFoot({subtotal:items.reduce((s,x)=>s+x.unitPrice*x.qty,0),itemCount:n})}
function openCart(o){const d=$('#cartDrawer'),s=$('#cartShade');d.classList.toggle('on',o);s.classList.toggle('on',o);d.setAttribute('aria-hidden',!o);if(o)d.removeAttribute('inert');else d.setAttribute('inert','');$('#cartBtn').setAttribute('aria-expanded',o)}

/* --- shipping --- */
function shipFor(sub){const fee=+(cur==='JPY'?cfg.shipJPY:cfg.shipKRW)||0;const free=cur==='JPY'?cfg.freeOverJPY:cfg.freeOverKRW;return free!=null&&free!==''&&sub>=+free?0:fee}

/* --- views --- */
function renderCats(){
 const cats=['all','deals','popular','live','new',...CATS.filter(c=>prods().some(p=>p.category===c))];
 $('#mCats').innerHTML=cats.map(c=>MALL_UI.categoryChip({id:c,name:['all','deals','popular','live','new'].includes(c)?t('m_cat_'+c):gname(c),active:state.cat===c&&/^#(cat-|$)/.test(location.hash||'#')})).join('');
}
function previewBar(){return cfg.mallOpen?'':`<div class="m-preview">${esc(t('m_preview'))}</div>`}
function viewHome(){
 const ps=prods();
 const deals=sortList(ps.filter(p=>p.discount>0||p.section==='deal'),'recommended').slice(0,10);
 const popular=sortList(ps,'bestselling').slice(0,10);
 const arrivals=ps.slice().sort((a,b)=>b.updated-a.updated).slice(0,10);
 const liveStreams=[['img/creator.jpg','m_live1','24.1K'],['img/host-jp.jpg','m_live2','8.6K'],['img/creator2.jpg','m_live3','12.3K']].map(([image,k,v],i)=>({id:'live'+i,image,title:t(k),host:t('m_host'),viewers:v,href:'#cat-live'}));
 const end=new Date();end.setHours(23,59,59,999);
 $('#mView').innerHTML=previewBar()+(loaded&&!ps.length?`<div class="m-preview">${esc(t('m_no_results'))}</div>`:'')+MALL_UI.home({deals,popular,arrivals,liveStreams,dealTime:end.getTime(),promotion:null});
 tickClock();
}
function catTitle(c){return ['all','deals','popular','live','new'].includes(c)?t('m_cat_'+c):gname(c)}
function viewCat(){
 let ps=prods();const c=state.cat;
 if(c==='deals')ps=ps.filter(p=>p.discount>0||p.section==='deal');else if(c==='live')ps=ps.filter(p=>p.live);else if(c==='new')ps=ps.slice().sort((a,b)=>b.updated-a.updated).slice(0,40);else if(c==='popular')ps=sortList(ps,'bestselling');else if(c!=='all')ps=ps.filter(p=>p.category===c);
 const q=state.q.trim().toLowerCase();if(q)ps=ps.filter(p=>(p.name+' '+p.brand+' '+p.description).toLowerCase().includes(q));
 if(!(c==='popular'&&state.sort==='recommended'))ps=sortList(ps,state.sort);
 $('#mView').innerHTML=previewBar()+MALL_UI.catalog({title:catTitle(c),query:state.q,categoryId:c,sort:state.sort,total:ps.length,products:ps});
}
function viewDetail(id){
 const p=byId(id);if(!p){if(loaded){location.hash='#home'}else $('#mView').innerHTML='';return}
 if(detail.id!==p.id)detail={id:p.id,img:0,qty:1,opts:{},tab:'description'};
 const related=prods().filter(x=>x.id!==p.id&&x.category===p.category).concat(prods().filter(x=>x.id!==p.id&&x.category!==p.category)).slice(0,8);
 $('#mView').innerHTML=previewBar()+MALL_UI.productDetail({product:p,related,activeImage:detail.img,qty:detail.qty,selectedOptions:detail.opts,backHref:'#cat-'+(state.cat||'all'),activeTab:detail.tab});
}
function checkoutData(){const items=cartLines().map(i=>({...i}));const subtotal=items.reduce((s,x)=>s+x.unitPrice*x.qty,0);const shipping=items.length?shipFor(subtotal):0;return {items,subtotal,shipping,discount:0,total:subtotal+shipping}}
function viewCheckout(){
 const d=checkoutData();if(!d.items.length){location.hash='#home';openCart(true);return}
 let saved={};try{saved=JSON.parse(localStorage.getItem('kj_customer')||'{}')||{}}catch(e){}
 const countries=[['KR','대한민국 · Korea'],['JP','日本 · Japan'],['CN','中国 · China'],['TW','台灣 · Taiwan'],['HK','香港 · Hong Kong'],['VN','Việt Nam'],['TH','Thailand'],['US','United States'],['OT','Other']].map(([code,name])=>({code,name}));
 $('#mView').innerHTML=previewBar()+MALL_UI.checkout({...d,customer:{country:cur==='JPY'?'JP':'KR',...saved},countries,allowPostalLookup:false,privacyUrl:''});
 if(!cfg.mallOpen){const b=$('#coSubmit');if(b){b.disabled=true}}
}
function viewDone(){
 if(!lastOrder){location.hash='#orders';return}
 const o=lastOrder;const bank=cfg.bankName||cfg.bankAccount?{name:cfg.bankName||'',account:cfg.bankAccount||'',holder:cfg.bankHolder||'',deadline:cfg.bankDeadline||t('m_deadline_val'),notice:t('m_bank_transfer_notice')}:{name:'',account:'',holder:'',deadline:t('m_deadline_val'),notice:t('m_bank_pending')};
 $('#mView').innerHTML=MALL_UI.orderComplete({orderNo:o.id,items:o.items,customer:o.customer,bank,subtotal:o.subtotal,shipping:o.shipping,discount:0,total:o.total});
}
function viewOrders(){$('#mView').innerHTML=MALL_UI.orderLookup(olState)}

function route(){
 const h=decodeURIComponent(location.hash.slice(1)||'home');
 if(h==='home'||h==='')viewHome();
 else if(h.startsWith('cat-')){const c=h.slice(4);if(c!==state.cat){state.cat=c;state.sort='recommended'}viewCat()}
 else if(h.startsWith('p-'))viewDetail(h.slice(2));
 else if(h==='checkout')viewCheckout();
 else if(h==='done')viewDone();
 else if(h==='orders')viewOrders();
 else if(h==='live-section'){viewHome();setTimeout(()=>{const el=document.getElementById('live-section');if(el)el.scrollIntoView()},50)}
 else viewHome();
 renderCats();
 if(!h.startsWith('p-')||true)window.scrollTo({top:0});
}
function tickClock(){const el=$('#dealClock');if(!el)return;clearInterval(tickClock.h);const f=()=>{const e=new Date();e.setHours(23,59,59,999);let s=Math.max(0,Math.floor((e-Date.now())/1000));const hh=String(Math.floor(s/3600)).padStart(2,'0'),mm=String(Math.floor(s%3600/60)).padStart(2,'0'),ss=String(s%60).padStart(2,'0');el.textContent=`${hh}:${mm}:${ss}`};f();tickClock.h=setInterval(()=>{if(!document.body.contains(el))return clearInterval(tickClock.h);f()},1000)}

/* --- i18n static --- */
function applyStatic(){
 document.documentElement.lang=lang;
 document.querySelectorAll('[data-i]').forEach(el=>{el.textContent=t(el.dataset.i)});
 document.querySelectorAll('[data-i-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.iPlaceholder)});
 $('#langSel').value=lang;$('#curSel').value=cur;
 document.title='TikTok Shop KR·JP';
 const rowsF=[];const b=cfg.brand||'KJ SHOPLINK';rowsF.push(b);if(cfg.company)rowsF.push(cfg.company);if(cfg.email)rowsF.push('Email : '+cfg.email);if(cfg.phone)rowsF.push('Tel : '+cfg.phone);
 $('#mFootInfo').innerHTML=rowsF.map(x=>`<p style="white-space:pre-line">${esc(x)}</p>`).join('');
}

/* --- events --- */
document.addEventListener('click',async e=>{
 const a=e.target.closest('[data-action]');if(!a)return;
 const act=a.dataset.action,id=a.dataset.id;
 if(act==='category'){e.preventDefault();state.q='';$('#mSearch').value='';location.hash='#cat-'+id}
 else if(act==='search'){doSearch()}
 else if(act==='cart-close'||act==='cart-product'){openCart(false)}
 else if(act==='cart-browse'){openCart(false);location.hash='#cat-all'}
 else if(act==='checkout'){openCart(false);location.hash='#checkout'}
 else if(act==='checkout-back'){e.preventDefault();openCart(true)}
 else if(act==='cart-remove'){saveCart(loadCart().filter(x=>x.lineId!==id))}
 else if(act==='qty-minus'||act==='qty-plus'){const d=act==='qty-plus'?1:-1;if(a.dataset.scope==='cart'){const c=loadCart();const l=c.find(x=>x.lineId===id);if(l){l.qty=Math.max(1,Math.min(999,l.qty+d));saveCart(c)}if(location.hash==='#checkout')viewCheckout()}else{const p=byId(detail.id);const max=p&&p.stock!=null?Math.max(1,p.stock):999;detail.qty=Math.max(1,Math.min(max,detail.qty+d));viewDetailKeep()}}
 else if(act==='gallery-image'){detail.img=+a.dataset.index||0;viewDetailKeep()}
 else if(act==='detail-tab'){detail.tab=a.dataset.tab;viewDetailKeep()}
 else if(act==='add-to-cart'||act==='buy-now'){const p=byId(detail.id||id);if(!p)return;const miss=p.options.find(o=>!detail.opts[o.id]);if(miss){toast(t('m_err_option'));const s=document.getElementById('opt-'+miss.id);if(s)s.focus();return}const label=p.options.map(o=>o.name+': '+detail.opts[o.id]).join(' / ');addToCart(p,detail.qty,label);if(act==='buy-now')location.hash='#checkout';else{toast(t('m_added'));openCart(true)}}
 else if(act==='hero-slide'){const s=$('#heroSlider');if(s){const i=+a.dataset.index||0;s.scrollTo({left:s.clientWidth*i,behavior:'smooth'})}}
 else if(act==='scroll-live'){e.preventDefault();const el=document.getElementById('live-section');if(el)el.scrollIntoView({behavior:'smooth'})}
 else if(act==='copy-account'){copyText(cfg.bankAccount||'')}
 else if(act==='copy-tracking'){copyText(a.dataset.value||a.textContent.trim())}
});
function viewDetailKeep(){const y=window.scrollY;viewDetail(detail.id);window.scrollTo({top:y})}
document.addEventListener('change',e=>{
 const a=e.target.closest('[data-action]');if(!a)return;
 if(a.dataset.action==='sort'){state.sort=a.value;viewCat()}
 if(a.dataset.action==='product-option'){detail.opts[a.dataset.optionId]=a.value}
});
document.addEventListener('scroll',e=>{const s=e.target;if(s&&s.id==='heroSlider'){const i=Math.round(s.scrollLeft/Math.max(1,s.clientWidth));document.querySelectorAll('.hero-dot').forEach((d,k)=>{d.classList.toggle('active',k===i);d.setAttribute('aria-current',k===i)})}},true);
function doSearch(){state.q=$('#mSearch').value.trim();state.cat='all';if(location.hash==='#cat-all')viewCat();else location.hash='#cat-all'}
$('#mSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();doSearch()}});
$('#cartBtn').onclick=()=>openCart(!$('#cartDrawer').classList.contains('on'));
$('#cartShade').onclick=()=>openCart(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape')openCart(false)});
$('#langSel').onchange=e=>{lang=e.target.value;try{localStorage.setItem('kj_lang',lang)}catch(_){};applyStatic();renderCart();route()};
$('#curSel').onchange=e=>{cur=e.target.value;try{localStorage.setItem('kj_cur',cur)}catch(_){};renderCart();route()};
window.addEventListener('hashchange',route);
const newOrderId=()=>{const d=new Date();const p=n=>String(n).padStart(2,'0');const r=crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(6,'0').slice(0,6);return 'OD'+String(d.getFullYear()).slice(2)+p(d.getMonth()+1)+p(d.getDate())+'-'+r};
document.addEventListener('submit',async e=>{
 if(e.target.id==='coForm'){
  e.preventDefault();const f=e.target;let bad=false;
  f.querySelectorAll('[required]').forEach(el=>{const v=el.type==='checkbox'||el.type==='radio'?(el.type==='checkbox'?el.checked:!!f.querySelector(`[name="${el.name}"]:checked`)):el.value.trim();const b=!v||(el.type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value));el.classList.toggle('bad',b);el.setAttribute('aria-invalid',b);if(b)bad=true});
  if(bad){toast(t('m_err_required'));const fb=f.querySelector('.bad');if(fb)fb.focus();return}
  if(!cfg.mallOpen){toast(t('m_preview'));return}
  const g=n=>(f.querySelector(`[name="${n}"]`)||{}).value?.trim()||'';
  const customer={name:g('name'),phone:g('phone'),email:g('email').toLowerCase(),country:g('country'),postcode:g('postcode'),address:g('address'),address2:g('address2'),note:g('note')};
  try{localStorage.setItem('kj_customer',JSON.stringify({...customer,note:''}))}catch(_){}
  const lines=cartLines();const row={id:newOrderId(),currency:cur,lang,name:customer.name,phone:customer.phone,email:customer.email,country:customer.country,zip:customer.postcode,addr1:customer.address,addr2:customer.address2,note:customer.note,items:lines.map(l=>({id:l.productId,qty:l.qty,option:l.optionLabel}))};
  const btn=$('#coSubmit');if(btn)btn.disabled=true;
  let ok=false;try{const {error}=await sb.from('tts_orders').insert(row);ok=!error}catch(err){ok=false}
  if(btn)btn.disabled=false;
  if(!ok){toast(t('m_err_order'));return}
  const d=checkoutData();lastOrder={id:row.id,items:d.items,customer:{...customer,countryLabel:customer.country},subtotal:d.subtotal,shipping:d.shipping,total:d.total};
  try{const my=JSON.parse(localStorage.getItem('kj_orders')||'[]');my.push({id:row.id,email:customer.email});localStorage.setItem('kj_orders',JSON.stringify(my.slice(-30)))}catch(_){}
  saveCart([]);location.hash='#done';
 }
 if(e.target.id==='olForm'){
  e.preventDefault();const f=e.target;const no=(f.querySelector('#olOrderNo')||{}).value?.trim().toUpperCase()||'',em=(f.querySelector('#olEmail')||{}).value?.trim()||'';
  olState={orderNo:no,email:em,result:null,error:''};
  if(!no||!em){olState.error=t('m_err_required');return viewOrders()}
  try{const {data,error}=await sb.rpc('tts_order_status',{p_id:no,p_email:em});if(error||!data||!data.length)olState.error=t('m_not_found');else{const o=data[0];const st={new:'received',paid:'paid',preparing:'preparing',shipping:'shipped',delivered:'delivered',cancelled:'cancelled'}[o.status]||'received';const c0=cur;cur=o.currency||cur;olState.result={orderNo:o.id,status:st,statusNote:'',createdAtLabel:fmtDate(Date.parse(o.created_at)),items:(o.items||[]).map(i=>({lineId:i.id,productId:i.id,name:i.name,image:imgSrc(i.img),optionLabel:i.option||'',qty:i.qty,unitPrice:+i.price})),subtotal:+o.subtotal,shipping:+o.shipping,discount:0,total:+o.total,trackingNo:o.tracking||'',carrier:'',trackingUrl:''};viewOrders();cur=c0;return}}catch(err){olState.error=t('m_err_order')}
  viewOrders();
 }
});

/* --- boot --- */
applyStatic();renderCart();route();
(async()=>{
 if(!sb){loaded=true;route();return}
 try{const [{data:c},{data:r}]=await Promise.all([sb.from('tts_config').select('data').eq('id',1).maybeSingle(),sb.from('tts_catalog').select('*').eq('mall',true).order('sort',{ascending:true})]);cfg=c&&c.data?c.data:{};rows=r||[]}catch(e){}
 loaded=true;applyStatic();renderCart();route();
})();
