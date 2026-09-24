import React,{useState,useRef,useEffect} from 'react';
import {View,Text,TouchableOpacity,Platform} from 'react-native';
import {api} from './api';
import {C,s,In} from './ui';
const WebView=Platform.OS==='web'?null:require('react-native-webview').WebView;
const html=(o,d)=>`<!DOCTYPE html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><style>html,body,#m{height:100%;margin:0}</style></head><body><div id=m></div><script>
var o=${JSON.stringify(o||null)},d=${JSON.stringify(d||null)};
var m=L.map('m').setView([30.37,69.34],5),g=L.layerGroup().addTo(m);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
function pin(p,c,t){L.circleMarker([p.lat,p.lng],{radius:9,color:'#fff',weight:2,fillColor:c,fillOpacity:1}).bindTooltip(t,{permanent:true}).addTo(g)}
var b=[];if(o){pin(o,'#22a06b','From');b.push([o.lat,o.lng])}if(d){pin(d,'#e5484d','To');b.push([d.lat,d.lng])}
if(o&&d)L.polyline(b,{color:'#4F46E5',dashArray:'6'}).addTo(g);if(b.length)m.fitBounds(b,{padding:[50,50],maxZoom:15});
m.on('click',function(e){var x=JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng});window.ReactNativeWebView?window.ReactNativeWebView.postMessage(x):parent.postMessage(x,'*')});
</script></body></html>`;
export default function RoutePicker({o,d,setO,setD}){
 const [act,setAct]=useState(o?'d':'o'),[q,setQ]=useState({o:o?.name||'',d:d?.name||''}),[opts,setOpts]=useState([]),t=useRef();
 const choose=p=>{(act==='o'?setO:setD)(p);setQ(x=>({...x,[act]:p.name}));setOpts([]);if(act==='o')setAct('d')};
 const onMap=async m=>{let p={lat:m.lat,lng:m.lng,name:m.lat.toFixed(4)+', '+m.lng.toFixed(4)};try{p=await api(`/api/reverse?lat=${m.lat}&lng=${m.lng}`)}catch{}choose(p)};
 useEffect(()=>{if(Platform.OS!=='web')return;const f=e=>{try{if(typeof e.data==='string')onMap(JSON.parse(e.data))}catch{}};window.addEventListener('message',f);return()=>window.removeEventListener('message',f)},[act]);
 const type=(k,txt)=>{setQ(x=>({...x,[k]:txt}));setAct(k);clearTimeout(t.current);if(txt.length<3)return setOpts([]);t.current=setTimeout(()=>api('/api/geocode?q='+encodeURIComponent(txt)).then(setOpts).catch(()=>{}),600)};
 const src=html(o,d);
 return <View>
    {[['o','From (type an area, or tap map)'],['d','To (type an area, or tap map)']].map(([k,ph])=><View key={k} style={s.routeInputRow}>
     <View style={[s.routeDot,{backgroundColor:k==='o'?'#22A06B':'#E5484D'}]} /><In style={[s.routeInput,act===k&&{borderColor:C.blue,borderWidth:2}]} placeholder={ph} value={q[k]} onFocus={()=>setAct(k)} onChangeText={x=>type(k,x)}/></View>)}
  {opts.map((p,i)=><TouchableOpacity key={i} onPress={()=>choose(p)} style={{padding:10,backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#eee'}}><Text>📍 {p.name}</Text></TouchableOpacity>)}
  <Text style={[s.mute,{marginVertical:4}]}>Editing: {act==='o'?'From':'To'} — tap the map to drop a pin</Text>
    <View style={s.mapFrame}>
   {Platform.OS==='web'?React.createElement('iframe',{key:src,srcDoc:src,style:{width:'100%',height:'100%',border:0}}):<WebView key={src} originWhitelist={['*']} source={{html:src}} onMessage={e=>{try{onMap(JSON.parse(e.nativeEvent.data))}catch{}}}/>}
  </View></View>}
