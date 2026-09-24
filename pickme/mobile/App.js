import React,{useState,useEffect} from 'react';
import {View,Text,ScrollView,TouchableOpacity,Linking,SafeAreaView,Alert,Platform} from 'react-native';
import {api,setToken,session} from './api';
import {C,s,Btn,In,Stars} from './ui';
import RoutePicker from './MapPick';
const say=m=>Platform.OS==='web'?window.alert(m):Alert.alert('PickMe',m);
const ok=(m,scr,go)=>{say(m);go&&go(scr)};
const DAYS=['M','T','W','T','F','S','S'],today=()=>new Date().toISOString().slice(0,10),plus=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
const hav=(a,b)=>{const r=x=>x*Math.PI/180,k=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lng-a.lng)/2)**2;return 12742*Math.asin(Math.sqrt(k))};
const wa=(phone,text)=>Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
const blank=()=>({origin:null,dest:null,days:[0,1,2,3,4],startTime:'08:30',endTime:'09:00',startDate:today(),endDate:plus(30),role:'need',seats:'1',price:'0'});

export default function App(){
 const [scr,setScr]=useState('splash'),[me,setMe]=useState(null),[f,setF]=useState(blank()),[res,setRes]=useState([]),[sel,setSel]=useState(null),[busy,setBusy]=useState(false),[onboard,setOnboard]=useState(0);
 useEffect(()=>{(async()=>{const x=await session.load();if(x){setToken(x.t);setMe(x.u)}setTimeout(()=>setScr(p=>p==='splash'?'onboarding':p),1500)})()},[]);
 const go=setScr,need=()=>{if(!me){go('auth');return false}return true};
 const search=async()=>{if(!need())return;if(!f.origin||!f.dest)return say('Pick your From and To locations first');setBusy(true);go('search');
  try{const r=await api('/api/match',{...f});setTimeout(()=>{setRes(r);go('results')},700)}catch(e){say(e.message);go('home')}setBusy(false)};
 const post=async()=>{if(!need())return;if(!f.origin||!f.dest)return say('Pick your From and To locations first');
  try{await api('/api/commutes',{...f,seats:+f.seats||1,price:+f.price||0});ok('Commute posted! Others can now find you.','profile',go)}catch(e){say(e.message)}};
 const logout=async()=>{await session.clear();setToken(null);setMe(null);go('home')};
 if(scr==='splash')return <View style={[s.fill,{backgroundColor:C.y,justifyContent:'center',padding:30}]}><Text style={s.logo}>PickMe</Text><Text style={{fontSize:20,fontWeight:'600'}}>Same route.{'\n'}Better together.</Text><Text style={{fontSize:70,marginTop:30}}>🚕</Text></View>;
 if(scr==='onboarding')return <Onboarding page={onboard} setPage={setOnboard} done={()=>go('auth')}/>;
 if(scr==='search')return <View style={[s.fill,{backgroundColor:C.y,justifyContent:'center',alignItems:'center'}]}><Text style={s.h1}>Finding your perfect ride...</Text><Text style={{fontSize:60}}>🚕</Text><Text>Searching along your route…</Text></View>;
 if(scr==='auth')return <Auth onDone={(t,u)=>{setToken(t);setMe(u);session.save(t,u);go('home')}} back={()=>go('home')}/>;
 if(scr==='detail')return <Detail c={sel} me={me} back={()=>go('results')} need={need}/>;
 const tabs=[['home','🏠','Home'],['post','＋','Post'],['requests','📩','Requests'],['trips','🧾','Trips'],['profile','👤','Profile']];
 return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
  {(scr==='home'||scr==='post')&&<><View style={s.homeIntro}><Text style={s.eyebrow}>{scr==='home'?'YOUR DAILY ROUTE':'COMMUNITY COMMUTE'}</Text><Text style={s.h1}>{scr==='home'?'Where are we going?':'Post your daily commute'}</Text><Text style={s.introText}>{scr==='home'?'Find people travelling your way, on the days and hours that work for you.':'Make your route visible and let the right people share the cost.'}</Text></View>
   <Form f={f} setF={setF} post={scr==='post'}/>
   <Btn t={scr==='home'?'Find a Ride  →':'Post Commute  →'} onPress={scr==='home'?search:post}/></>}
  {scr==='results'&&<><Text onPress={()=>go('home')} style={{fontSize:22}}>←</Text><Text style={s.h2}>Available Rides</Text><Text style={s.mute}>{f.origin?.name} → {f.dest?.name}</Text>
   {res.length===0&&<View style={s.card}><Text>No matches yet. Post your commute so others can find you!</Text><Btn yellow t="Post my commute" onPress={()=>go('post')}/></View>}
   {res.map(c=><TouchableOpacity key={c._id} style={s.card} onPress={()=>{setSel(c);go('detail')}}>
    <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={s.name}>{c.user.name}{c.user.verified?' ✔':''}</Text><Text style={s.badge}>{c.score}% match</Text></View>
    <Text style={s.mute}>★ {c.user.avg||'New'} ({c.user.count})  ·  {c.role==='offer'?'Offering a ride':'Needs a ride'}</Text>
    <Text style={{fontSize:20,fontWeight:'700',marginTop:6}}>{c.startTime} – {c.endTime}</Text>
    <Text style={s.mute}>{c.origin.name} → {c.dest.name}</Text><Text style={s.mute}>Start {c.originKm} km from you · End {c.destKm} km from you</Text>
    <Text style={{marginTop:4}}>💺 {c.seats} seats   💰 Rs. {c.price}/seat</Text></TouchableOpacity>)}</>}
  {scr==='requests'&&(me?<Requests/>:<Guest go={go}/>)}
  {scr==='trips'&&(me?<Trips me={me}/>:<Guest go={go}/>)}
  {scr==='profile'&&(me?<Profile me={me} logout={logout}/>:<Guest go={go}/>)}
 </ScrollView>
 <View style={s.tabs}>{tabs.map(([k,i,l])=><TouchableOpacity key={k} onPress={()=>go(k)} style={[s.tabButton,k==='post'&&s.addTab]}><Text style={[s.tabIcon,{fontSize:k==='post'?27:19,color:k==='post'?C.ink:undefined}]}>{i}</Text><Text style={[s.tabLabel,{color:k==='post'?C.ink:scr===k?C.ink:C.mute}]}>{l}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}
const Guest=({go})=><View style={s.card}><Text style={s.name}>Log in to continue</Text><Btn t="Log in / Sign up" onPress={()=>go('auth')}/></View>;

function Onboarding({page,setPage,done}){
 const slides=[
  {eyebrow:'GOING SOMEWHERE?',title:'Find your people.',copy:'Share the same route, split the fare, and make every commute lighter.',art:'🚕',accent:'Travel together.'},
  {eyebrow:'SAVE MONEY',title:'Travel greener.',copy:'Meet people nearby who are already going your way.',art:'🌱',accent:'Better rides, together.'},
  {eyebrow:'CHALO',title:"Let's get started!",copy:'Tell us where you are headed and we will help you find the right ride.',art:'🚕',accent:'Islamabad  →  Rawalpindi'},
 ];
 const x=slides[page];
 return <SafeAreaView style={[s.fill,s.paper]}><View style={s.onboardTop}><Text style={s.onboardBrand}>PickMe</Text><TouchableOpacity onPress={done}><Text style={s.skip}>Skip</Text></TouchableOpacity></View><View style={s.onboardBody}><Text style={s.onboardEyebrow}>{x.eyebrow}</Text><Text style={s.onboardTitle}>{x.title}</Text><Text style={s.onboardCopy}>{x.copy}</Text><View style={s.onboardArt}><Text style={s.onboardArtSpark}>✦</Text><Text style={s.onboardEmoji}>{x.art}</Text><Text style={s.onboardRoad}>〰〰〰〰〰</Text><View style={s.signpost}><Text style={s.signText}>{x.accent}</Text></View></View></View><View style={s.onboardBottom}><View style={s.dots}>{slides.map((_,i)=><View key={i} style={[s.dot,i===page&&s.dotActive]}/>)}</View><Btn yellow t={page===slides.length-1?'Create an account  →':'Continue  →'} onPress={()=>page===slides.length-1?done():setPage(page+1)}/><Text style={s.onboardLogin} onPress={done}>Already have an account? <Text style={{fontWeight:'800',color:C.blue}}>Log in</Text></Text></View></SafeAreaView>;
}

function Form({f,setF,post}){const up=(k,v)=>setF(o=>({...o,[k]:v}));
 return <View>
  <Text style={s.formTitle}>Build your route</Text>
  <RoutePicker o={f.origin} d={f.dest} setO={v=>up('origin',v)} setD={v=>up('dest',v)}/>
  <Text style={s.lbl}>Days</Text><View style={{flexDirection:'row',gap:6}}>{DAYS.map((d,i)=><TouchableOpacity key={i} onPress={()=>up('days',f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i])} style={[s.day,f.days.includes(i)&&{backgroundColor:C.y}]}><Text style={{fontWeight:'700'}}>{d}</Text></TouchableOpacity>)}</View>
  <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Text style={s.lbl}>Time from</Text><In value={f.startTime} onChangeText={v=>up('startTime',v)} placeholder="08:30"/></View><View style={{flex:1}}><Text style={s.lbl}>Time to</Text><In value={f.endTime} onChangeText={v=>up('endTime',v)} placeholder="09:00"/></View></View>
  <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Text style={s.lbl}>Date from</Text><In value={f.startDate} onChangeText={v=>up('startDate',v)} placeholder="YYYY-MM-DD"/></View><View style={{flex:1}}><Text style={s.lbl}>Date to</Text><In value={f.endDate} onChangeText={v=>up('endDate',v)} placeholder="YYYY-MM-DD"/></View></View>
  {post&&<><Text style={s.lbl}>I…</Text><View style={{flexDirection:'row'}}>{[['need','Need a ride'],['offer','Offer a ride']].map(([k,l])=><TouchableOpacity key={k} onPress={()=>up('role',k)} style={[s.chip,f.role===k&&{backgroundColor:C.y}]}><Text style={{fontWeight:'600'}}>{l}</Text></TouchableOpacity>)}</View>
   <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Text style={s.lbl}>Seats</Text><In value={f.seats} onChangeText={v=>up('seats',v)} keyboardType="numeric"/></View><View style={{flex:1}}><Text style={s.lbl}>Rs / seat</Text><In value={f.price} onChangeText={v=>up('price',v)} keyboardType="numeric"/></View></View></>}
 </View>}

function Auth({onDone,back}){const [reg,setReg]=useState(false),[v,setV]=useState({name:'',phone:'',email:'',cnic:'',password:''}),[err,setErr]=useState(''),set=k=>t=>setV(o=>({...o,[k]:t}));
 const go=()=>api(reg?'/api/register':'/api/login',v).then(r=>onDone(r.token,r.user)).catch(e=>setErr(e.message));
 return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.authPad}><View style={s.authBrand}><Text style={s.authLogo}>PickMe</Text><Text style={s.authDot}>✦</Text></View><Text onPress={back} style={s.backButton}>←</Text><Text style={s.h1}>{reg?'Create your account':'Welcome back'}</Text><Text style={s.mute}>{reg?"Let's get you on the road!":'Log in to find your people and share the journey.'}</Text>
  {!reg&&<><TouchableOpacity style={s.socialButton} onPress={()=>say('Google sign-in will be connected soon.')}><Text style={s.socialIcon}>G</Text><Text style={s.socialText}>Continue with Google</Text></TouchableOpacity><TouchableOpacity style={s.socialButton} onPress={()=>say('Apple sign-in will be connected soon.')}><Text style={s.socialIcon}>●</Text><Text style={s.socialText}>Continue with Apple</Text></TouchableOpacity><View style={s.authDivider}><View style={s.dividerLine}/><Text style={s.orText}>or</Text><View style={s.dividerLine}/></View></>}
  {reg&&<In placeholder="Full name" value={v.name} onChangeText={set('name')}/>}<In placeholder="Phone (03001234567)" keyboardType="phone-pad" value={v.phone} onChangeText={set('phone')}/>
  {reg&&<><In placeholder="Email" autoCapitalize="none" value={v.email} onChangeText={set('email')}/><In placeholder="CNIC (13 digits)" keyboardType="numeric" value={v.cnic} onChangeText={set('cnic')}/></>}
  <In placeholder="Password" secureTextEntry value={v.password} onChangeText={set('password')}/>{!!err&&<Text style={{color:C.red}}>{err}</Text>}
  <Btn yellow t={reg?'Sign Up':'Log In'} onPress={go}/><Text onPress={()=>{setReg(!reg);setErr('')}} style={{textAlign:'center',marginTop:16,color:C.blue}}>{reg?'Already have an account? Log in':'New here? Sign up'}</Text></ScrollView></SafeAreaView>}

