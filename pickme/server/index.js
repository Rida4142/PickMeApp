require('dotenv').config();
const express=require('express'),cors=require('cors'),mongoose=require('mongoose'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const {randomUUID}=require('node:crypto'),multer=require('multer'),cloudinary=require('cloudinary').v2;
const app=express();app.use(cors());app.use(express.json());
const SECRET=process.env.JWT_SECRET||'pickme-dev';
const cloudinaryConfigured=Boolean(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET);
if(cloudinaryConfigured)cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
const {User,Commute,SavedLocation,Notification,Request,Booking,Buddy,Invitation,Trip,Rating,Report}=require('./models');
const {NH,km,getRoute,routeOverlap}=require('./services/routing');

const h=f=>(q,s)=>Promise.resolve(f(q,s)).catch(e=>s.status(500).json({error:e.message}));
const auth=(q,s,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),SECRET);q.uid=q.user.id;n()}catch(e){s.status(401).json({error:'Please log in'})}};
const norm=p=>{p=(p||'').replace(/\D/g,'');return p.startsWith('0')?'92'+p.slice(1):p};
const photoMimeTypes=new Set(['image/jpeg','image/png','image/webp']);
const parseProfilePhoto=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1}}).single('photo');
const handleProfilePhotoUpload=(q,s,n)=>parseProfilePhoto(q,s,error=>{if(!error)return n();if(error instanceof multer.MulterError)return s.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'Profile photos must be 5 MB or smaller':'Invalid photo upload'});s.status(400).json({error:'Invalid photo upload'});});
const locationFields=body=>{const fields={};for(const key of ['label','name','lat','lng','type'])if(body[key]!==undefined)fields[key]=body[key];return fields;};
const notify=data=>Notification.create(data).catch(error=>{console.error('Notification create failed',error.message);return null;});
const generalizeLabel=value=>{
  const name=String(value||'').trim();if(!name)return null;
  if(/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(name))return 'General area';
  const parts=name.split(',').map(part=>part.trim()).filter(Boolean);
  const addressPart=part=>/^(?:#?\d+\b|house\b|flat\b|apartment\b|apt\b|unit\b|plot\b|building\b|floor\b|street\b|st\.?\b|road\b|rd\.?\b|lane\b|avenue\b|ave\.?\b|drive\b|dr\.?\b)/i.test(part)||/\b(?:street|road|lane|avenue|drive|apartment|flat|house)\b/i.test(part);
  const areas=parts.filter(part=>!addressPart(part));
  return areas.slice(-2).join(', ')||'General area';
};
const privacyFields=['name','profileImage','location','email','phone','gender'];
const privacyStates=new Set(['visible','contact-only','hidden']);
const savedLocationTypes=new Set(['Home','University','Work','Other']);
const uploadProfilePhoto=(buffer,userId)=>new Promise((resolve,reject)=>{const stream=cloudinary.uploader.upload_stream({resource_type:'image',folder:'pickme/profile-photos',public_id:`${userId}-${randomUUID()}`,overwrite:false,transformation:[{width:512,height:512,crop:'fill',gravity:'auto',quality:'auto',fetch_format:'auto'}]},(error,result)=>error?reject(error):resolve(result));stream.end(buffer);});
const deleteProfilePhotoAsset=async publicId=>{const result=await cloudinary.uploader.destroy(publicId,{resource_type:'image',invalidate:true});if(!['ok','not found'].includes(result?.result))throw new Error('Cloudinary did not confirm photo deletion');};
const privacyDefaults={name:'visible',profileImage:'visible',location:'visible',email:'contact-only',phone:'contact-only',gender:'visible'};
const pub=(u,{isOwner=false,hasContact=false}={})=>{
  const rawVehicle=u.vehicleId||u.vehicle;
  const vehicle=rawVehicle?.toObject?rawVehicle.toObject():rawVehicle;
  const safeVehicle=vehicle&&(vehicle.make||vehicle.model||vehicle.type||vehicle.color||vehicle.passengerCapacity||vehicle.seats)?{make:vehicle.make||'',model:vehicle.model||'',type:vehicle.type||'',color:vehicle.color||'',passengerCapacity:+vehicle.passengerCapacity||+vehicle.seats||0,active:vehicle.active!==false}:null;
  const canView=field=>{if(isOwner)return true;const visibility=u.privacy?.[field]??privacyDefaults[field];return visibility==='visible'||(visibility==='contact-only'&&hasContact);};
  return {_id:u._id,name:canView('name')?u.name:'PickMe rider',phone:canView('phone')?u.phone:null,email:canView('email')?u.email:null,profileImage:canView('profileImage')?u.profileImage||null:null,verified:u.verified,gender:canView('gender')?u.gender:null,city:canView('location')?generalizeLabel(u.currentLocation?.publicLabel||u.city):null,vehicle:safeVehicle,...(isOwner?{privacy:{...privacyDefaults,...(u.privacy?.toObject?.()||u.privacy||{})}}:{})};
};
const acceptedContactIds=async(viewerId,userIds)=>{
  const ids=[...new Set(userIds.filter(Boolean).map(String))].filter(id=>id!==String(viewerId));
  if(!viewerId||!ids.length)return new Set();
  const [requests,bookings]=await Promise.all([
    Request.find({status:{$in:['accepted','completed']},$or:[{fromUser:viewerId,toUser:{$in:ids}},{toUser:viewerId,fromUser:{$in:ids}}]}).select('fromUser toUser').lean(),
    Booking.find({status:{$in:['confirmed','completed']},$or:[{passengerId:viewerId,acceptedBy:{$in:ids}},{acceptedBy:viewerId,passengerId:{$in:ids}}]}).select('passengerId acceptedBy').lean(),
  ]);
  const contacts=new Set();
  for(const request of requests)contacts.add(String(String(request.fromUser)===String(viewerId)?request.toUser:request.fromUser));
  for(const booking of bookings)contacts.add(String(String(booking.passengerId)===String(viewerId)?booking.acceptedBy:booking.passengerId));
  return contacts;
};
const acceptedCommuteIds=async(viewerId,commuteIds)=>{
  const ids=[...new Set(commuteIds.filter(Boolean).map(String))];
  if(!viewerId||!ids.length)return new Set();
  const [requests,bookings]=await Promise.all([
    Request.distinct('commuteId',{commuteId:{$in:ids},status:{$in:['accepted','completed']},$or:[{fromUser:viewerId},{toUser:viewerId}]}),
    Booking.distinct('commuteId',{commuteId:{$in:ids},status:{$in:['confirmed','completed']},$or:[{passengerId:viewerId},{acceptedBy:viewerId}]}),
  ]);
  return new Set([...requests,...bookings].map(String));
};
const generalizeLocation=location=>{
  if(!location)return null;
  return {name:generalizeLabel(location.name)};
};
const publicCommute=(commute,{precise=false}={})=>{
  const result=commute?.toObject?commute.toObject():{...commute};
  if(result.userId&&typeof result.userId==='object')result.userId={_id:result.userId._id};
  if(!precise){result.origin=generalizeLocation(result.origin);result.dest=generalizeLocation(result.dest);delete result.routeGeo;}
  return result;
};
const mins=t=>{const[a,b]=(t||'08:00').split(':').map(Number);return a*60+b};
const tok=u=>({token:jwt.sign({id:u._id},SECRET,{expiresIn:'30d'}),user:pub(u,{isOwner:true})});
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const capacityOf=c=>Math.max(1,+c.passengerCapacity||+c.seats||1);
const confirmedBookingCount=async(commuteId,requestedDate,requestedDay)=>{const filter={commuteId,status:'confirmed'};if(requestedDate)filter.requestedDate=requestedDate;else if(requestedDay!==undefined)filter.requestedDay=requestedDay;return Booking.countDocuments(filter)};
const availableSeats=async(c,requestedDate,requestedDay)=>Math.max(0,capacityOf(c)-await confirmedBookingCount(c._id,requestedDate,requestedDay));
const bookingStats=async commuteIds=>Booking.aggregate([
  {$match:{status:'confirmed',commuteId:{$in:commuteIds}}},
  {$lookup:{from:'users',localField:'passengerId',foreignField:'_id',as:'passenger'}},
  {$unwind:'$passenger'},
  {$group:{_id:'$commuteId',count:{$sum:1}}},
]);
const visibleBookingGenderCounts=async(commuteIds,viewerId)=>{
  const bookings=await Booking.find({status:'confirmed',commuteId:{$in:commuteIds}}).select('commuteId passengerId').populate('passengerId','gender privacy').lean();
  const contacts=await acceptedContactIds(viewerId,bookings.map(booking=>booking.passengerId?._id));
  const counts={};
  for(const booking of bookings){
    const passenger=booking.passengerId;if(!passenger?.gender)continue;
    const visibility=passenger.privacy?.gender??privacyDefaults.gender;
    if(visibility==='hidden'||(visibility==='contact-only'&&!contacts.has(String(passenger._id))))continue;
    const commuteId=String(booking.commuteId);const genders=counts[commuteId]||(counts[commuteId]={});genders[passenger.gender]=(genders[passenger.gender]||0)+1;
  }
  return counts;
};
const dayIndex=date=>{const day=new Date(`${date}T00:00:00Z`).getUTCDay();return (day+6)%7;};
const nextCommuteDate=c=>{const today=new Date().toISOString().slice(0,10);const start=c.startDate&&c.startDate>today?c.startDate:today;for(let i=0;i<370;i+=1){const date=new Date(`${start}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+i);const value=date.toISOString().slice(0,10);if(c.endDate&&value>c.endDate)break;if((c.days||[]).includes(dayIndex(value)))return value;}return start;};

// ---- auth: register / login / user detail
app.post('/api/register',h(async(q,s)=>{
  const{name,email,cnic,password,gender,city}=q.body,phone=norm(q.body.phone);
  if(!name||!/^92\d{10}$/.test(phone))return s.status(400).json({error:'Enter a valid phone like 03001234567'});
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return s.status(400).json({error:'Enter a valid email address'});
  if(!gender||typeof gender!=='string'||!gender.trim())return s.status(400).json({error:'Select your gender'});
  if(!city||typeof city!=='string'||!city.trim())return s.status(400).json({error:'Enter your city or general location'});
  if(!/^\d{13}$/.test((cnic||'').replace(/\D/g,'')))return s.status(400).json({error:'CNIC must be 13 digits'});
  if((password||'').length<6)return s.status(400).json({error:'Password needs 6+ characters'});
  if(await User.findOne({phone}))return s.status(400).json({error:'Phone already registered - log in instead'});
  const suppliedLocation=q.body.currentLocation;
  const currentLocation=suppliedLocation?.publicLabel?{publicLabel:suppliedLocation.publicLabel,privateCoordinates:suppliedLocation.privateCoordinates,capturedAt:new Date()}: {publicLabel:city.trim()};
  const u=await User.create({name,phone,email,cnic:cnic.replace(/\D/g,''),password:await bcrypt.hash(password,8),verified:false,gender:gender.trim(),city:city.trim(),currentLocation});
  s.json(tok(u));
}));

app.post('/api/login',h(async(q,s)=>{const u=await User.findOne({phone:norm(q.body.phone)});
  if(!u||!await bcrypt.compare(q.body.password||'',u.password))return s.status(400).json({error:'Wrong phone or password'});s.json(tok(u));
}));

app.get('/api/users/:id',auth,h(async(q,s)=>{const u=await User.findById(q.params.id);if(!u)return s.status(404).json({error:'Not found'});
  const [summary]=await Rating.aggregate([{$match:{toUser:u._id}},{$group:{_id:null,average:{$avg:'$stars'},count:{$sum:1}}}]);
  const rs=await Rating.find({toUser:u._id}).sort('-createdAt').limit(10).lean();
  const reviewers=await User.find({_id:{$in:rs.map(r=>r.fromUser)}});
  const reviewerContacts=await acceptedContactIds(q.uid,reviewers.map(x=>x._id));
  const names=Object.fromEntries(reviewers.map(x=>[String(x._id),pub(x,{isOwner:String(x._id)===q.uid,hasContact:reviewerContacts.has(String(x._id))}).name||'PickMe user']));
  const rating={average:summary?.average?+summary.average.toFixed(1):0,count:summary?.count||0};
  const isOwner=String(u._id)===q.uid;
  const contacts=await acceptedContactIds(q.uid,[u._id]);
  s.json({user:pub(u,{isOwner,hasContact:contacts.has(String(u._id))}),rating,avg:rating.average,count:rating.count,reviews:rs.map(r=>({stars:r.stars,comment:r.comment,from:names[r.fromUser]}))});
}));

// profile edit
app.put('/api/users/:id',auth,h(async(q,s)=>{const u=await User.findById(q.params.id);if(!u)return s.status(404).json({error:'Not found'});
  if(String(u._id)!==q.uid)return s.status(403).json({error:'Not yours'});
  const{name,email,phone,city,gender,currentLocation,privacy}=q.body;
  if(name!==undefined){if(!String(name).trim())return s.status(400).json({error:'Name is required'});u.name=String(name).trim();}
  if(email!==undefined){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim()))return s.status(400).json({error:'Enter a valid email address'});u.email=String(email).trim();}
  if(phone!==undefined){const normalized=norm(phone);if(!/^92\d{10}$/.test(normalized))return s.status(400).json({error:'Enter a valid phone like 03001234567'});if(await User.exists({phone:normalized,_id:{$ne:u._id}}))return s.status(400).json({error:'Phone already registered'});u.phone=normalized;}
  if(city!==undefined)u.city=String(city).trim();if(gender!==undefined){if(!String(gender).trim())return s.status(400).json({error:'Select your gender'});u.gender=String(gender).trim();}
  if(privacy!==undefined){if(!privacy||typeof privacy!=='object'||Array.isArray(privacy)||Object.keys(privacy).some(key=>!privacyFields.includes(key))||Object.values(privacy).some(value=>!privacyStates.has(value)))return s.status(400).json({error:'Invalid profile privacy settings'});for(const [field,value] of Object.entries(privacy))u.set(`privacy.${field}`,value);}
  if(currentLocation?.publicLabel)u.currentLocation={publicLabel:currentLocation.publicLabel,privateCoordinates:currentLocation.privateCoordinates,capturedAt:new Date()};
  else if(city!==undefined)u.currentLocation={publicLabel:city,capturedAt:new Date()};
  await u.save();s.json(pub(u,{isOwner:true}));
}));

app.put('/api/users/:id/vehicle',auth,h(async(q,s)=>{const u=await User.findById(q.params.id);if(!u)return s.status(404).json({error:'Not found'});
  if(String(u._id)!==q.uid)return s.status(403).json({error:'Not yours'});
  const b=q.body||{};const passengerCapacity=+(b.passengerCapacity||b.seats||0);
  if(!passengerCapacity||passengerCapacity<1)return s.status(400).json({error:'Passenger capacity must be at least 1'});
  u.vehicle={make:b.make,model:b.model,type:b.type,color:b.color,passengerCapacity,seats:passengerCapacity,active:b.active!==false};
  await u.save();s.json({vehicle:u.vehicle});}));

// ---- profile photos
app.post('/api/profile-image',auth,handleProfilePhotoUpload,h(async(q,s)=>{
  if(!q.file)return s.status(400).json({error:'Choose a profile photo first'});
  const {fileTypeFromBuffer}=await import('file-type');
  const detected=await fileTypeFromBuffer(q.file.buffer);
  if(!photoMimeTypes.has(q.file.mimetype)||detected?.mime!==q.file.mimetype)return s.status(415).json({error:'Use a JPEG, PNG, or WebP image'});
  if(!cloudinaryConfigured)return s.status(503).json({error:'Profile photo storage is not configured'});
  const user=await User.findById(q.uid).select('+profileImagePublicId');if(!user)return s.status(404).json({error:'User not found'});
  let uploaded;
  try{uploaded=await uploadProfilePhoto(q.file.buffer,user._id);}catch(error){console.error('Profile photo upload failed',error.message);return s.status(502).json({error:'Could not upload profile photo'});}
  if(!uploaded?.secure_url||!uploaded?.public_id){if(uploaded?.public_id)try{await deleteProfilePhotoAsset(uploaded.public_id);}catch(error){console.error('Incomplete profile photo cleanup failed',error.message);}return s.status(502).json({error:'Photo storage returned an invalid result'});}
  const previousPublicId=user.profileImagePublicId;
  user.profileImage=uploaded.secure_url;user.profileImagePublicId=uploaded.public_id;
  try{await user.save();}catch(error){try{await deleteProfilePhotoAsset(uploaded.public_id);}catch(cleanupError){console.error('Failed to clean up uncommitted profile photo',cleanupError.message);}throw error;}
  if(previousPublicId)try{await deleteProfilePhotoAsset(previousPublicId);}catch(error){console.error('Failed to remove replaced profile photo',error.message);}
  s.json({user:pub(user)});
}));

app.delete('/api/profile-image',auth,h(async(q,s)=>{
  const user=await User.findById(q.uid).select('+profileImagePublicId');if(!user)return s.status(404).json({error:'User not found'});
  if(user.profileImagePublicId){if(!cloudinaryConfigured)return s.status(503).json({error:'Profile photo storage is not configured'});try{await deleteProfilePhotoAsset(user.profileImagePublicId);}catch(error){console.error('Profile photo deletion failed',error.message);return s.status(502).json({error:'Could not remove profile photo. Please try again'});}}
  user.profileImage=null;user.profileImagePublicId=null;await user.save();s.json({user:pub(user)});
}));

// ---- maps (OpenStreetMap Nominatim, free, no key)
app.get('/api/geocode',h(async(q,s)=>{const r=await(await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=pk&q='+encodeURIComponent(q.query.q||''),NH)).json();
  s.json(r.map(x=>({name:x.display_name.split(',').slice(0,3).join(','),lat:+x.lat,lng:+x.lon})));}));

app.get('/api/reverse',h(async(q,s)=>{const{lat,lng}=q.query;const r=await(await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,NH)).json();
  s.json({name:(r.display_name||'Pinned location').split(',').slice(0,3).join(','),lat:+lat,lng:+lng});}));

app.get('/api/route',h(async(q,s)=>{const{lat1,lng1,lat2,lng2}=q.query;const r=await getRoute({lat:+lat1,lng:+lng1},{lat:+lat2,lng:+lng2});s.json(r||{});}));

// ---- saved locations
app.get('/api/locations',auth,h(async(q,s)=>s.json(await SavedLocation.find({userId:q.uid}).sort('-createdAt'))));
app.post('/api/locations',auth,h(async(q,s)=>{const fields=locationFields(q.body||{});fields.type=fields.type||'Other';if(!savedLocationTypes.has(fields.type))return s.status(400).json({error:'Choose Home, University, Work, or Other'});s.status(201).json(await SavedLocation.create({...fields,userId:q.user.id}));}));
app.put('/api/locations/:id',auth,h(async(q,s)=>{const fields=locationFields(q.body||{});if(!Object.keys(fields).length)return s.status(400).json({error:'No location fields to update'});if(fields.type!==undefined&&!savedLocationTypes.has(fields.type))return s.status(400).json({error:'Choose Home, University, Work, or Other'});const l=await SavedLocation.findOneAndUpdate({_id:q.params.id,userId:q.user.id},{$set:fields},{new:true,runValidators:true});if(!l)return s.status(404).json({error:'Not found'});s.json(l);}));
app.delete('/api/locations/:id',auth,h(async(q,s)=>{await SavedLocation.deleteOne({_id:q.params.id,userId:q.user.id});s.json({ok:true});}));

// ---- buddies
app.get('/api/buddies',auth,h(async(q,s)=>{
  const buddies=await Buddy.find({status:'accepted',$or:[{userId:q.uid},{buddyId:q.uid}]}).sort('-updatedAt').populate('userId buddyId','name profileImage gender city verified privacy');
  const entries=buddies.map(item=>({item,buddy:String(item.userId._id)===q.uid?item.buddyId:item.userId}));
  const contacts=await acceptedContactIds(q.uid,entries.map(entry=>entry.buddy?._id));
  s.json(entries.map(({item,buddy})=>({ _id:item._id, status:item.status, createdAt:item.createdAt, buddy:buddy?pub(buddy,{hasContact:contacts.has(String(buddy._id))}):null })));
}));
app.post('/api/buddies',auth,h(async(q,s)=>{if(!q.body.buddyId||String(q.body.buddyId)===q.uid)return s.status(400).json({error:'Choose another user'});if(!await User.exists({_id:q.body.buddyId}))return s.status(404).json({error:'User not found'});const buddy=await Buddy.findOneAndUpdate({userId:q.uid,buddyId:q.body.buddyId},{userId:q.uid,buddyId:q.body.buddyId,status:'pending'},{upsert:true,new:true,setDefaultsOnInsert:true});s.status(201).json(buddy);}));
app.patch('/api/buddies/:id',auth,h(async(q,s)=>{if(!['accepted','rejected','blocked','removed'].includes(q.body.status))return s.status(400).json({error:'Invalid buddy status'});const buddy=await Buddy.findOne({_id:q.params.id,$or:[{userId:q.uid},{buddyId:q.uid}]});if(!buddy)return s.status(404).json({error:'Buddy relationship not found'});buddy.status=q.body.status;await buddy.save();s.json(buddy);}));

// ---- commutes
app.post('/api/commutes',auth,h(async(q,s)=>{const b=q.body;if(!b.origin||!b.dest)return s.status(400).json({error:'Pick both locations'});
  if(!Array.isArray(b.days)||b.days.length===0)return s.status(400).json({error:'Select at least one commute day'});
  if(!b.startDate||!b.endDate||b.endDate<b.startDate)return s.status(400).json({error:'Enter a valid date range'});
  if(!b.startTime||!b.endTime)return s.status(400).json({error:'Enter departure and return times'});
  if(!['need','offer','either'].includes(b.role||'need'))return s.status(400).json({error:'Choose a ride type'});
  if(b.rideMode&&!['own_vehicle','hired_shared_ride'].includes(b.rideMode))return s.status(400).json({error:'Choose a valid ride mode'});
  const route=await getRoute(b.origin,b.dest);const passengerCapacity=+b.passengerCapacity||+b.seats||1;
  const c=await Commute.create({...b,userId:q.uid,passengerCapacity,seats:passengerCapacity,rideMode:b.rideMode||'own_vehicle',price:+b.price||0,routeGeo:route?.points||[],distanceKm:route?.distanceKm||+(km(b.origin,b.dest)*1.3).toFixed(1)});
  s.json(c);}));

app.get('/api/commutes/mine',auth,h(async(q,s)=>s.json(await Commute.find({userId:q.uid,active:true}).sort('-createdAt'))));
app.get('/api/commutes/:id/occupancy',auth,h(async(q,s)=>{const c=await Commute.findOne({_id:q.params.id,active:true});if(!c)return s.status(404).json({error:'Commute not found'});if(String(c.userId)!==q.uid)return s.status(403).json({error:'Not yours'});const date=q.query.date||nextCommuteDate(c);const day=dayIndex(date);const confirmed=await Booking.find({commuteId:c._id,status:'confirmed',$or:[{requestedDate:date},{requestedDate:{$exists:false},requestedDay:{$exists:false}},{requestedDate:{$exists:false},requestedDay:day}]}).select('passengerId seatNumber');const occupied=Math.min(capacityOf(c),confirmed.length);const usedSeats=new Set(confirmed.map(item=>item.seatNumber).filter(Number.isInteger));const seats=Array.from({length:capacityOf(c)},(_,index)=>({number:index+1,status:usedSeats.has(index+1)||(!usedSeats.size&&index<occupied)?'occupied':'open'}));s.json({date,passengerCapacity:capacityOf(c),occupiedSeats:occupied,availableSeats:capacityOf(c)-occupied,seats});}));

app.get('/api/commutes/discover',auth,h(async(q,s)=>{
  const blocked=(await User.findById(q.uid).select('blocked'))?.blocked||[];
  const filter={active:true,paused:false,userId:{$ne:q.uid,$nin:blocked}};
  if(q.query.rideMode)filter.rideMode=q.query.rideMode;
  const commutes=await Commute.find(filter).sort('-createdAt').limit(Math.min(100,Math.max(1,+q.query.limit||30))).populate('userId','name phone verified gender city vehicle profileImage privacy');
  const stats=await bookingStats(commutes.map(c=>c._id));
  const contacts=await acceptedContactIds(q.uid,commutes.map(c=>c.userId?._id));
  const preciseCommutes=await acceptedCommuteIds(q.uid,commutes.map(c=>c._id));
  const genderCounts=await visibleBookingGenderCounts(commutes.map(c=>c._id),q.uid);
  const statMap=Object.fromEntries(stats.map(item=>[String(item._id),item]));
  s.json(commutes.map(c=>{const stat=statMap[String(c._id)]||{count:0};return {...publicCommute(c,{precise:preciseCommutes.has(String(c._id))}),passengerCapacity:capacityOf(c),availableSeats:Math.max(0,capacityOf(c)-stat.count),genderCounts:genderCounts[String(c._id)]||{},user:pub(c.userId,{hasContact:contacts.has(String(c.userId?._id))})};}));
}));

app.get('/api/commutes/:id',auth,h(async(q,s)=>{
  const c=await Commute.findById(q.params.id).populate('userId','name phone email profileImage verified gender city vehicle privacy');
  if(!c||!c.userId)return s.status(404).json({error:'Commute not found'});
  const isOwner=String(c.userId._id)===q.uid;
  const [contacts,preciseCommutes]=await Promise.all([acceptedContactIds(q.uid,[c.userId._id]),acceptedCommuteIds(q.uid,[c._id])]);
  s.json({...publicCommute(c,{precise:isOwner||preciseCommutes.has(String(c._id))}),score:0,user:pub(c.userId,{isOwner,hasContact:contacts.has(String(c.userId._id))})});
}));

app.patch('/api/commutes/:id',auth,h(async(q,s)=>{const c=await Commute.findOne({_id:q.params.id,userId:q.uid});if(!c)return s.status(404).json({error:'Not found'});
  const changeFields=['origin','dest','days','startTime','endTime','startDate','endDate','role','rideMode','price','paused','active','passengerCapacity','seats'];
  const changed=changeFields.some(key=>q.body[key]!==undefined);
  if(q.body.paused!==undefined)c.paused=q.body.paused;if(q.body.active!==undefined)c.active=q.body.active;
  ['origin','dest','days','startTime','endTime','startDate','endDate','role','rideMode','price'].forEach(k=>{if(q.body[k]!==undefined)c[k]=q.body[k]});
  if(q.body.passengerCapacity!==undefined||q.body.seats!==undefined){c.passengerCapacity=+q.body.passengerCapacity||+q.body.seats;c.seats=c.passengerCapacity;}
  const updated=await c.save();
  if(changed){
    const [requesters,passengers]=await Promise.all([Request.distinct('fromUser',{commuteId:c._id,status:{$in:['accepted','completed']}}),Booking.distinct('passengerId',{commuteId:c._id,status:{$in:['confirmed','completed']}})]);
    const recipients=[...new Set([...requesters,...passengers].map(String))].filter(id=>id!==q.uid);
    await Promise.all(recipients.map(userId=>notify({userId,type:'COMMUTE_CHANGED',message:'A commute you joined has changed.',rideId:c._id,commuteId:c._id,data:{commuteId:c._id,startDate:c.startDate,endDate:c.endDate}})));
  }
  s.json(updated);
}));
app.delete('/api/commutes/:id',auth,h(async(q,s)=>{
  const c=await Commute.findOneAndUpdate({_id:q.params.id,userId:q.uid},{active:false},{new:true});
  if(c){
    const [requesters,passengers]=await Promise.all([Request.distinct('fromUser',{commuteId:c._id,status:{$in:['accepted','completed']}}),Booking.distinct('passengerId',{commuteId:c._id,status:{$in:['confirmed','completed']}})]);
    const recipients=[...new Set([...requesters,...passengers].map(String))].filter(id=>id!==q.uid);
    await Promise.all(recipients.map(userId=>notify({userId,type:'URGENT_CANCELLATION',message:'A commute you joined has been cancelled.',rideId:c._id,commuteId:c._id,data:{commuteId:c._id,startDate:c.startDate,endDate:c.endDate}})));
  }
  s.json({ok:true});
}));

// ---- matching engine v2
app.post('/api/match',auth,h(async(q,s)=>{const m=q.body,me=await User.findById(q.uid);
  const blocked=Array.isArray(me.blocked)?me.blocked:[];
  const cs=await Commute.find({active:true,paused:false,userId:{$ne:q.uid,$nin:blocked}}).populate('userId','name phone verified gender city vehicle profileImage privacy');
  const stats=await bookingStats(cs.map(c=>c._id));
  const contacts=await acceptedContactIds(q.uid,cs.map(c=>c.userId?._id));
  const preciseCommutes=await acceptedCommuteIds(q.uid,cs.map(c=>c._id));
  const genderCounts=await visibleBookingGenderCounts(cs.map(c=>c._id),q.uid);
  const statMap=Object.fromEntries(stats.map(item=>[String(item._id),item]));
  const rs=await Rating.aggregate([{$group:{_id:'$toUser',avg:{$avg:'$stars'},count:{$sum:1}}}]);const R=Object.fromEntries(rs.map(r=>[String(r._id),r]));
  const out=[];
  const now=new Date().toISOString().slice(0,10);
  for(const c of cs){if(!c.userId)continue;
    if(c.endDate&&c.endDate<now)continue;
    if(m.startDate&&m.endDate&&c.startDate&&c.endDate&&(c.endDate<m.startDate||m.endDate<c.startDate))continue;
    const stat=statMap[String(c._id)]||{count:0};
    const seatsAvailable=Math.max(0,capacityOf(c)-stat.count);
    if(seatsAvailable<=0)continue;
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
      out.push({...publicCommute(c,{precise:preciseCommutes.has(String(c._id))}),score,originKm:+os.toFixed(1),destKm:+ds.toFixed(1),explanation:{
        routeOverlap:+((routeScore||0)*100).toFixed(0),
        timeOverlap:timeScore>0.8?'Similar departure':timeScore>0.5?'Partial overlap':'Different schedule',
        daysOverlap:mDays.length+'/'+(m.days||[]).length+' days'+(mDays.length===0?' (no overlap)':''),
        pickupAlongRoute:+distAlong.toFixed(1),
        seatsAvailable
      },passengerCapacity:capacityOf(c),availableSeats:seatsAvailable,genderCounts:genderCounts[String(c._id)]||{},user:{...pub(c.userId,{hasContact:contacts.has(String(c.userId._id))}),avg:r.avg?+r.avg.toFixed(1):0,count:r.count||0}});
    }
  }
  s.json(out.sort((a,b)=>b.score-a.score));
}));

// ---- join requests
app.post('/api/requests',auth,h(async(q,s)=>{const c=await Commute.findById(q.body.commuteId).populate('userId');if(!c)return s.status(404).json({error:'Commute not found'});
  if(String(c.userId._id)===q.uid)return s.status(400).json({error:'This is your own commute'});
  if(await Request.findOne({commuteId:c._id,fromUser:q.uid,status:{$in:['pending','accepted']}}))return s.status(400).json({error:'Already requested'});
  if(await availableSeats(c,q.body.requestedDate,q.body.requestedDay)<=0)return s.status(400).json({error:'No seats available'});
  const fromUser=await User.findById(q.uid);
  const req=await Request.create({commuteId:c._id,fromUser:q.uid,toUser:c.userId._id,requestedDate:q.body.requestedDate,requestedDay:q.body.requestedDay,message:q.body.message});
  await notify({userId:c.userId._id,type:'BOOKING_REQUEST',message:`${pub(fromUser).name} wants to join your ride`,rideId:c._id,commuteId:c._id,data:{requestId:req._id,requestedDate:req.requestedDate,requestedDay:req.requestedDay}});
  s.json(req);}));

app.get('/api/requests',auth,h(async(q,s)=>{
  const [incoming,outgoing]=await Promise.all([
    Request.find({toUser:q.uid}).sort('-createdAt').populate('commuteId').populate('fromUser','name phone email profileImage verified gender city privacy').populate('toUser','name phone email profileImage verified gender city privacy'),
    Request.find({fromUser:q.uid}).sort('-createdAt').populate('commuteId').populate('fromUser','name phone email profileImage verified gender city privacy').populate('toUser','name phone email profileImage verified gender city privacy'),
  ]);
  const requests=[...incoming,...outgoing];
  const contacts=await acceptedContactIds(q.uid,requests.flatMap(request=>[request.fromUser?._id,request.toUser?._id]));
  const preciseCommutes=await acceptedCommuteIds(q.uid,requests.map(request=>request.commuteId?._id));
  const project=request=>{
    const result=request.toObject();
    result.commuteId=request.commuteId?publicCommute(request.commuteId,{precise:preciseCommutes.has(String(request.commuteId._id))}):null;
    for(const field of ['fromUser','toUser'])if(request[field])result[field]=pub(request[field],{isOwner:String(request[field]._id)===q.uid,hasContact:contacts.has(String(request[field]._id))});
    return result;
  };
  s.json({incoming:incoming.map(project),outgoing:outgoing.map(project)});
}));

app.patch('/api/requests/:id',auth,h(async(q,s)=>{const r=await Request.findOne({_id:q.params.id,$or:[{toUser:q.uid},{fromUser:q.uid}]}).populate('fromUser','name phone email profileImage verified gender city vehicle privacy');
  if(!r)return s.status(404).json({error:'Not found'});
  const nextStatus=q.body.status;
  if(!['accepted','rejected','cancelled'].includes(nextStatus))return s.status(400).json({error:'Invalid request status'});
  const owner=String(r.toUser)===q.uid;
  if(nextStatus!=='cancelled'&&!owner)return s.status(403).json({error:'Only the ticket owner can decide this request'});
  if(nextStatus==='accepted'){
    const c=await Commute.findById(r.commuteId);if(!c||await availableSeats(c,r.requestedDate,r.requestedDay)<=0)return s.status(400).json({error:'No seats available'});
    r.status='accepted';await r.save();
    const booking=await Booking.findOneAndUpdate({requestId:r._id},{commuteId:r.commuteId,passengerId:r.fromUser._id,requestId:r._id,acceptedBy:q.uid,requestedDate:r.requestedDate,requestedDay:r.requestedDay,status:'confirmed'},{upsert:true,new:true,setDefaultsOnInsert:true});
    await notify({userId:r.fromUser._id,type:'BOOKING_ACCEPTED',message:'Your ride request was accepted!',rideId:r.commuteId,commuteId:r.commuteId,bookingId:booking._id,data:{requestId:r._id,requestedDate:r.requestedDate,requestedDay:r.requestedDay}});
  } else {
    r.status=nextStatus;await r.save();
    if(nextStatus==='cancelled'){
      const booking=await Booking.findOneAndUpdate({requestId:r._id,status:{$in:['pending','confirmed']}},{status:'cancelled'},{new:true});
      const recipient=String(r.fromUser._id)===q.uid?r.toUser:r.fromUser._id;
      await notify({userId:recipient,type:'BOOKING_CANCELLED',message:'A ride request was cancelled.',rideId:r.commuteId,commuteId:r.commuteId,bookingId:booking?._id,data:{requestId:r._id,requestedDate:r.requestedDate,requestedDay:r.requestedDay}});
    }
    if(nextStatus==='rejected')await notify({userId:r.fromUser._id,type:'BOOKING_REJECTED',message:'Your request was declined',rideId:r.commuteId,commuteId:r.commuteId,data:{requestId:r._id,requestedDate:r.requestedDate,requestedDay:r.requestedDay}});
  }
  const response=r.toObject();
  const contacts=await acceptedContactIds(q.uid,[r.fromUser?._id,r.toUser?._id||r.toUser]);
  response.fromUser=pub(r.fromUser,{isOwner:String(r.fromUser?._id)===q.uid,hasContact:contacts.has(String(r.fromUser?._id))});
  s.json(response);}));

app.get('/api/bookings/mine',auth,h(async(q,s)=>{
  const bookings=await Booking.find({passengerId:q.uid}).sort('-createdAt').populate('commuteId').lean();
  const preciseCommutes=await acceptedCommuteIds(q.uid,bookings.map(booking=>booking.commuteId?._id));
  s.json(bookings.map(booking=>({...booking,commuteId:booking.commuteId?publicCommute(booking.commuteId,{precise:preciseCommutes.has(String(booking.commuteId._id))}):null})));
}));
app.patch('/api/bookings/:id',auth,h(async(q,s)=>{const b=await Booking.findById(q.params.id).populate('commuteId');if(!b)return s.status(404).json({error:'Not found'});
  if(String(b.passengerId)!==q.uid&&String(b.commuteId.userId)!==q.uid)return s.status(403).json({error:'Not allowed'});
  if(!['cancelled','completed'].includes(q.body.status))return s.status(400).json({error:'Invalid booking status'});
  b.status=q.body.status;await b.save();
  if(q.body.status==='cancelled'&&b.requestId)await Request.updateOne({_id:b.requestId,status:'accepted'},{status:'cancelled'});
  if(q.body.status==='cancelled'){
    const recipient=String(b.passengerId)===q.uid?b.commuteId.userId:b.passengerId;
    await notify({userId:recipient,type:'BOOKING_CANCELLED',message:'A confirmed ride was cancelled.',rideId:b.commuteId._id,commuteId:b.commuteId._id,bookingId:b._id,data:{requestId:b.requestId,requestedDate:b.requestedDate,requestedDay:b.requestedDay}});
  }
  s.json(b);}));

// ---- trips + cost split
app.post('/api/trips',auth,h(async(q,s)=>{const{commuteId,distanceKm,fare}=q.body,c=await Commute.findOne({_id:commuteId,userId:q.uid});if(!c)return s.status(403).json({error:'Not your commute'});
  const tripDate=q.body.tripDate||new Date().toISOString().slice(0,10);const tripDay=q.body.tripDay;
  const bookingFilter={commuteId,status:'confirmed',$or:[{requestedDate:tripDate},{requestedDate:{$exists:false},requestedDay:{$exists:false}}]};if(tripDay!==undefined)bookingFilter.$or.push({requestedDay:+tripDay});
  const bookings=await Booking.find(bookingFilter);const rq=bookings.length?null:await Request.find({commuteId,status:'accepted'});const riders=bookings.length?bookings.map(b=>b.passengerId):rq.map(r=>r.fromUser);if(!riders.length)return s.status(400).json({error:'No accepted riders yet'});
  if(!(+fare>0))return s.status(400).json({error:'Enter the total fare'});
  const t=await Trip.create({commuteId,driverId:q.uid,riders,origin:c.origin,dest:c.dest,tripDate,startTime:c.startTime,endTime:c.endTime,distanceKm:+distanceKm,fare:+fare,perPerson:Math.round(+fare/(riders.length+1)),status:'completed'});
  if(bookings.length)await Booking.updateMany({_id:{$in:bookings.map(b=>b._id)}},{status:'completed'});await Request.updateMany({commuteId,status:'accepted'},{status:'completed',tripId:t._id});s.json(t);}));

app.get('/api/trips/mine',auth,h(async(q,s)=>{const ts=await Trip.find({$or:[{driverId:q.uid},{riders:q.uid}]}).sort('-createdAt').populate('driverId riders','name phone email profileImage verified gender city vehicle privacy').lean();
  const rs=await Rating.find({fromUser:q.uid,tripId:{$in:ts.map(t=>t._id)}});
  s.json(ts.map(t=>({...t,driverId:t.driverId?pub(t.driverId,{isOwner:String(t.driverId._id)===q.uid,hasContact:true}):null,riders:(t.riders||[]).map(person=>pub(person,{isOwner:String(person._id)===q.uid,hasContact:true})),rated:rs.filter(r=>String(r.tripId)===String(t._id)).map(r=>String(r.toUser))})));}));

app.patch('/api/trips/:id/status',auth,h(async(q,s)=>{const t=await Trip.findById(q.params.id);if(!t)return s.status(404).json({error:'Not found'});
  if(String(t.driverId)!==q.uid&&!t.riders.includes(q.uid))return s.status(403).json({error:'Not a participant'});
  t.status=q.body.status;await t.save();
  if(q.body.status==='cancelled'){
    const recipients=[...new Set([t.driverId,...t.riders].map(String))].filter(id=>id!==q.uid);
    await Promise.all(recipients.map(userId=>notify({userId,type:'URGENT_CANCELLATION',message:'A trip you were part of has been cancelled.',rideId:t._id,tripId:t._id,commuteId:t.commuteId,scheduledFor:t.tripDate?new Date(`${t.tripDate}T00:00:00Z`):undefined,data:{tripId:t._id,tripDate:t.tripDate}})));
  }
  s.json(t);}));

// ---- ratings
app.post('/api/ratings',auth,h(async(q,s)=>{const{tripId,toUser,stars,comment}=q.body;
  if(!tripId||!toUser)return s.status(400).json({error:'Trip and target user are required'});
  if(q.uid===String(toUser))return s.status(400).json({error:'You cannot rate yourself'});
  if(!Number.isInteger(stars)||stars<1||stars>5)return s.status(400).json({error:'Stars must be an integer from 1 to 5'});
  const [t,target]=await Promise.all([Trip.findById(tripId),User.findById(toUser).select('_id')]);
  if(!t)return s.status(404).json({error:'Trip not found'});
  if(!target)return s.status(404).json({error:'Target user not found'});
  if(t.status!=='completed')return s.status(400).json({error:'Ratings are available after the trip is completed'});
  const participants=[String(t.driverId),...t.riders.map(String)];
  if(!participants.includes(q.uid)||!participants.includes(String(toUser)))return s.status(403).json({error:'Only trip participants can rate each other'});
  if(await Rating.findOne({tripId,fromUser:q.uid,toUser}))return s.status(400).json({error:'Already rated this user for this trip'});
  try { s.status(201).json(await Rating.create({tripId,fromUser:q.uid,toUser,stars,comment})); }
  catch(error) { if(error.code===11000)return s.status(400).json({error:'Already rated this user for this trip'}); throw error; }
}));

// ---- notifications
app.get('/api/notifications',auth,h(async(q,s)=>{const n=await Notification.find({userId:q.uid}).sort('-createdAt').limit(50).lean();s.json(n);}));
app.patch('/api/notifications/:id/read',auth,h(async(q,s)=>{const n=await Notification.findOneAndUpdate({_id:q.params.id,userId:q.uid},{read:true},{new:true});if(!n)return s.status(404).json({error:'Notification not found'});s.json(n);}));
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
    name,phone,email:name[0]+'@demo.com',cnic:'3520212345671',password:pw,verified:true,gender:'male',city:'Islamabad',vehicle:{make:'Toyota',model:'Vitz',type:'Hatchback',color:'White',passengerCapacity:5,active:true}
  })));
  const d=new Date().toISOString().slice(0,10),e=new Date(Date.now()+60*864e5).toISOString().slice(0,10);
  const seeds=[[0,'g10','sad','08:30','09:00','offer',2,250,[0,1,2,3,4]],[1,'f10','sad','09:15','09:45','offer',3,300,[0,1,2,3,4]],[2,'i8','sat','09:45','10:15','offer',2,280,[0,2,4]]];
  for(const [i,o,t,a,b,role,seats,price,days] of seeds){
    const r=await getRoute(L[o],L[t]);
    await Commute.create({userId:us[i]._id,origin:L[o],dest:L[t],startTime:a,endTime:b,role,passengerCapacity:seats,seats,rideMode:'own_vehicle',price,days,startDate:d,endDate:e,routeGeo:r?.points||[],distanceKm:r?.distanceKm||0});
  }
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