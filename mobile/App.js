import React,{useState,useEffect} from 'react';
import {View,Text,TextInput,TouchableOpacity,ScrollView,Linking,StyleSheet,SafeAreaView,Platform} from 'react-native';
const API=process.env.EXPO_PUBLIC_API_URL||'http://localhost:3000';
const C={y:'#FFD93D',cream:'#FFF8E7',blue:'#4F46E5',ink:'#1B1B2F',mute:'#8A8570',lav:'#E4DCFF',mint:'#D6F5E3'};
const api=(p,b)=>fetch(API+p,b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:undefined).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Error');return j});
const DAYS=['M','T','W','T','F','S','S'];
const Btn=({t,onPress,dark,style})=><TouchableOpacity onPress={onPress} style={[s.btn,dark?{backgroundColor:C.ink}:{backgroundColor:C.blue},style]}><Text style={s.btnT}>{t}  →</Text></TouchableOpacity>;
const In=p=><TextInput placeholderTextColor={C.mute} {...p} style={[s.in,p.style]}/>;
const Chips=({items,v,set})=><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:6}}>{items.map(i=><TouchableOpacity key={i} onPress={()=>set(i)} style={[s.chip,v===i&&{backgroundColor:C.y}]}><Text style={{fontWeight:'600'}}>{i}</Text></TouchableOpacity>)}</ScrollView>;
const Stars=({v,set})=><View style={{flexDirection:'row'}}>{[1,2,3,4,5].map(n=><Text key={n} onPress={()=>set&&set(n)} style={{fontSize:28,color:n<=v?'#F5A623':'#ccc'}}>★</Text>)}</View>;