function Detail({c,me,back,need}){const [p,setP]=useState(null),[sent,setSent]=useState(false);
 useEffect(()=>{api('/api/users/'+c.user._id).then(setP).catch(()=>{})},[]);
 const join=()=>{if(!need())return;api('/api/requests',{commuteId:c._id}).then(()=>{setSent(true);say('Request sent! You can also WhatsApp them.')}).catch(e=>say(e.message))};
 const msg=`Hi ${c.user.name}! I found you on PickMe. Are you still going ${c.origin.name} → ${c.dest.name} around ${c.startTime}?`;
 return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad}><Text onPress={back} style={{fontSize:22}}>←</Text><Text style={s.h2}>Ride Details</Text>
  <View style={s.card}><Text style={s.name}>{c.user.name}{c.user.verified?' ✔ Verified':''}</Text><Text style={s.mute}>★ {c.user.avg||'New'} · {c.user.count} ratings</Text>
   <Text style={{fontSize:26,fontWeight:'800',marginVertical:8}}>{c.startTime} – {c.endTime}</Text><Text>🟢 {c.origin.name}</Text><Text>🔴 {c.dest.name}</Text>
   <Text style={{marginTop:8}}>📅 {c.startDate||'-'} → {c.endDate||'-'} · {c.days.map(d=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d]).join(', ')}</Text>
   <Text style={{marginTop:6}}>💺 {c.seats} seats · 💰 Rs. {c.price}/seat · {c.score}% match</Text></View>
  <Btn yellow t={sent?'Request sent ✓':'Request to Join  →'} onPress={join}/><Btn dark t="Chat on WhatsApp  →" onPress={()=>wa(c.user.phone,msg)}/>
  <Text style={s.lbl}>Reviews</Text>{p&&p.reviews.length===0&&<Text style={s.mute}>No reviews yet.</Text>}
  {p&&p.reviews.map((r,i)=><View key={i} style={s.card}><Stars v={r.stars}/><Text>{r.comment||'—'}</Text><Text style={s.mute}>by {r.from||'rider'}</Text></View>)}
  <View style={{flexDirection:'row',gap:10,marginTop:10}}><Btn style={{flex:1,backgroundColor:C.lav}} t="Report" onPress={()=>need()&&api('/api/report',{userId:c.user._id,reason:'Reported from ride details'}).then(()=>say('Reported. Thanks!'))}/>
   <Btn style={{flex:1,backgroundColor:C.red}} t="Block" onPress={()=>need()&&api('/api/block',{userId:c.user._id}).then(()=>{say('Blocked - you will no longer see them.');back()})}/></View></ScrollView></SafeAreaView>}

