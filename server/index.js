const express=require('express'),cors=require('cors'),fs=require('fs');
const app=express();app.use(cors());app.use(express.json());
const F=__dirname+'/data.json';
const PLACES=[["Islamabad G-10",33.6819,73.0117],["Islamabad F-10",33.6938,73.0136],["Islamabad Blue Area",33.7104,73.0551],["Islamabad I-8",33.6644,73.0765],["Rawalpindi Saddar",33.5983,73.0479],["Rawalpindi Satellite Town",33.6376,73.0666],["Bahria Town",33.5271,73.1085],["Faisalabad D-Ground",31.4187,73.0791],["Faisalabad Jaranwala Rd",31.4300,73.1200],["Lahore Gulberg",31.5204,74.3587]].map(([name,lat,lng])=>({name,lat,lng}));
const P=n=>PLACES.find(p=>p.name===n);
const km=(a,b)=>{const r=x=>x*Math.PI/180,dl=r(b.lat-a.lat),dg=r(b.lng-a.lng);const h=Math.sin(dl/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dg/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const mins=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
function load(){if(!fs.existsSync(F)){const u=[["Ahmed Khan","923001234567"],["Sara Ali","923011234567"],["Usman Tariq","923021234567"],["Hina Raza","923031234567"]].map(([name,phone],i)=>({id:'u'+(i+1),name,phone,email:name.split(' ')[0].toLowerCase()+'@mail.com',cnic:'3520212345671',verified:true}));
const c=[["u1","Islamabad G-10","Rawalpindi Saddar","08:30","09:00","offer",2,250,[0,1,2,3,4]],["u2","Islamabad F-10","Rawalpindi Saddar","09:15","09:45","offer",3,300,[0,1,2,3,4]],["u3","Islamabad I-8","Rawalpindi Satellite Town","09:45","10:15","offer",2,280,[0,2,4]],["u4","Faisalabad D-Ground","Faisalabad Jaranwala Rd","08:00","08:30","need",1,0,[0,1,2,3,4]]].map(([userId,origin,dest,startTime,endTime,role,seats,price,days],i)=>({id:'c'+(i+1),userId,origin,dest,startTime,endTime,role,seats,price,days}));
const r=[{toUser:'u1',stars:5},{toUser:'u1',stars:4},{toUser:'u2',stars:5},{toUser:'u3',stars:4}];
fs.writeFileSync(F,JSON.stringify({users:u,commutes:c,requests:[],ratings:r,trips:[]},null,1))}
return JSON.parse(fs.readFileSync(F))}
const save=d=>fs.writeFileSync(F,JSON.stringify(d,null,1));
const rating=(d,id)=>{const r=d.ratings.filter(x=>x.toUser===id);return{avg:r.length?+(r.reduce((s,x)=>s+x.stars,0)/r.length).toFixed(1):0,count:r.length}};
app.get('/api/places',(q,s)=>s.json(PLACES));
app.post('/api/users',(q,s)=>{const d=load(),{name,phone,email,cnic}=q.body;
if(!name||!/^92\d{10}$|^0\d{10}$/.test(phone||''))return s.status(400).json({error:'Enter phone like 03001234567'});
if(!/^\d{13}$/.test(cnic||''))return s.status(400).json({error:'CNIC must be 13 digits'});
const p=phone.startsWith('0')?'92'+phone.slice(1):phone;let u=d.users.find(x=>x.phone===p);
if(!u){u={id:'u'+Date.now(),name,phone:p,email,cnic,verified:false};d.users.push(u);save(d)}s.json(u)});
app.post('/api/commutes',(q,s)=>{const d=load(),c={id:'c'+Date.now(),seats:1,price:0,role:'need',...q.body};d.commutes.push(c);save(d);s.json(c)});
app.get('/api/commutes/:uid',(q,s)=>s.json(load().commutes.filter(c=>c.userId===q.params.uid)));
// MATCHING: origin 30% + destination 30% + time overlap 25% + day overlap 15%
app.post('/api/match',(q,s)=>{const d=load(),m=q.body,o=P(m.origin),t=P(m.dest);if(!o||!t)return s.json([]);
const out=[];for(const c of d.commutes){if(c.userId===m.userId)continue;
const co=P(c.origin),ct=P(c.dest);if(!co||!ct)continue;
const os=Math.max(0,1-km(o,co)/5),ds=Math.max(0,1-km(t,ct)/5);
const a=mins(m.startTime),b=mins(m.endTime),x=mins(c.startTime),y=mins(c.endTime);
const ov=Math.max(0,Math.min(b,y)-Math.max(a,x)),ts=Math.min(1,ov/Math.max(1,Math.min(b-a,y-x)));
const days=m.days||[0,1,2,3,4],ys=days.filter(z=>c.days.includes(z)).length/Math.max(1,days.length);
const score=Math.round(100*(.3*os+.3*ds+.25*ts+.15*ys));
if(score>=40){const u=d.users.find(z=>z.id===c.userId);out.push({...c,score,user:{...u,cnic:undefined,email:undefined,...rating(d,u.id)}})}}
s.json(out.sort((a,b)=>b.score-a.score))});
app.post('/api/requests',(q,s)=>{const d=load();d.requests.push({id:'r'+Date.now(),status:'pending',...q.body});save(d);s.json({ok:true})});
app.post('/api/ratings',(q,s)=>{const d=load();d.ratings.push(q.body);save(d);s.json(rating(d,q.body.toUser))});
app.post('/api/trips',(q,s)=>{const d=load(),{fare,riders}=q.body,t={id:'t'+Date.now(),...q.body,perPerson:Math.round(fare/riders)};d.trips.push(t);save(d);s.json(t)});
app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('PickMe API up'));