export default function App(){
 const [scr,setScr]=useState('splash'),[user,setUser]=useState(null),[places,setPlaces]=useState([]),[sel,setSel]=useState(null),[res,setRes]=useState([]),[mine,setMine]=useState([]);
 const [f,setF]=useState({origin:'Islamabad G-10',dest:'Rawalpindi Saddar',days:[0,1,2,3,4],startTime:'08:30',endTime:'09:00',role:'need',seats:'1',price:'0'});
 const up=(k,v)=>setF(o=>({...o,[k]:v}));
 useEffect(()=>{api('/api/places').then(p=>setPlaces(p.map(x=>x.name))).catch(()=>{});const t=setTimeout(()=>setScr(x=>x==='splash'?'home':x),1800);return()=>clearTimeout(t)},[]);
 const find=async()=>{setScr('search');try{const r=await api('/api/match',{...f,userId:user?.id});setTimeout(()=>{setRes(r);setScr('results')},900)}catch(e){alert('API not reachable. Check EXPO_PUBLIC_API_URL')}};
 const post=async()=>{if(!user)return setScr('signup');try{await api('/api/commutes',{...f,userId:user.id,seats:+f.seats,price:+f.price});alert('Commute posted! Others can now find you.');loadMine(user.id)}catch(e){alert(e.message)}};
 const loadMine=id=>fetch(API+'/api/commutes/'+id).then(r=>r.json()).then(setMine);
 const Tabs=()=><View style={s.tabs}>{[['home','🏠','Home'],['post','＋','Post'],['split','🧮','Split'],['profile','👤','Profile']].map(([k,i,l])=><TouchableOpacity key={k} onPress={()=>setScr(k)} style={{alignItems:'center'}}><Text style={{fontSize:k==='post'?30:20}}>{i}</Text><Text style={{fontSize:11,color:scr===k?C.blue:C.mute}}>{l}</Text></TouchableOpacity>)}</View>;
 const Back=({to})=><Text onPress={()=>setScr(to||'home')} style={{fontSize:22,marginBottom:8}}>←</Text>;

 if(scr==='splash')return <View style={[s.fill,{backgroundColor:C.y,justifyContent:'center',padding:30}]}><Text style={s.logo}>PickMe</Text><Text style={{fontSize:20,fontWeight:'600',transform:[{rotate:'-4deg'}]}}>Same route.{'\n'}Better together.</Text><Text style={{fontSize:70,marginTop:30}}>🚕</Text></View>;
 if(scr==='search')return <View style={[s.fill,{backgroundColor:C.y,justifyContent:'center',alignItems:'center'}]}><Text style={s.h1}>Finding your{'\n'}perfect ride...</Text><Text style={{fontSize:60}}>🚕</Text><Text>Searching along your route…</Text></View>;
 if(scr==='signup')return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad}><Back/><Text style={s.h1}>Create your account</Text><Text style={s.mute}>Let's get you on the road!</Text>
  <Signup onDone={u=>{setUser(u);loadMine(u.id);setScr('home')}}/></ScrollView></SafeAreaView>;
 if(scr==='detail'&&sel)return <Detail c={sel} me={user} back={()=>setScr('results')} login={()=>setScr('signup')}/>;
 return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad}>
  {(scr==='home'||scr==='post')&&<>
   <Text style={s.h1}>{scr==='home'?'Hey there!\nWhere are we going?':'Post your daily commute'}</Text>
   <Text style={s.lbl}>From</Text><Chips items={places} v={f.origin} set={v=>up('origin',v)}/>
   <Text style={s.lbl}>To</Text><Chips items={places} v={f.dest} set={v=>up('dest',v)}/>
   <Text style={s.lbl}>Days</Text><View style={{flexDirection:'row',gap:6}}>{DAYS.map((d,i)=><TouchableOpacity key={i} onPress={()=>up('days',f.days.includes(i)?f.days.filter(x=>x!==i):[...f.days,i])} style={[s.day,f.days.includes(i)&&{backgroundColor:C.y}]}><Text style={{fontWeight:'700'}}>{d}</Text></TouchableOpacity>)}</View>
   <View style={{flexDirection:'row',gap:10,marginTop:10}}><View style={{flex:1}}><Text style={s.lbl}>From time</Text><In value={f.startTime} onChangeText={v=>up('startTime',v)} placeholder="08:30"/></View><View style={{flex:1}}><Text style={s.lbl}>To time</Text><In value={f.endTime} onChangeText={v=>up('endTime',v)} placeholder="09:00"/></View></View>
   {scr==='home'?<Btn t="Find a Ride" onPress={find} style={{marginTop:18}}/>:<>
    <Text style={s.lbl}>I want to</Text><Chips items={['need','offer']} v={f.role} set={v=>up('role',v)}/>
    <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Text style={s.lbl}>Seats</Text><In value={f.seats} onChangeText={v=>up('seats',v)} keyboardType="numeric"/></View><View style={{flex:1}}><Text style={s.lbl}>Rs / seat</Text><In value={f.price} onChangeText={v=>up('price',v)} keyboardType="numeric"/></View></View>
    <Btn t="Post Commute" onPress={post} style={{marginTop:18}}/></>}
  </>}
  {scr==='results'&&<><Back/><Text style={s.h2}>Available Rides</Text><Text style={s.mute}>{f.origin} → {f.dest}</Text>
   {res.length===0&&<Text style={{marginTop:20}}>No matches yet. Post your commute so others can find you!</Text>}
   {res.map(c=><TouchableOpacity key={c.id} style={s.card} onPress={()=>{setSel(c);setScr('detail')}}>
    <View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={s.name}>{c.user.name} ✔</Text><Text style={s.badge}>{c.score}% match</Text></View>
    <Text style={s.mute}>★ {c.user.avg||'New'} ({c.user.count} ratings)</Text>
    <Text style={{fontSize:20,fontWeight:'700',marginTop:6}}>{c.startTime} – {c.endTime}</Text>
    <Text style={s.mute}>{c.origin} → {c.dest}</Text><Text style={{marginTop:4}}>💺 {c.seats} seats   💰 Rs. {c.price}/seat</Text></TouchableOpacity>)}</>}
  {scr==='split'&&<Split/>}
  {scr==='profile'&&<><Text style={s.h2}>Profile</Text>{user?<><View style={s.card}><Text style={s.name}>{user.name}</Text><Text style={s.mute}>{user.phone} · {user.email}</Text></View><Text style={s.lbl}>My commutes</Text>{mine.map(c=><View key={c.id} style={s.card}><Text style={{fontWeight:'700'}}>{c.origin} → {c.dest}</Text><Text style={s.mute}>{c.startTime}–{c.endTime} · {c.role}</Text></View>)}<Btn dark t="Log out" onPress={()=>{setUser(null);setMine([])}}/></>:<Btn t="Sign up / Log in" onPress={()=>setScr('signup')}/>}</>}
 </ScrollView><Tabs/></SafeAreaView>;
}
function Signup({onDone}){const [v,setV]=useState({name:'',phone:'',email:'',cnic:''});const [err,setErr]=useState('');
 const set=k=>t=>setV(o=>({...o,[k]:t}));
 return <View style={{marginTop:20}}><In placeholder="Full Name" value={v.name} onChangeText={set('name')}/><In placeholder="Phone (03001234567)" keyboardType="phone-pad" value={v.phone} onChangeText={set('phone')}/><In placeholder="Email" value={v.email} onChangeText={set('email')}/><In placeholder="CNIC (13 digits, no dashes)" keyboardType="numeric" value={v.cnic} onChangeText={set('cnic')}/>
 {!!err&&<Text style={{color:'red'}}>{err}</Text>}<Btn t="Sign Up" style={{backgroundColor:C.y}} onPress={()=>api('/api/users',v).then(onDone).catch(e=>setErr(e.message))}/></View>}