function Requests(){const [d,setD]=useState({incoming:[],outgoing:[]}),[tf,setTf]=useState(null);
 const load=()=>api('/api/requests').then(setD).catch(e=>say(e.message));useEffect(()=>{load()},[]);
 const act=(id,st)=>api('/api/requests/'+id,{status:st},'PATCH').then(load);
 const accepted={};d.incoming.filter(r=>r.status==='accepted'&&r.commuteId).forEach(r=>{(accepted[r.commuteId._id]=accepted[r.commuteId._id]||{c:r.commuteId,n:0}).n++});
 const finish=()=>api('/api/trips',{commuteId:tf.c._id,distanceKm:tf.km,fare:tf.fare}).then(t=>{setTf(null);say(`Trip recorded! Total Rs. ${t.fare} → each of ${t.riders.length+1} people pays Rs. ${t.perPerson}. Rate each other in Trips.`);load()}).catch(e=>say(e.message));
 return <><Text style={s.h2}>Requests</Text><Text style={s.lbl}>People who want to join you</Text>
  {d.incoming.length===0&&<Text style={s.mute}>None yet.</Text>}
  {d.incoming.map(r=><View key={r._id} style={s.card}><Text style={s.name}>{r.fromUser?.name}</Text><Text style={s.mute}>{r.commuteId?.origin?.name} → {r.commuteId?.dest?.name} · {r.status}</Text>
   {r.status==='pending'&&<View style={{flexDirection:'row',gap:10}}><Btn style={{flex:1}} yellow t="Accept" onPress={()=>act(r._id,'accepted')}/><Btn style={{flex:1,backgroundColor:C.red}} t="Reject" onPress={()=>act(r._id,'rejected')}/></View>}
   {r.status==='accepted'&&<Btn dark t="WhatsApp rider" onPress={()=>wa(r.fromUser.phone,'Hi! Your PickMe request is accepted 🚕')}/>}</View>)}
  {Object.values(accepted).map(a=><View key={a.c._id} style={[s.card,{backgroundColor:C.mint}]}><Text style={s.name}>Ride done with {a.n} rider(s)?</Text>
   {tf&&tf.c._id===a.c._id?<><Text style={s.lbl}>Distance (km) — auto-estimated from map</Text><In keyboardType="numeric" value={String(tf.km)} onChangeText={v=>setTf({...tf,km:v})}/>
    <Text style={s.lbl}>Total fare / InDrive cost (Rs)</Text><In keyboardType="numeric" value={tf.fare} onChangeText={v=>setTf({...tf,fare:v})} placeholder="e.g. 1200"/>
    <Text style={s.mute}>{tf.fare?`Split ${a.n+1} ways: Rs. ${Math.round(+tf.fare/(a.n+1))} each`:'Enter fare to see split'}</Text><Btn t="Save trip & split cost" onPress={finish}/></>
    :<Btn yellow t="Complete trip & split cost" onPress={()=>setTf({c:a.c,km:Math.round(hav(a.c.origin,a.c.dest)*1.3),fare:''})}/>}</View>)}
  <Text style={s.lbl}>Requests you sent</Text>{d.outgoing.length===0&&<Text style={s.mute}>None yet.</Text>}
  {d.outgoing.map(r=><View key={r._id} style={s.card}><Text style={s.name}>{r.toUser?.name}</Text><Text style={s.mute}>{r.commuteId?.origin?.name} → {r.commuteId?.dest?.name}</Text><Text style={{fontWeight:'700',color:r.status==='accepted'?'green':C.ink}}>{r.status.toUpperCase()}</Text>
   {r.status==='accepted'&&<Btn dark t="WhatsApp driver" onPress={()=>wa(r.toUser.phone,'Hi! Thanks for accepting my PickMe request 🚕')}/>}</View>)}</>}

