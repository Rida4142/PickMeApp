import React,{useState,useRef,useEffect} from 'react';
import {Animated,View,Text,TouchableOpacity,Platform} from 'react-native';
import {api} from './api';
import {C,s,In} from './ui';
import {getCurrentGeneralLocation} from './utils/location';
const WebView=Platform.OS==='web'?null:require('react-native-webview').WebView;
const html=(o,d)=>`<!DOCTYPE html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>html,body,#m{height:100%;margin:0}.leaflet-tooltip{border:0;border-radius:10px;background:#17233E;color:#fff;font-weight:700;box-shadow:0 3px 10px #17233E22}.leaflet-tooltip:before{display:none}.pickme-pin{transform-box:fill-box;transform-origin:center;animation:pin-pop 240ms cubic-bezier(.2,.8,.2,1) both}@keyframes pin-pop{from{transform:scale(.55);opacity:.4}to{transform:scale(1);opacity:1}}</style></head><body><div id=m></div><script>
var o=${JSON.stringify(o||null)},d=${JSON.stringify(d||null)};
var m=L.map('m').setView([30.37,69.34],5),g=L.layerGroup().addTo(m);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
function pin(p,c,t){L.circleMarker([p.lat,p.lng],{radius:9,color:'#fff',weight:2,fillColor:c,fillOpacity:1,className:'pickme-pin'}).bindTooltip(t,{permanent:true}).addTo(g)}
var b=[];if(o){pin(o,'#4054E8','From');b.push([o.lat,o.lng])}if(d){pin(d,'#FF705B','To');b.push([d.lat,d.lng])}
if(o&&d){var route=L.polyline(b,{color:'#4054E8',weight:4,opacity:.9,lineCap:'round'}).addTo(g);var path=route.getElement();if(path){var length=path.getTotalLength();path.style.strokeDasharray=length;path.style.strokeDashoffset=length;path.getBoundingClientRect();path.style.transition='stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)';path.style.strokeDashoffset=0}}if(b.length)m.fitBounds(b,{padding:[50,50],maxZoom:15});
m.on('click',function(e){var x=JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng});window.ReactNativeWebView?window.ReactNativeWebView.postMessage(x):parent.postMessage(x,'*')});
</script></body></html>`;
export default function RoutePicker({o,d,setO,setD}){
 const [act,setAct]=useState(o?'d':'o'),[q,setQ]=useState({o:o?.name||'',d:d?.name||''}),[opts,setOpts]=useState([]),t=useRef();
 const [locationState,setLocationState]=useState({status:'idle',message:''});
 const [locationBusy,setLocationBusy]=useState('');
 const [approximateLocationName,setApproximateLocationName]=useState('');
 const originPin=useRef(new Animated.Value(1)).current,destinationPin=useRef(new Animated.Value(1)).current;
 const animatePin=key=>{const pin=key==='o'?originPin:destinationPin;pin.setValue(0.62);Animated.spring(pin,{toValue:1,speed:22,bounciness:8,useNativeDriver:true}).start()};
 useEffect(()=>{setQ({o:o?.name||'',d:d?.name||''});if(approximateLocationName&&o?.name!==approximateLocationName&&d?.name!==approximateLocationName){setLocationState({status:'idle',message:''});setApproximateLocationName('')}},[o?.name,d?.name,approximateLocationName]);
 useEffect(()=>{if(o)animatePin('o');if(d)animatePin('d')},[o?.lat,o?.lng,d?.lat,d?.lng]);
 const choose=p=>{(act==='o'?setO:setD)(p);setQ(x=>({...x,[act]:p.name}));setOpts([]);setLocationState({status:'idle',message:''});setApproximateLocationName('');if(act==='o')setAct('d')};
 const useCurrentLocation=async key=>{
   setAct(key);setLocationBusy(key);setLocationState({status:'loading',message:''});
   try{
     const location=await getCurrentGeneralLocation();
     const point={name:location.publicLabel,lat:Number(location.privateCoordinates.lat.toFixed(2)),lng:Number(location.privateCoordinates.lng.toFixed(2))};
    (key==='o'?setO:setD)(point);setQ(current=>({...current,[key]:point.name}));setOpts([]);setApproximateLocationName(point.name);setLocationState({status:'ready',message:'Approximate area selected. Your exact location is not shared.'});animatePin(key);
   }catch(error){
     const denied=/permission|denied/i.test(error.message||'');
     setLocationState({status:'error',message:denied?'Location access is off. Enter an area or choose a point on the map.':'Could not get your current location. Search for an area or choose a point on the map.'});
   }finally{setLocationBusy('')}
 };
 const onMap=async m=>{let p={lat:m.lat,lng:m.lng,name:m.lat.toFixed(4)+', '+m.lng.toFixed(4)};try{p=await api(`/api/reverse?lat=${m.lat}&lng=${m.lng}`)}catch{}choose(p)};
 useEffect(()=>{if(Platform.OS!=='web')return;const f=e=>{try{if(typeof e.data==='string')onMap(JSON.parse(e.data))}catch{}};window.addEventListener('message',f);return()=>{window.removeEventListener('message',f);clearTimeout(t.current)}},[act]);
 const type=(k,txt)=>{setQ(x=>({...x,[k]:txt}));setAct(k);setLocationState({status:'idle',message:''});setApproximateLocationName('');clearTimeout(t.current);if(txt.length<3)return setOpts([]);t.current=setTimeout(()=>api('/api/geocode?q='+encodeURIComponent(txt)).then(setOpts).catch(()=>{}),600)};
 const src=html(o,d);
 return <View>
    {[['o','FROM','Area, campus or landmark'],['d','TO','Destination or landmark']].map(([k,label,placeholder])=><View key={k} style={s.routeFieldBlock}>
     <Text style={s.routeFieldLabel}>{label}</Text>
     <View style={s.routeInputRow}><Animated.View style={[s.routeDot,{backgroundColor:k==='o'?C.blue:C.accent,transform:[{scale:k==='o'?originPin:destinationPin}]}]} /><In style={[s.routeInput,act===k&&{borderColor:C.blue,borderWidth:2}]} placeholder={placeholder} value={q[k]} onFocus={()=>setAct(k)} onChangeText={x=>type(k,x)}/></View>
     <TouchableOpacity style={s.currentLocationButton} onPress={()=>useCurrentLocation(k)} disabled={!!locationBusy} activeOpacity={0.82}><View style={s.currentLocationIcon}><Text style={s.currentLocationIconText}>⌖</Text></View><Text style={s.currentLocationText}>{locationBusy===k?'Finding nearby area…':'Use current location'}</Text></TouchableOpacity>
    </View>)}
  {opts.map((p,i)=><TouchableOpacity key={i} onPress={()=>choose(p)} style={s.locationSuggestion}><View style={s.locationSuggestionPin}><Text style={s.currentLocationIconText}>•</Text></View><Text style={s.locationSuggestionText}>{p.name}</Text></TouchableOpacity>)}
  {!!locationState.message&&<Text style={[s.locationNotice,locationState.status==='error'&&s.locationNoticeError]}>{locationState.message}</Text>}
  <Text style={s.mapCaption}>Choose your stops by searching or dropping pins</Text>
    <View style={s.mapFrame}>
   {Platform.OS==='web'?React.createElement('iframe',{key:src,srcDoc:src,style:{width:'100%',height:'100%',border:0}}):<WebView key={src} originWhitelist={['*']} source={{html:src}} onMessage={e=>{try{onMap(JSON.parse(e.nativeEvent.data))}catch{}}}/>}
  </View></View>}