function Detail({c,me,back,login}){const [st,setSt]=useState(0),[sent,setSent]=useState(false);
 const wa=()=>Linking.openURL(`https://wa.me/${c.user.phone}?text=${encodeURIComponent('Hi! I found you on PickMe. Are you still going '+c.origin+' → '+c.dest+' at '+c.startTime+'?')}`);
 const join=()=>{if(!me)return login();api('/api/requests',{commuteId:c.id,fromUser:me.id}).then(()=>setSent(true))};
 const rate=n=>{if(!me)return login();setSt(n);api('/api/ratings',{toUser:c.user.id,fromUser:me.id,stars:n})};
 return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad}><Text onPress={back} style={{fontSize:22}}>←</Text><Text style={s.h2}>Ride Details</Text>
 <View style={s.card}><Text style={s.name}>{c.user.name} ✔ Verified</Text><Text style={s.mute}>★ {c.user.avg||'New'} · {c.user.count} ratings</Text><Text style={{fontSize:24,fontWeight:'800',marginVertical:8}}>{c.startTime}</Text><Text>{c.origin} → {c.dest}</Text><Text style={{marginTop:8}}>💺 {c.seats} left · 💰 Rs. {c.price}/seat · {c.score}% match</Text></View>
 <Text style={s.lbl}>Ride vibe</Text><View style={{flexDirection:'row',gap:8}}><Text style={s.pill}>🎵 Music</Text><Text style={s.pill}>💬 Chatty</Text></View>
 <Btn t={sent?'Request sent ✓':'Request to Join'} onPress={join} style={{backgroundColor:C.y,marginTop:20}}/><Btn dark t="Chat on WhatsApp" onPress={wa} style={{marginTop:10}}/>
 <Text style={s.lbl}>Rate this rider</Text><Stars v={st} set={rate}/></ScrollView></SafeAreaView>}
function Split(){const [d,setD]=useState('20'),[fare,setFare]=useState('1200'),[n,setN]=useState('3'),[r,setR]=useState(null);
 const calc=()=>{const per=Math.round(+fare/(+n||1));setR({per,km:(+fare/(+d||1)).toFixed(0)});api('/api/trips',{distanceKm:+d,fare:+fare,riders:+n}).catch(()=>{})};
 return <><Text style={s.h2}>Split the cost</Text><Text style={s.mute}>Enter the InDrive/fuel fare and riders (including you).</Text>
 <Text style={s.lbl}>Distance (km)</Text><In value={d} onChangeText={setD} keyboardType="numeric"/><Text style={s.lbl}>Total fare (Rs)</Text><In value={fare} onChangeText={setFare} keyboardType="numeric"/><Text style={s.lbl}>People sharing</Text><In value={n} onChangeText={setN} keyboardType="numeric"/>
 <Btn t="Calculate" onPress={calc} style={{marginTop:14}}/>{r&&<View style={[s.card,{backgroundColor:C.mint,marginTop:14}]}><Text style={{fontSize:28,fontWeight:'800'}}>Rs. {r.per} each</Text><Text style={s.mute}>Rs. {r.km}/km total · you save Rs. {Math.round(+fare-r.per)} vs going solo</Text></View>}</>}
const s=StyleSheet.create({fill:{flex:1,backgroundColor:C.cream},pad:{padding:20,paddingBottom:100,paddingTop:Platform.OS==='android'?40:20},logo:{fontSize:64,fontWeight:'900',fontStyle:'italic',color:C.ink},h1:{fontSize:32,fontWeight:'800',fontStyle:'italic',color:C.ink,marginBottom:10},h2:{fontSize:24,fontWeight:'800',color:C.ink,marginBottom:4},mute:{color:C.mute},lbl:{fontWeight:'700',marginTop:14,marginBottom:2,color:C.ink},
 btn:{padding:16,borderRadius:16,alignItems:'center'},btnT:{color:'#fff',fontWeight:'700',fontSize:16},in:{backgroundColor:'#fff',borderRadius:14,padding:14,marginVertical:6,borderWidth:1,borderColor:'#eadfbe',color:C.ink},chip:{backgroundColor:'#fff',paddingVertical:10,paddingHorizontal:14,borderRadius:20,marginRight:8,borderWidth:1,borderColor:'#eadfbe'},day:{width:38,height:38,borderRadius:19,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#eadfbe'},
 card:{backgroundColor:'#fff',borderRadius:18,padding:16,marginTop:12,shadowColor:'#000',shadowOpacity:.06,shadowRadius:8,elevation:2},name:{fontSize:17,fontWeight:'700'},badge:{backgroundColor:C.y,paddingHorizontal:10,paddingVertical:3,borderRadius:10,fontWeight:'700',overflow:'hidden'},pill:{backgroundColor:C.lav,paddingHorizontal:12,paddingVertical:6,borderRadius:14,overflow:'hidden'},
 tabs:{position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',justifyContent:'space-around',alignItems:'center',backgroundColor:'#fff',paddingVertical:10,borderTopWidth:1,borderColor:'#eee'}});