function Trips({me}){const [t,setT]=useState([]);const load=()=>api('/api/trips/mine').then(setT).catch(e=>say(e.message));useEffect(()=>{load()},[]);
 const rate=(tripId,toUser,stars)=>api('/api/ratings',{tripId,toUser,stars}).then(load).catch(e=>say(e.message));
 return <><Text style={s.h2}>Trips & Ratings</Text>{t.length===0&&<Text style={s.mute}>Completed trips show up here. Accept a rider in Requests, then complete the trip to split the cost.</Text>}
  {t.map(x=>{const ppl=[x.driverId,...x.riders].filter(p=>String(p._id)!==String(me._id));return <View key={x._id} style={s.card}><Text style={s.name}>{x.origin?.name} → {x.dest?.name}</Text><Text style={s.mute}>{new Date(x.createdAt).toDateString()} · {x.distanceKm} km</Text>
   <Text style={{fontSize:22,fontWeight:'800',marginVertical:6}}>Rs. {x.perPerson} each <Text style={{fontSize:13,fontWeight:'400'}}>(total Rs. {x.fare})</Text></Text>
   {ppl.map(p=><View key={p._id} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text>{p.name}</Text>{x.rated.includes(String(p._id))?<Text style={s.mute}>Rated ✓</Text>:<Stars v={0} set={n=>rate(x._id,p._id,n)}/>}</View>)}
   <Text style={s.mute}>Tap the stars to rate.</Text></View>})}</>}

function Profile({me,logout}){const [mine,setMine]=useState([]),[p,setP]=useState(null);
 const load=()=>{api('/api/commutes/mine').then(setMine).catch(()=>{});api('/api/users/'+me._id).then(setP).catch(()=>{})};useEffect(load,[]);
 return <><Text style={s.h2}>Profile</Text><View style={s.card}><Text style={s.name}>{me.name}</Text><Text style={s.mute}>{me.phone} · {me.email}</Text><Text style={{marginTop:6}}>★ {p?.avg||'New'} · {p?.count||0} ratings</Text></View>
  <Text style={s.lbl}>My commutes</Text>{mine.length===0&&<Text style={s.mute}>Nothing posted yet — use the ＋ tab.</Text>}
  {mine.map(c=><View key={c._id} style={s.card}><Text style={{fontWeight:'700'}}>{c.origin.name} → {c.dest.name}</Text><Text style={s.mute}>{c.startTime}–{c.endTime} · {c.role} · {c.days.map(d=>DAYS[d]).join('')}</Text>
   <Text onPress={()=>api('/api/commutes/'+c._id,null,'DELETE').then(load)} style={{color:C.red,marginTop:6}}>Delete</Text></View>)}
  <Btn dark t="Log out" onPress={logout}/></>}
