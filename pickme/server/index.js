require('dotenv').config();
const express=require('express'),cors=require('cors'),mongoose=require('mongoose'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const app=express();app.use(cors());app.use(express.json());
const SECRET=process.env.JWT_SECRET||'pickme-dev';
const {User,Commute,SavedLocation,Notification,Request,Trip,Rating,Report}=require('./models');
const {km,getRoute,routeOverlap}=require('./services/routing');

const h=f=>(q,s)=>Promise.resolve(f(q,s)).catch(e=>s.status(500).json({error:e.message}));
const auth=(q,s,n)=>{try{q.uid=jwt.verify((q.headers.authorization||'').slice(7),SECRET).id;n()}catch(e){s.status(401).json({error:'Please log in'})}};
const norm=p=>{p=(p||'').replace(/\D/g,'');return p.startsWith('0')?'92'+p.slice(1):p};
const pub=u=>({_id:u._id,name:u.name,phone:u.phone,email:u.email,verified:u.verified,gender:u.gender,city:u.city,rideCapability:u.rideCapability||'need',vehicle:u.vehicle||null});
const mins=t=>{const[a,b]=(t||'08:00').split(':').map(Number);return a*60+b};
const tok=u=>({token:jwt.sign({id:u._id},SECRET,{expiresIn:'30d'}),user:pub(u)});
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ---- auth: register / login / user detail
app.post('/api/register',h(async(q,s)=>{
  const{name,email,cnic,password,gender,city}=q.body,phone=norm(q.body.phone);
  if(!name||!/^92\d{10}$/.test(phone))return s.status(400).json({error:'Enter a valid phone like 03001234567'});
  if(!/^\d{13}$/.test((cnic||'').replace(/\D/g,'')))return s.status(400).json({error:'CNIC must be 13 digits'});
  if((password||'').length<6)return s.status(400).json({error:'Password needs 6+ characters'});
  if(await User.findOne({phone}))return s.status(400).json({error:'Phone already registered - log in instead'});
  const u=await User.create({name,phone,email,cnic:cnic.replace(/\D/g,''),password:await bcrypt.hash(password,8),verified:false,gender:gender||'male',city:city||''});
  s.json(tok(u));
}));

app.post('/api/login',h(async(q,s)=>{const u=await User.findOne({phone:norm(q.body.phone)});
  if(!u||!await bcrypt.compare(q.body.password||'',u.password))return s.status(400).json({error:'Wrong phone or password'});s.json(tok(u));
}));

app.get('/api/users/:id',h(async(q,s)=>{const u=await User.findById(q.params.id);if(!u)return s.status(404).json({error:'Not found'});
  const rs=await Rating.find({toUser:u._id}).sort('-createdAt').limit(10).lean();
  const names=Object.fromEntries((await User.find({_id:{$in:rs.map(r=>r.fromUser)}})).map(x=>[x._id,x.name]));
  s.json({user:pub(u),avg:rs.length?+(rs.reduce((a,r)=>a+r.stars,0)/rs.length).toFixed(1):0,count:rs.length,reviews:rs.map(r=>({stars:r.stars,comment:r.comment,from:names[r.fromUser]}))});
}));

// profile edit
app.put('/api/users/:id',auth,h(async(q,s)=>{const u=await User.findById(q.params.id);if(!u)return s.status(404).json({error:'Not found'});
  if(String(u._id)!==q.uid)return s.status(403).json({error:'Not yours'});
  const{name,city,gender,rideCapability}=q.body;
  if(name!==undefined)u.name=name;if(city!==undefined)u.city=city;if(gender!==undefined)u.gender=gender;if(rideCapability!==undefined)u.rideCapability=rideCapability;
  s.json(await u.save());
}));

app.put('/api/users/:id/vehicle',auth,h(async(q,s)=>{const u=await User.findById(q.params.id);if(!u)return s.status(404).json({error:'Not found'});
  if(String(u._id)!==q.uid)return s.status(403).json({error:'Not yours'});u.vehicle=q.body;await u.save();s.json({vehicle:u.vehicle});}));

// ---- maps (OpenStreetMap Nominatim, free, no key)
app.get('/api/geocode',h(async(q,s)=>{const r=await(await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=pk&q='+encodeURIComponent(q.query.q||''),NH)).json();
  s.json(r.map(x=>({name:x.display_name.split(',').slice(0,3).join(','),lat:+x.lat,lng:+x.lon})));}));

app.get('/api/reverse',h(async(q,s)=>{const{lat,lng}=q.query;const r=await(await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,NH)).json();
  s.json({name:(r.display_name||'Pinned location').split(',').slice(0,3).join(','),lat:+lat,lng:+lng});}));

app.get('/api/route',h(async(q,s)=>{const{lat1,lng1,lat2,lng2}=q.query;const r=await getRoute({lat:+lat1,lng:+lng1},{lat:+lat2,lng:+lng2});s.json(r||{});}));

// ---- saved locations
app.get('/api/locations',auth,h(async(q,s)=>s.json(await SavedLocation.find({userId:q.uid}).sort('-createdAt'))));
app.post('/api/locations',auth,h(async(q,s)=>s.json(await SavedLocation.create({userId:q.uid,...q.body}))));
app.put('/api/locations/:id',auth,h(async(q,s)=>{const l=await SavedLocation.findOneAndUpdate({_id:q.params.id,userId:q.uid},q.body,{new:true});if(!l)return s.status(404).json({error:'Not found'});s.json(l);}));
app.delete('/api/locations/:id',auth,h(async(q,s)=>{await SavedLocation.deleteOne({_id:q.params.id,userId:q.uid});s.json({ok:true});}));

// ---- commutes
app.post('/api/commutes',auth,h(async(q,s)=>{const b=q.body;if(!b.origin||!b.dest)return s.status(400).json({error:'Pick both locations'});
  if(!Array.isArray(b.days)||b.days.length===0)return s.status(400).json({error:'Select at least one commute day'});
  if(!b.startDate||!b.endDate||b.endDate<b.startDate)return s.status(400).json({error:'Enter a valid date range'});
  if(!b.startTime||!b.endTime)return s.status(400).json({error:'Enter departure and return times'});
  if(!['need','offer','either'].includes(b.role||'need'))return s.status(400).json({error:'Choose a ride type'});
  const route=await getRoute(b.origin,b.dest);const seats=+b.seats||1;
  const c=await Commute.create({...b,userId:q.uid,seats,price:+b.price||0,routeGeo:route?.points||[],distanceKm:route?.distanceKm||+(km(b.origin,b.dest)*1.3).toFixed(1)});
  s.json(c);}));

app.get('/api/commutes/mine',auth,h(async(q,s)=>s.json(await Commute.find({userId:q.uid,active:true}).sort('-createdAt'))));

app.patch('/api/commutes/:id',auth,h(async(q,s)=>{const c=await Commute.findOne({_id:q.params.id,userId:q.uid});if(!c)return s.status(404).json({error:'Not found'});
  if(q.body.paused!==undefined)c.paused=q.body.paused;if(q.body.active!==undefined)c.active=q.body.active;
  ['origin','dest','days','startTime','endTime','startDate','endDate','role','seats','price'].forEach(k=>{if(q.body[k]!==undefined)c[k]=q.body[k]});
  s.json(await c.save());
}));
app.delete('/api/commutes/:id',auth,h(async(q,s)=>{await Commute.updateOne({_id:q.params.id,userId:q.uid},{active:false});s.json({ok:true});}));

// ---- matching engine v2
app.post('/api/match',auth,h(async(q,s)=>{const m=q.body,me=await User.findById(q.uid);
  const blocked=Array.isArray(me.blocked)?me.blocked:[];
  const cs=await Commute.find({active:true,paused:false,userId:{$ne:q.uid,$nin:blocked}}).populate('userId','name phone verified gender city rideCapability vehicle');
  const rs=await Rating.aggregate([{$group:{_id:'$toUser',avg:{$avg:'$stars'},count:{$sum:1}}}]);const R=Object.fromEntries(rs.map(r=>[String(r._id),r]));
  const out=[];
  const now=new Date().toISOString().slice(0,10);
  for(const c of cs){if(!c.userId)continue;
    if(c.endDate&&c.endDate<now)continue;
    if(m.startDate&&m.endDate&&c.startDate&&c.endDate&&(c.endDate<m.startDate||m.endDate<c.startDate))continue;
    if(c.seats<=0)continue;
    const compatible=(m.role==='either'||c.role==='either')||(m.role==='need'&&c.role==='offer')||(m.role==='offer'&&c.role==='need');
    if(!compatible)continue;
    const os=km(m.origin,c.origin),ds=km(m.dest,c.dest);
    let routeScore=0,distAlong=0;
    if(c.routeGeo&&c.routeGeo.length>1){
      const rr=routeOverlap(c.routeGeo,m.origin,m.dest);routeScore=rr.overlapScore;distAlong=rr.distAlongRoute;
    }else{
      const base=km(c.origin,c.dest);routeScore=Math.max(0,1-(os+ds)/Math.max(base,0.5));
    }
    const ts1=mins(m.startTime),te1=mins(m.endTime),ts2=mins(c.startTime),te2=mins(c.endTime);
    const overlapMin=Math.min(te1,te2)-Math.max(ts1,ts2);
    const timeScore=overlapMin>0?Math.min(1,overlapMin/Math.max(1,Math.min(te1-ts1,te2-ts2))):0;
    const dayScore=(m.days||[]).filter(z=>c.days.includes(z)).length/Math.max(1,(m.days||[]).length);
    const score=Math.round(100*(0.35*routeScore+0.2*timeScore+0.2*dayScore+0.1*Math.max(0,1-os/5)+0.05*Math.max(0,1-ds/5)+0.05));
    if(score>=25){
      const r=R[String(c.userId._id)]||{};
      const mDays=(m.days||[]).filter(z=>c.days.includes(z));
      out.push({...c.toObject(),score,originKm:+os.toFixed(1),destKm:+ds.toFixed(1),explanation:{
        routeOverlap:+((routeScore||0)*100).toFixed(0),
        timeOverlap:timeScore>0.8?'Similar departure':timeScore>0.5?'Partial overlap':'Different schedule',
        daysOverlap:mDays.length+'/'+(m.days||[]).length+' days'+(mDays.length===0?' (no overlap)':''),
        pickupAlongRoute:+distAlong.toFixed(1),
        seatsAvailable:c.seats
      },user:{...pub(c.userId),avg:r.avg?+r.avg.toFixed(1):0,count:r.count||0}});
    }
  }
  s.json(out.sort((a,b)=>b.score-a.score));
}));

// ---- join requests
app.post('/api/requests',auth,h(async(q,s)=>{const c=await Commute.findById(q.body.commuteId).populate('userId');if(!c)return s.status(404).json({error:'Commute not found'});
  if(String(c.userId._id)===q.uid)return s.status(400).json({error:'This is your own commute'});
  if(await Request.findOne({commuteId:c._id,fromUser:q.uid,status:{$in:['pending','accepted']}}))return s.status(400).json({error:'Already requested'});
  if(c.seats<=0)return s.status(400).json({error:'No seats available'});
  const fromUser=await User.findById(q.uid);
  const req=await Request.create({commuteId:c._id,fromUser:q.uid,toUser:c.userId._id});
  Notification.create({userId:c.userId._id,type:'request',message:`${fromUser.name} wants to join your ride`,rideId:c._id});
  s.json(req);}));

app.get('/api/requests',auth,h(async(q,s)=>{const pop=x=>x.populate('commuteId').populate('fromUser','name phone verified').populate('toUser','name phone verified');
  s.json({incoming:await pop(Request.find({toUser:q.uid}).sort('-createdAt')),outgoing:await pop(Request.find({fromUser:q.uid}).sort('-createdAt'))});}));

app.patch('/api/requests/:id',auth,h(async(q,s)=>{const r=await Request.findOne({_id:q.params.id,toUser:q.uid}).populate('fromUser','name phone');
  if(!r)return s.status(404).json({error:'Not found'});r.status=q.body.status;await r.save();
  if(q.body.status==='accepted'){const c=await Commute.findById(r.commuteId);if(c&&c.seats>0){c.seats--;await c.save()}
    Notification.create({userId:r.fromUser._id,type:'accepted',message:'Your ride request was accepted!',rideId:r.commuteId});}
  if(q.body.status==='rejected'){Notification.create({userId:r.fromUser._id,type:'rejected',message:'Your request was declined',rideId:r.commuteId});}
  s.json(r);}));

// ---- trips + cost split
app.post('/api/trips',auth,h(async(q,s)=>{const{commuteId,distanceKm,fare}=q.body,c=await Commute.findOne({_id:commuteId,userId:q.uid});if(!c)return s.status(403).json({error:'Not your commute'});
  const rq=await Request.find({commuteId,status:'accepted'});if(!rq.length)return s.status(400).json({error:'No accepted riders yet'});
  if(!(+fare>0))return s.status(400).json({error:'Enter the total fare'});
  const t=await Trip.create({commuteId,driverId:q.uid,riders:rq.map(r=>r.fromUser),origin:c.origin,dest:c.dest,distanceKm:+distanceKm,fare:+fare,perPerson:Math.round(+fare/(rq.length+1)),status:'completed'});
  await Request.updateMany({commuteId,status:'accepted'},{status:'completed',tripId:t._id});s.json(t);}));

app.get('/api/trips/mine',auth,h(async(q,s)=>{const ts=await Trip.find({$or:[{driverId:q.uid},{riders:q.uid}]}).sort('-createdAt').populate('driverId riders','name phone').lean();
  const rs=await Rating.find({fromUser:q.uid,tripId:{$in:ts.map(t=>t._id)}});
  s.json(ts.map(t=>({...t,rated:rs.filter(r=>String(r.tripId)===String(t._id)).map(r=>String(r.toUser))})));}));

app.patch('/api/trips/:id/status',auth,h(async(q,s)=>{const t=await Trip.findById(q.params.id);if(!t)return s.status(404).json({error:'Not found'});
  if(String(t.driverId)!==q.uid&&!t.riders.includes(q.uid))return s.status(403).json({error:'Not a participant'});
  t.status=q.body.status;await t.save();s.json(t);}));

// ---- ratings
app.post('/api/ratings',auth,h(async(q,s)=>{const{tripId,toUser,stars,comment}=q.body,t=await Trip.findById(tripId);
  const ids=t?[String(t.driverId),...t.riders.map(String)]:[];
  if(!ids.includes(q.uid)||!ids.includes(String(toUser))||q.uid===String(toUser))return s.status(403).json({error:'Not allowed'});
  if(await Rating.findOne({tripId,fromUser:q.uid,toUser}))return s.status(400).json({error:'Already rated'});
  s.json(await Rating.create({tripId,fromUser:q.uid,toUser,stars:Math.min(5,Math.max(1,+stars)),comment}));}));

// ---- notifications
app.get('/api/notifications',auth,h(async(q,s)=>{const n=await Notification.find({userId:q.uid}).sort('-createdAt').limit(50).lean();s.json(n);}));
app.patch('/api/notifications/read',auth,h(async(q,s)=>{await Notification.updateMany({userId:q.uid,read:false},{read:true});s.json({ok:true});}));

// ---- safety
app.post('/api/report',auth,h(async(q,s)=>{await Report.create({fromUser:q.uid,againstUser:q.body.userId,reason:q.body.reason,description:q.body.description||''});s.json({ok:true});}));
app.post('/api/block',auth,h(async(q,s)=>{await User.updateOne({_id:q.uid},{$addToSet:{blocked:q.body.userId}});await User.updateOne({_id:q.body.userId},{$addToSet:{blockedBy:q.uid}});s.json({ok:true});}));
app.get('/api/safety',h(async(q,s)=>s.json({
  guidelines:['Verify your ride details before getting in','Share your trip with a trusted contact','Report unsafe behavior immediately','Keep your phone charged during the ride','Confirm your driver through in-app or WhatsApp before boarding']
})));

// ---- seed
async function seed(){
  if(await User.countDocuments())return;
  const pw=await bcrypt.hash('demo1234',8);
  const L={g10:{name:'G-10, Islamabad',lat:33.6819,lng:73.0117},f10:{name:'F-10, Islamabad',lat:33.6938,lng:73.0136},i8:{name:'I-8, Islamabad',lat:33.6644,lng:73.0765},sad:{name:'Saddar, Rawalpindi',lat:33.5983,lng:73.0479},sat:{name:'Satellite Town, Rawalpindi',lat:33.6376,lng:73.0666}};
  const us=await User.insertMany([['Ahmed Khan','923000000001'],['Sara Ali','923000000002'],['Usman Tariq','923000000003']].map(([name,phone])=>({
    name,phone,email:name[0]+'@demo.com',cnic:'3520212345671',password:pw,verified:true,gender:'male',city:'Islamabad',rideCapability:'offer',vehicle:{make:'Toyota',model:'Vitz',type:'Hatchback',color:'White',seats:5}
  })));
  const d=new Date().toISOString().slice(0,10),e=new Date(Date.now()+60*864e5).toISOString().slice(0,10);
  const seeds=[[0,'g10','sad','08:30','09:00','offer',2,250,[0,1,2,3,4]],[1,'f10','sad','09:15','09:45','offer',3,300,[0,1,2,3,4]],[2,'i8','sat','09:45','10:15','offer',2,280,[0,2,4]]];
  for(const [i,o,t,a,b,role,seats,price,days] of seeds){
    const r=await getRoute(L[o],L[t]);
    await Commute.create({userId:us[i]._id,origin:L[o],dest:L[t],startTime:a,endTime:b,role,seats,price,days,startDate:d,endDate:e,routeGeo:r?.points||[],distanceKm:r?.distanceKm||0});
  }
  await Rating.insertMany([{toUser:us[0]._id,stars:5,fromUser:us[1]._id,comment:'Punctual and friendly'},{toUser:us[0]._id,stars:4,fromUser:us[2]._id},{toUser:us[1]._id,stars:5,fromUser:us[0]._id,comment:'Great ride'}]);
  console.log('Seeded demo data (login 03000000001 / demo1234)');
}

async function start() {
  if(!process.env.MONGO_URL) throw new Error('Missing MONGO_URL in server/.env');
  await mongoose.connect(process.env.MONGO_URL);
  await seed();
  return app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('PickMe API up'));
}

module.exports = { app, start };

if(require.main===module){
  start().catch(e=>{console.error(e.message);process.exit(1)});
}