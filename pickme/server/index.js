const dns = require('dns');
dns.setServers(['1.1.1.1']);

require('dotenv').config();
const express=require('express'),cors=require('cors'),mongoose=require('mongoose'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken');
const {randomUUID}=require('node:crypto'),multer=require('multer'),cloudinary=require('cloudinary').v2;
const app=express();app.use(cors());app.use(express.json());
const SECRET=process.env.JWT_SECRET||'pickme-dev';
const cloudinaryConfigured=Boolean(process.env.CLOUDINARY_CLOUD_NAME&&process.env.CLOUDINARY_API_KEY&&process.env.CLOUDINARY_API_SECRET);
if(cloudinaryConfigured)cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
const {User,Commute,RideOccurrence,SavedLocation,Notification,Request,Booking,Buddy,Invitation,Trip,Rating,Report}=require('./models');
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

// Confirmed passengers' genders, filtered by each passenger's privacy setting.
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

// ---------------------------------------------------------------------------
// Occurrence generation
// ---------------------------------------------------------------------------
// Build all YYYY-MM-DD strings that fall within [from, to] and match the
// commute's weekday pattern.  One-time commutes yield exactly one date.
function occurrenceDates(commute, from, to) {
  const dates = [];
  if ((commute.tripType || 'recurring') === 'one_time') {
    const d = commute.tripDate || commute.startDate;
    if (d && d >= from && d <= to && (!commute.cancelledFromDate || d < commute.cancelledFromDate)) dates.push(d);
    return dates;
  }
  const start = [commute.startDate || from, from].sort().pop(); // max
  let cancelEnd = to;
  if (commute.cancelledFromDate) {
    const cutoff = new Date(`${commute.cancelledFromDate}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 1);
    cancelEnd = cutoff.toISOString().slice(0, 10);
  }
  const end = [commute.endDate || to, to, cancelEnd].sort()[0]; // min
  if (start > end) return dates;
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cur <= last) {
    const iso  = cur.toISOString().slice(0, 10);
    const dow  = (cur.getUTCDay() + 6) % 7; // Mon=0…Sun=6
    if (Array.isArray(commute.days) && commute.days.includes(dow)) dates.push(iso);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// Idempotently ensure RideOccurrence documents exist for every date in the
// window.  Returns the array of occurrences (existing + newly created).
async function generateOccurrences(commute, from, to) {
  const dates = occurrenceDates(commute, from, to);
  if (!dates.length) return [];

  // Fetch already-existing occurrences for this window in one query
  const existing = await RideOccurrence.find({
    commuteId: commute._id,
    date: { $in: dates },
  }).lean();
  const existingDates = new Set(existing.map(o => o.date));
  const initialSeats = commute.rideMode === 'hired_shared_ride' ? (+commute.requestedSeats || +commute.seats || 1) : 0;
  const initialSeatNumbers = Array.from({ length: initialSeats }, (_, index) => index + 1);

  // Build insert docs only for missing dates
  const toInsert = dates
    .filter(d => !existingDates.has(d))
    .map(d => ({
      commuteId:         commute._id,
      userId:            commute.userId,
      date:              d,
      startTime:         commute.startTime,
      endTime:           commute.endTime,
      origin:            commute.origin,
      dest:              commute.dest,
      passengerCapacity: capacityOf(commute),
      initialSeats,
      initialMaleCount:  +commute.maleCount || 0,
      initialFemaleCount:+commute.femaleCount || 0,
      initialOtherCount: +commute.otherCount || 0,
      bookedSeatNumbers: initialSeatNumbers,
      selectedSeatNumbers: [],
      confirmedSeats:    initialSeats,
      status:            initialSeats >= capacityOf(commute) ? 'full' : 'active',
    }));

  let created = [];
  if (toInsert.length) {
    // insertMany with ordered:false so a rare duplicate-key race doesn't abort
    // the whole batch; ignore duplicate-key errors (11000)
    try {
      created = await RideOccurrence.insertMany(toInsert, { ordered: false });
    } catch (e) {
      if (e.code !== 11000 && (!e.writeErrors || e.writeErrors.some(w => w.code !== 11000))) throw e;
      created = e.insertedDocs || [];
    }
  }

  // Return all occurrences for the window, freshly fetched so callers get
  // up-to-date confirmedSeats/status even for pre-existing ones
  return RideOccurrence.find({ commuteId: commute._id, date: { $in: dates } });
}

// ---------------------------------------------------------------------------
// Seat availability — occurrence-scoped
// ---------------------------------------------------------------------------
// Ensure an occurrence exists for the given date, then return available seats.
async function occurrenceForDate(commute, date) {
  const [occ] = await generateOccurrences(commute, date, date);
  return occ || null;
}

const availableSeats = async (commute, date) => {
  const occ = await occurrenceForDate(commute, date);
  if (!occ) return 0;
  if (occ.status === 'cancelled' || occ.status === 'full') return 0;
  return Math.max(0, occ.passengerCapacity - occ.confirmedSeats - (occ.selectedSeatNumbers || []).length);
};

async function ensureBookedSeatNumbers(occurrenceId) {
  const occurrence = await RideOccurrence.findById(occurrenceId).lean();
  if (!occurrence) return null; // Ensure occurrence exists
  const hasSeatArray = Array.isArray(occurrence.bookedSeatNumbers);
  const bookedSeatNumbers = hasSeatArray ? occurrence.bookedSeatNumbers : [];
  const initialSeatNumbers = Array.from({ length: +occurrence.initialSeats || 0 }, (_, index) => index + 1);
  const confirmedSeats = +occurrence.confirmedSeats || 0;
  if (hasSeatArray && bookedSeatNumbers.length >= Math.max(initialSeatNumbers.length, confirmedSeats)) return occurrence;

  const confirmedBookings = await Booking.find({ occurrenceId, status: 'confirmed' }).select('seatNumber').lean();
  const merged = new Set([...initialSeatNumbers, ...bookedSeatNumbers]);
  for (const booking of confirmedBookings) {
    if (Number.isInteger(booking.seatNumber) && booking.seatNumber > 0 && booking.seatNumber <= occurrence.passengerCapacity) merged.add(booking.seatNumber);
  }
  const selected = new Set(occurrence.selectedSeatNumbers || []);
  for (let seat = 1; merged.size < confirmedSeats && seat <= occurrence.passengerCapacity; seat += 1) {
    if (!selected.has(seat)) merged.add(seat);
  }
  const mergedSeatNumbers = [...merged].sort((a, b) => a - b);
  await RideOccurrence.updateOne(
    { _id: occurrenceId, $expr: { $eq: [{ $size: { $ifNull: ['$bookedSeatNumbers', []] } }, bookedSeatNumbers.length] } },
    { $set: { bookedSeatNumbers: mergedSeatNumbers } }
  );
  return RideOccurrence.findById(occurrenceId).lean();
}

async function selectSeat(occurrenceId, seatNumber) {
  if (!Number.isInteger(seatNumber) || seatNumber < 1) return null;
  await ensureBookedSeatNumbers(occurrenceId);
  const occ = await RideOccurrence.findOneAndUpdate(
    {
      _id: occurrenceId,
      status: 'active',
      passengerCapacity: { $gte: seatNumber },
      bookedSeatNumbers: { $ne: seatNumber },
      selectedSeatNumbers: { $ne: seatNumber },
      $expr: { $lt: [{ $add: ['$confirmedSeats', { $size: { $ifNull: ['$selectedSeatNumbers', []] } }] }, '$passengerCapacity'] },
    },
    { $addToSet: { selectedSeatNumbers: seatNumber } },
    { new: true }
  );
  return occ;
}

// Move a pending seat selection to confirmed occupancy atomically.
async function reserveSeat(occurrenceId, seatNumber) {
  await ensureBookedSeatNumbers(occurrenceId);
  const occ = await RideOccurrence.findOneAndUpdate(
    {
      _id: occurrenceId,
      status: 'active',
      selectedSeatNumbers: seatNumber,
      bookedSeatNumbers: { $ne: seatNumber },
      passengerCapacity: { $gte: seatNumber },
      $expr: { $lt: ['$confirmedSeats', '$passengerCapacity'] },
    },
    [
      {
        $set: {
          confirmedSeats: { $add: ['$confirmedSeats', 1] },
          bookedSeatNumbers: { $concatArrays: [{ $ifNull: ['$bookedSeatNumbers', []] }, [seatNumber]] },
          selectedSeatNumbers: { $filter: { input: { $ifNull: ['$selectedSeatNumbers', []] }, as: 'seat', cond: { $ne: ['$$seat', seatNumber] } } },
          status: {
            $cond: {
              if: { $gte: [{ $add: ['$confirmedSeats', 1] }, '$passengerCapacity'] },
              then: 'full',
              else: 'active',
            },
          },
        },
      },
    ],
    { new: true }
  );
  return occ; // null means no room or wrong status
}

async function releaseSelectedSeat(occurrenceId, seatNumber) {
  if (!Number.isInteger(seatNumber)) return;
  await RideOccurrence.updateOne({ _id: occurrenceId }, { $pull: { selectedSeatNumbers: seatNumber } });
}

// Decrement confirmedSeats when a booking is cancelled (flip back to 'active'
// if it was 'full')
async function releaseSeat(occurrenceId, seatNumber) {
  const seatState = await ensureBookedSeatNumbers(occurrenceId);
  const initialSeats = +seatState?.initialSeats || 0;
  const seatToRelease = Number.isInteger(seatNumber)
    ? seatNumber
    : (seatState?.bookedSeatNumbers || []).find(number => number > initialSeats);
  const bookedSeatNumbers = Number.isInteger(seatToRelease)
    ? { $filter: { input: { $ifNull: ['$bookedSeatNumbers', []] }, as: 'seat', cond: { $ne: ['$$seat', seatToRelease] } } }
    : { $ifNull: ['$bookedSeatNumbers', []] };
  await RideOccurrence.findOneAndUpdate(
    { _id: occurrenceId, $expr: { $gt: ['$confirmedSeats', { $ifNull: ['$initialSeats', 0] }] } },
    [
      {
        $set: {
          confirmedSeats: { $max: [{ $subtract: ['$confirmedSeats', 1] }, '$initialSeats'] },
          bookedSeatNumbers,
          status: {
            $cond: {
              if: { $eq: ['$status', 'cancelled'] },
              then: 'cancelled',
              else: { $cond: { if: { $gte: [{ $subtract: ['$confirmedSeats', 1] }, '$passengerCapacity'] }, then: 'full', else: 'active' } },
            },
          },
        },
      },
    ]
  );
}

// Availability summary across all active occurrences for a commute — used by
// the matching engine to decide whether ANY upcoming date still has seats.
async function commuteHasAvailability(commuteId) {
  const occ = await RideOccurrence.findOne({
    commuteId,
    status: 'active',
    $expr: { $lt: [{ $add: ['$confirmedSeats', { $size: { $ifNull: ['$selectedSeatNumbers', []] } }] }, '$passengerCapacity'] },
  }).lean();
  return !!occ;
}

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
app.post('/api/commutes',auth,h(async(q,s)=>{const b=q.body;
  if(!b.origin||!b.dest)return s.status(400).json({error:'Pick both locations'});
  const tripType=b.tripType==='one_time'?'one_time':'recurring';
  // one_time: needs a single tripDate; recurring: needs days + date range
  if(tripType==='one_time'){
    if(!b.tripDate)return s.status(400).json({error:'Select a date for your trip'});
  } else {
    if(!Array.isArray(b.days)||b.days.length===0)return s.status(400).json({error:'Select at least one commute day'});
    if(!b.startDate||!b.endDate||b.endDate<b.startDate)return s.status(400).json({error:'Enter a valid date range'});
  }
  if(!b.startTime||!b.endTime)return s.status(400).json({error:'Enter departure and arrival times'});
  if(!['need','offer','either'].includes(b.role||'need'))return s.status(400).json({error:'Choose a ride type'});
  if(b.rideMode&&!['own_vehicle','hired_shared_ride'].includes(b.rideMode))return s.status(400).json({error:'Choose a valid ride mode'});
  const rideMode=b.rideMode==='hired_shared_ride'?'hired_shared_ride':'own_vehicle';
  const isSharedRide=rideMode==='hired_shared_ride';
  const owner=await User.findById(q.uid).select('vehicle');
  let passengerCapacity,seats,requestedSeats=null,vehicleSnapshot=null,role;
  let maleCount=0,femaleCount=0,otherCount=0;
  if(isSharedRide){
    requestedSeats=+(b.requestedSeats||b.seats||0);
    if(!Number.isInteger(requestedSeats)||requestedSeats<1||requestedSeats>4)return s.status(400).json({error:'Choose between 1 and 4 intended seats'});
    maleCount=+(b.maleCount||0);femaleCount=+(b.femaleCount||0);otherCount=+(b.otherCount||0);
    if(![maleCount,femaleCount,otherCount].every(Number.isInteger)||maleCount<0||femaleCount<0||otherCount<0||maleCount+femaleCount+otherCount!==requestedSeats)return s.status(400).json({error:'Passenger gender counts must add up to intended seats'});
    passengerCapacity=4;seats=requestedSeats;role='need';
  } else {
    const savedVehicle=owner?.vehicle;
    const vehicleCapacity=+savedVehicle?.passengerCapacity||+savedVehicle?.seats||0;
    if(!savedVehicle||savedVehicle.active===false||vehicleCapacity<1)return s.status(400).json({error:'Save and activate a vehicle in your profile before offering a ride'});
    passengerCapacity=+b.passengerCapacity||+b.seats||vehicleCapacity;
    if(!Number.isInteger(passengerCapacity)||passengerCapacity<1||passengerCapacity>vehicleCapacity)return s.status(400).json({error:'Passenger capacity must fit your saved vehicle'});
    seats=passengerCapacity;role='offer';
    vehicleSnapshot={make:savedVehicle.make,model:savedVehicle.model,type:savedVehicle.type,color:savedVehicle.color,passengerCapacity:vehicleCapacity};
  }
  const route=await getRoute(b.origin,b.dest);
  const timeFlexibility=Math.max(0,+b.timeFlexibility||0);
  const maximumDetour=b.maximumDetour!=null?+b.maximumDetour:null;
  // for one_time trips use tripDate as both startDate and endDate so existing queries still work
  const startDate=tripType==='one_time'?b.tripDate:(b.startDate||b.tripDate);
  const endDate=tripType==='one_time'?b.tripDate:(b.endDate||b.tripDate);
  const days=tripType==='one_time'?[dayIndex(b.tripDate)]:(b.days||[]);
  const c=await Commute.create({
    ...b,userId:q.uid,tripType,tripDate:tripType==='one_time'?b.tripDate:null,
    startDate,endDate,days,passengerCapacity,seats,requestedSeats,maleCount,femaleCount,otherCount,vehicleSnapshot,role,
    rideMode,price:+b.price||0,
    timeFlexibility,maximumDetour,
    routeGeo:route?.points||[],
    distanceKm:route?.distanceKm||+(km(b.origin,b.dest)*1.3).toFixed(1),
  });
  await generateOccurrences(c, c.startDate, c.endDate);
  s.json(c);}));

app.get('/api/commutes/mine',auth,h(async(q,s)=>s.json(await Commute.find({userId:q.uid,active:true}).sort('-createdAt'))));
app.get('/api/commutes/:id/occupancy',auth,h(async(q,s)=>{
  const c=await Commute.findOne({_id:q.params.id,active:true});
  if(!c)return s.status(404).json({error:'Commute not found'});
  if(String(c.userId)!==q.uid)return s.status(403).json({error:'Not yours'});
  const date=q.query.date||nextCommuteDate(c);
  const occ=await occurrenceForDate(c,date);
  if(!occ)return s.status(404).json({error:'No occurrence scheduled for that date'});
  const seatState=await ensureBookedSeatNumbers(occ._id);
  const booked=new Set(seatState?.bookedSeatNumbers||[]);
  const selected=new Set(seatState?.selectedSeatNumbers||[]);
  const seats=Array.from({length:occ.passengerCapacity},(_,index)=>({number:index+1,status:booked.has(index+1)?'booked':selected.has(index+1)?'selected':'available'}));
  s.json({date,passengerCapacity:occ.passengerCapacity,occupiedSeats:occ.confirmedSeats,selectedSeats:selected.size,availableSeats:Math.max(0,occ.passengerCapacity-occ.confirmedSeats-selected.size),seats});
}));

app.get('/api/commutes/discover',auth,h(async(q,s)=>{
  const blocked=(await User.findById(q.uid).select('blocked'))?.blocked||[];
  const filter={active:true,paused:false,userId:{$ne:q.uid,$nin:blocked}};
  if(q.query.rideMode)filter.rideMode=q.query.rideMode;
  const commutes=await Commute.find(filter).sort('-createdAt').limit(Math.min(100,Math.max(1,+q.query.limit||30))).populate('userId','name phone verified gender city vehicle profileImage privacy');
  const contacts=await acceptedContactIds(q.uid,commutes.map(c=>c.userId?._id));
  const preciseCommutes=await acceptedCommuteIds(q.uid,commutes.map(c=>c._id));
  const genderCounts=await visibleBookingGenderCounts(commutes.map(c=>c._id),q.uid);
  const ownerIds=commutes.map(c=>c.userId?._id).filter(Boolean);
  const ratings=await Rating.aggregate([{$match:{toUser:{$in:ownerIds}}},{$group:{_id:'$toUser',avg:{$avg:'$stars'},count:{$sum:1}}}]);
  const ratingMap=Object.fromEntries(ratings.map(item=>[String(item._id),item]));
  const dates=commutes.map(c=>nextCommuteDate(c));
  const occurrences=await Promise.all(commutes.map((c,index)=>occurrenceForDate(c,dates[index])));
  s.json(commutes.map((c,index)=>{
    const rating=ratingMap[String(c.userId?._id)]||{};
    const occ=occurrences[index];
    return {
      ...publicCommute(c,{precise:preciseCommutes.has(String(c._id))}),
      passengerCapacity:capacityOf(c),
      nextOccurrenceDate:dates[index],
      availableSeats:occ&&occ.status==='active'?Math.max(0,occ.passengerCapacity-occ.confirmedSeats-(occ.selectedSeatNumbers||[]).length):0,
      genderCounts:genderCounts[String(c._id)]||{},
      user:{...pub(c.userId,{hasContact:contacts.has(String(c.userId?._id))}),avg:rating.avg?+rating.avg.toFixed(1):0,count:rating.count||0},
    };
  }));
}));

app.get('/api/commutes/:id',auth,h(async(q,s)=>{
  const c=await Commute.findById(q.params.id).populate('userId','name phone email profileImage verified gender city vehicle privacy');
  if(!c||!c.userId)return s.status(404).json({error:'Commute not found'});
  const isOwner=String(c.userId._id)===q.uid;
  const [contacts,preciseCommutes]=await Promise.all([acceptedContactIds(q.uid,[c.userId._id]),acceptedCommuteIds(q.uid,[c._id])]);
  s.json({...publicCommute(c,{precise:isOwner||preciseCommutes.has(String(c._id))}),score:0,user:pub(c.userId,{isOwner,hasContact:contacts.has(String(c.userId._id))})});
}));

app.patch('/api/commutes/:id',auth,h(async(q,s)=>{const c=await Commute.findOne({_id:q.params.id,userId:q.uid});if(!c)return s.status(404).json({error:'Not found'});
  const changeFields=['origin','dest','days','startTime','endTime','startDate','endDate','role','rideMode','price','paused','active','passengerCapacity','seats','timeFlexibility','maximumDetour'];
  const changed=changeFields.some(key=>q.body[key]!==undefined);
  if(q.body.paused!==undefined)c.paused=q.body.paused;if(q.body.active!==undefined)c.active=q.body.active;
  ['origin','dest','days','startTime','endTime','startDate','endDate','tripDate','tripType','role','rideMode','price'].forEach(k=>{if(q.body[k]!==undefined)c[k]=q.body[k]});
  if(q.body.passengerCapacity!==undefined||q.body.seats!==undefined){c.passengerCapacity=+q.body.passengerCapacity||+q.body.seats;c.seats=c.passengerCapacity;}
  if(q.body.timeFlexibility!==undefined)c.timeFlexibility=Math.max(0,+q.body.timeFlexibility||0);
  if(q.body.maximumDetour!==undefined)c.maximumDetour=q.body.maximumDetour!=null?+q.body.maximumDetour:null;
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

// ---- ride occurrences

// GET /api/occurrences?commuteId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns (and lazily generates) all occurrences for a commute in the window.
// The owner can also see cancelled occurrences; everyone else only sees active/full.
app.get('/api/occurrences', auth, h(async (q, s) => {
  const { commuteId, from, to } = q.query;
  if (!commuteId) return s.status(400).json({ error: 'commuteId is required' });

  const commute = await Commute.findById(commuteId);
  if (!commute || !commute.active) return s.status(404).json({ error: 'Commute not found' });

  const today = new Date().toISOString().slice(0, 10);
  const window = {
    from: from || today,
    to:   to   || (commute.endDate || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)),
  };

  await generateOccurrences(commute, window.from, window.to);
  const occurrences = await RideOccurrence.find({ commuteId: commute._id, date: { $gte: window.from, $lte: window.to } }).sort({ date: 1 });
  const isOwner = String(commute.userId) === q.uid;

  // Non-owners only see non-cancelled occurrences
  const visible = isOwner
    ? occurrences
    : occurrences.filter(o => o.status !== 'cancelled');
  const seatStates = await Promise.all(visible.map(o => ensureBookedSeatNumbers(o._id)));
  const pendingRequests = await Request.find({
    occurrenceId: { $in: visible.map(o => o._id) },
    fromUser: q.uid,
    status: 'pending',
  }).select('occurrenceId seatNumber').lean();
  const mySeats = Object.fromEntries(pendingRequests.map(r => [String(r.occurrenceId), r.seatNumber]));

  s.json(visible.map((o, index) => {
    const seatState = seatStates[index] || o;
    const booked = new Set(seatState.bookedSeatNumbers || []);
    const selected = new Set(seatState.selectedSeatNumbers || []);
    const seats = Array.from({ length: o.passengerCapacity }, (_, seatIndex) => {
      const number = seatIndex + 1;
      const status = o.status === 'cancelled' || o.status === 'completed'
        ? o.status
        : booked.has(number) ? 'booked' : selected.has(number) ? 'selected' : 'available';
      return { number, status };
    });
    return {
    _id:              o._id,
    commuteId:        o.commuteId,
    date:             o.date,
    startTime:        o.startTime,
    endTime:          o.endTime,
    origin:           o.origin,
    dest:             o.dest,
    passengerCapacity: o.passengerCapacity,
    initialSeats:     o.initialSeats || 0,
    confirmedSeats:   o.confirmedSeats,
    selectedSeats:    (seatState.selectedSeatNumbers || []).length,
    bookedSeatNumbers: seatState.bookedSeatNumbers || [],
    selectedSeatNumbers: seatState.selectedSeatNumbers || [],
    mySelectedSeat:   mySeats[String(o._id)] || null,
    seats,
    availableSeats:   o.status === 'active' ? Math.max(0, o.passengerCapacity - o.confirmedSeats - (seatState.selectedSeatNumbers || []).length) : 0,
    status:           o.status,
    cancellationReason: o.cancellationReason || null,
    };
  }));
}));

// PATCH /api/occurrences/:id
// Owner only.  Supported transitions:
//   { status: 'cancelled', reason: '...' }  — cancel a single date
//   { status: 'active' }                    — un-cancel (if it was cancelled and hasn't happened yet)
//   { status: 'completed' }                 — mark as done
app.patch('/api/occurrences/:id', auth, h(async (q, s) => {
  const occ = await RideOccurrence.findById(q.params.id);
  if (!occ) return s.status(404).json({ error: 'Occurrence not found' });
  if (String(occ.userId) !== q.uid) return s.status(403).json({ error: 'Not your commute' });

  const { status, reason } = q.body;
  const allowed = ['cancelled', 'active', 'completed'];
  if (!allowed.includes(status)) return s.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });

  const today = new Date().toISOString().slice(0, 10);

  if (status === 'cancelled') {
    if (occ.status === 'completed') return s.status(400).json({ error: 'Cannot cancel a completed ride' });
    occ.status = 'cancelled';
    occ.cancellationReason = reason || null;
    occ.confirmedSeats = 0;
    occ.bookedSeatNumbers = [];
    occ.selectedSeatNumbers = [];
    await occ.save();
    // Cancel all confirmed bookings for this occurrence
    await Booking.updateMany({ occurrenceId: occ._id, status: 'confirmed' }, { status: 'cancelled' });
    await Request.updateMany({ occurrenceId: occ._id, status: { $in: ['pending', 'accepted'] } }, { status: 'cancelled' });
  } else if (status === 'active') {
    if (occ.status !== 'cancelled') return s.status(400).json({ error: 'Only cancelled occurrences can be restored' });
    if (occ.date < today) return s.status(400).json({ error: 'Cannot restore a past occurrence' });
    occ.confirmedSeats = occ.initialSeats || 0;
    occ.bookedSeatNumbers = Array.from({ length: occ.initialSeats || 0 }, (_, index) => index + 1);
    occ.selectedSeatNumbers = [];
    occ.status = occ.confirmedSeats >= occ.passengerCapacity ? 'full' : 'active';
    occ.cancellationReason = null;
  } else if (status === 'completed') {
    if (!['active', 'full'].includes(occ.status)) return s.status(400).json({ error: 'Only active or full occurrences can be completed' });
    occ.status = 'completed';
  }

  await occ.save();
  s.json(occ);
}));

app.post('/api/commutes/:id/cancel-future', auth, h(async (q, s) => {
  const commute = await Commute.findOne({ _id: q.params.id, userId: q.uid });
  if (!commute) return s.status(404).json({ error: 'Commute not found' });
  const today = new Date().toISOString().slice(0, 10);
  await generateOccurrences(commute, today, commute.endDate || today);
  const future = await RideOccurrence.find({
    commuteId: commute._id,
    date: { $gte: today },
    status: { $nin: ['cancelled', 'completed'] },
  }).select('_id');
  const occurrenceIds = future.map(o => o._id);
  if (occurrenceIds.length) {
    await RideOccurrence.updateMany({ _id: { $in: occurrenceIds } }, {
      $set: { status: 'cancelled', cancellationReason: 'Future commute dates cancelled', confirmedSeats: 0, bookedSeatNumbers: [], selectedSeatNumbers: [] },
    });
    await Booking.updateMany({ occurrenceId: { $in: occurrenceIds }, status: 'confirmed' }, { status: 'cancelled' });
    await Request.updateMany({ occurrenceId: { $in: occurrenceIds }, status: { $in: ['pending', 'accepted'] } }, { status: 'cancelled' });
  }
  commute.cancelledFromDate = commute.cancelledFromDate && commute.cancelledFromDate < today ? commute.cancelledFromDate : today;
  await commute.save();
  s.json({ cancelledOccurrences: occurrenceIds.length, cancelledFromDate: commute.cancelledFromDate });
}));

// ---- matching engine v2
app.post('/api/match',auth,h(async(q,s)=>{const m=q.body,me=await User.findById(q.uid);
  const blocked=Array.isArray(me.blocked)?me.blocked:[];
  const cs=await Commute.find({active:true,paused:false,userId:{$ne:q.uid,$nin:blocked}}).populate('userId','name phone verified gender city vehicle profileImage privacy');
  const contacts=await acceptedContactIds(q.uid,cs.map(c=>c.userId?._id));
  const preciseCommutes=await acceptedCommuteIds(q.uid,cs.map(c=>c._id));
  const genderCounts=await visibleBookingGenderCounts(cs.map(c=>c._id),q.uid);

  // Build a set of commuteIds that have at least one active occurrence with
  // available seats.  Commutes with zero qualifying occurrences are excluded.
  // We generate occurrences for the query window so the check is current.
  const queryFrom = m.tripType==='one_time' ? m.tripDate : (m.startDate||new Date().toISOString().slice(0,10));
  const queryTo   = m.tripType==='one_time' ? m.tripDate : (m.endDate||new Date(Date.now()+90*864e5).toISOString().slice(0,10));
  const requestedDates = new Set(occurrenceDates(m, queryFrom, queryTo));
  await Promise.all(cs.map(c=>generateOccurrences(c, queryFrom, queryTo)));
  const openOccurrences = await RideOccurrence.find({
    commuteId: { $in: cs.map(c=>c._id) },
    status: 'active',
    date: { $in: [...requestedDates] },
    $expr: { $lt: [{ $add: ['$confirmedSeats', { $size: { $ifNull: ['$selectedSeatNumbers', []] } }] }, '$passengerCapacity'] },
  }).lean();
  const occurrenceMap = new Map();
  for(const occurrence of openOccurrences){
    const key=String(occurrence.commuteId);
    occurrenceMap.set(key,[...(occurrenceMap.get(key)||[]),occurrence]);
  }

  const rs=await Rating.aggregate([{$group:{_id:'$toUser',avg:{$avg:'$stars'},count:{$sum:1}}}]);
  const R=Object.fromEntries(rs.map(r=>[String(r._id),r]));
  const out=[];
  const now=new Date().toISOString().slice(0,10);
  const mType=m.tripType==='one_time'?'one_time':'recurring';

  for(const c of cs){if(!c.userId)continue;

    // ── Hard constraint: role compatibility ─────────────────────────────────
    const compatible=(m.role==='either'||c.role==='either')||(m.role==='need'&&c.role==='offer')||(m.role==='offer'&&c.role==='need');
    if(!compatible)continue;

    // ── Hard constraint: date/type compatibility ─────────────────────────────
    const cType=c.tripType||'recurring';
    if(mType==='one_time'&&cType==='one_time'){
      if(!m.tripDate||!c.tripDate||m.tripDate!==c.tripDate)continue;
    } else if(mType==='one_time'&&cType==='recurring'){
      const d=m.tripDate;if(!d)continue;
      if(c.endDate&&c.endDate<d)continue;
      if(c.startDate&&c.startDate>d)continue;
      if(c.days&&c.days.length>0&&!c.days.includes(dayIndex(d)))continue;
    } else if(mType==='recurring'&&cType==='one_time'){
      const d=c.tripDate;if(!d)continue;
      if(m.endDate&&m.endDate<d)continue;
      if(m.startDate&&m.startDate>d)continue;
      if(m.days&&m.days.length>0&&!m.days.includes(dayIndex(d)))continue;
    } else {
      if(c.endDate&&c.endDate<now)continue;
      if(m.startDate&&m.endDate&&c.startDate&&c.endDate&&(c.endDate<m.startDate||m.endDate<c.startDate))continue;
    }

    const matchingOccurrences=(occurrenceMap.get(String(c._id))||[]).filter(o=>requestedDates.has(o.date));
    if(!matchingOccurrences.length)continue;
    const seatsAvailable=Math.max(...matchingOccurrences.map(o=>o.passengerCapacity-o.confirmedSeats-(o.selectedSeatNumbers||[]).length));

    // ── Hard constraint: maximum detour ──────────────────────────────────────
    const os=km(m.origin,c.origin),ds=km(m.dest,c.dest);
    const totalDetour=os+ds;
    if(m.maximumDetour!=null&&totalDetour>+m.maximumDetour)continue;
    if(c.maximumDetour!=null&&totalDetour>+c.maximumDetour)continue;

    // ── Scored: route overlap ────────────────────────────────────────────────
    let routeScore=0,distAlong=0;
    if(c.routeGeo&&c.routeGeo.length>1){
      const rr=routeOverlap(c.routeGeo,m.origin,m.dest);routeScore=rr.overlapScore;distAlong=rr.distAlongRoute;
    }else{
      const base=km(c.origin,c.dest);routeScore=Math.max(0,1-(os+ds)/Math.max(base,0.5));
    }

    // ── Scored: time overlap with flexibility window ──────────────────────────
    const mFlex=Math.max(0,+m.timeFlexibility||0);
    const cFlex=Math.max(0,+c.timeFlexibility||0);
    const ts1=mins(m.startTime)-mFlex, te1=mins(m.endTime)+mFlex;
    const ts2=mins(c.startTime)-cFlex, te2=mins(c.endTime)+cFlex;
    const overlapMin=Math.min(te1,te2)-Math.max(ts1,ts2);
    const timeScore=overlapMin>0?Math.min(1,overlapMin/Math.max(1,Math.min(te1-ts1,te2-ts2))):0;

    // ── Scored: day overlap ──────────────────────────────────────────────────
    let dayScore=1;
    if(mType==='recurring'&&cType==='recurring'){
      dayScore=(m.days||[]).filter(z=>c.days.includes(z)).length/Math.max(1,(m.days||[]).length);
    }

    const score=Math.round(100*(0.35*routeScore+0.2*timeScore+0.2*dayScore+0.1*Math.max(0,1-os/5)+0.05*Math.max(0,1-ds/5)+0.05));
    if(score>=25){
      const r=R[String(c.userId._id)]||{};
      const mDays=mType==='recurring'?(m.days||[]).filter(z=>c.days.includes(z)):[];
      const flexLabel=mFlex>0||cFlex>0?`±${Math.max(mFlex,cFlex)} min`:'Exact time';
      out.push({...publicCommute(c,{precise:preciseCommutes.has(String(c._id))}),score,originKm:+os.toFixed(1),destKm:+ds.toFixed(1),explanation:{
        routeOverlap:+((routeScore||0)*100).toFixed(0),
        timeOverlap:timeScore>0.8?`Similar departure (${flexLabel})`:timeScore>0.5?'Partial overlap':'Different schedule',
        daysOverlap:mType==='one_time'?'Single date':(mDays.length+'/'+(m.days||[]).length+' days'+(mDays.length===0?' (no overlap)':'')),
        pickupAlongRoute:+distAlong.toFixed(1),
        seatsAvailable,
        availableDates:matchingOccurrences.map(o=>({date:o.date,availableSeats:o.passengerCapacity-o.confirmedSeats-(o.selectedSeatNumbers||[]).length})),
        tripType:cType,
        hasLiveOccurrences: true,
      },passengerCapacity:capacityOf(c),availableSeats:seatsAvailable,genderCounts:genderCounts[String(c._id)]||{},user:{...pub(c.userId,{hasContact:contacts.has(String(c.userId._id))}),avg:r.avg?+r.avg.toFixed(1):0,count:r.count||0}});
    }
  }
  s.json(out.sort((a,b)=>b.score-a.score));
}));

// ---- join requests
app.post('/api/requests',auth,h(async(q,s)=>{
  const c=await Commute.findById(q.body.commuteId).populate('userId');
  if(!c)return s.status(404).json({error:'Commute not found'});
  if(String(c.userId._id)===q.uid)return s.status(400).json({error:'This is your own commute'});

  // Resolve the requested date — for one-time commutes use tripDate; for
  // recurring, the caller must supply requestedDate.
  const requestedDate = q.body.requestedDate
    || (c.tripType==='one_time' ? c.tripDate : null);
  if(!requestedDate) return s.status(400).json({error:'Provide a requestedDate for recurring commutes'});
  if(await Request.findOne({commuteId:c._id,fromUser:q.uid,requestedDate,status:{$in:['pending','accepted']}}))return s.status(400).json({error:'Already requested for this date'});

  // Ensure occurrence exists and has room
  const occ = await occurrenceForDate(c, requestedDate);
  if(!occ) return s.status(400).json({error:'No ride scheduled on that date'});
  if(occ.status==='cancelled') return s.status(400).json({error:'This ride date has been cancelled'});
  if(occ.status==='completed') return s.status(400).json({error:'This ride has already completed'});
  if(occ.status==='full'||occ.confirmedSeats>=occ.passengerCapacity)
    return s.status(400).json({error:'No seats available on that date'});
  const seatNumber=+q.body.seatNumber;
  if(!Number.isInteger(seatNumber)||seatNumber<1||seatNumber>occ.passengerCapacity)
    return s.status(400).json({error:'Select a valid passenger seat'});
  const selected=await selectSeat(occ._id,seatNumber);
  if(!selected)return s.status(409).json({error:'That seat was just selected or booked. Choose another seat.'});

  const fromUser=await User.findById(q.uid);
  let req;
  try {
    req=await Request.create({
      commuteId:c._id,
      occurrenceId:occ._id,
      fromUser:q.uid,
      toUser:c.userId._id,
      requestedDate,
      seatNumber,
      message:q.body.message,
    });
  } catch(error) {
    await releaseSelectedSeat(occ._id,seatNumber);
    if(error.code===11000)return s.status(409).json({error:'That seat already has a pending selection'});
    throw error;
  }
  await notify({userId:c.userId._id,type:'BOOKING_REQUEST',message:`${pub(fromUser).name} wants to join your ride`,rideId:c._id,commuteId:c._id,data:{requestId:req._id,requestedDate:req.requestedDate,seatNumber:req.seatNumber}});
  s.json(req);
}));

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

app.patch('/api/requests/:id',auth,h(async(q,s)=>{
  const r=await Request.findOne({_id:q.params.id,$or:[{toUser:q.uid},{fromUser:q.uid}]}).populate('fromUser','name phone email profileImage verified gender city vehicle privacy');
  if(!r)return s.status(404).json({error:'Not found'});
  const nextStatus=q.body.status;
  if(!['accepted','rejected','cancelled'].includes(nextStatus))return s.status(400).json({error:'Invalid request status'});
  const owner=String(r.toUser)===q.uid;
  if(nextStatus!=='cancelled'&&!owner)return s.status(403).json({error:'Only the ride owner can accept or reject'});

  let booking=null;
  if(nextStatus==='accepted'){
    if(r.status!=='pending')return s.status(400).json({error:'Only pending requests can be accepted'});
    const occId = r.occurrenceId
      || (await RideOccurrence.findOne({commuteId:r.commuteId,date:r.requestedDate}).lean())?._id;
    if(!occId) return s.status(400).json({error:'No occurrence found for this request date'});
    const seatState=await ensureBookedSeatNumbers(occId);
    let seatNumber=r.seatNumber;
    if(!Number.isInteger(seatNumber)){
      const booked=new Set(seatState?.bookedSeatNumbers||[]);
      const selected=new Set(seatState?.selectedSeatNumbers||[]);
      seatNumber=Array.from({length:seatState?.passengerCapacity||0},(_,index)=>index+1).find(number=>!booked.has(number)&&!selected.has(number));
      if(seatNumber&& !await selectSeat(occId,seatNumber))seatNumber=null;
    }
    if(!Number.isInteger(seatNumber))return s.status(400).json({error:'No seat is selected for this request'});
    const reserved = await reserveSeat(occId,seatNumber);
    if(!reserved) return s.status(409).json({error:'That seat is no longer available. Ask the passenger to select another seat.'});

    r.seatNumber=seatNumber;r.status='accepted'; await r.save();
    booking = await Booking.findOneAndUpdate(
      {requestId:r._id},
      {commuteId:r.commuteId,occurrenceId:occId,passengerId:r.fromUser._id,
       requestId:r._id,acceptedBy:q.uid,requestedDate:r.requestedDate,seatNumber,status:'confirmed'},
      {upsert:true,new:true,setDefaultsOnInsert:true}
    );
    await notify({userId:r.fromUser._id,type:'BOOKING_ACCEPTED',message:'Your ride request was accepted!',rideId:r.commuteId,commuteId:r.commuteId,bookingId:booking._id,data:{requestId:r._id,requestedDate:r.requestedDate,seatNumber}});
  } else {
    const previousStatus=r.status;
    r.status=nextStatus; await r.save();
    if(nextStatus==='cancelled'){
      const b=await Booking.findOneAndUpdate(
        {requestId:r._id,status:{$in:['pending','confirmed']}},
        {status:'cancelled'},
        {new:true}
      );
      // Release the seat if the booking was already confirmed
      if(b?.occurrenceId) await releaseSeat(b.occurrenceId,b.seatNumber);
      else if(previousStatus==='pending')await releaseSelectedSeat(r.occurrenceId,r.seatNumber);
      const recipient=String(r.fromUser._id)===q.uid?r.toUser:r.fromUser._id;
      await notify({userId:recipient,type:'BOOKING_CANCELLED',message:'A ride request was cancelled.',rideId:r.commuteId,commuteId:r.commuteId,bookingId:b?._id,data:{requestId:r._id,requestedDate:r.requestedDate,seatNumber:r.seatNumber}});
    }
    if(nextStatus==='rejected'&&previousStatus==='pending')await releaseSelectedSeat(r.occurrenceId,r.seatNumber);
    if(nextStatus==='rejected')
      await notify({userId:r.fromUser._id,type:'BOOKING_REJECTED',message:'Your request was declined',rideId:r.commuteId,commuteId:r.commuteId,data:{requestId:r._id,requestedDate:r.requestedDate,seatNumber:r.seatNumber}});
  }
  const response=r.toObject();
  const contacts=await acceptedContactIds(q.uid,[r.fromUser?._id,r.toUser?._id||r.toUser]);
  response.fromUser=pub(r.fromUser,{isOwner:String(r.fromUser?._id)===q.uid,hasContact:contacts.has(String(r.fromUser?._id))});
  s.json(booking?{request:response,booking}:response);
}));

app.get('/api/bookings/mine',auth,h(async(q,s)=>{
  const bookings=await Booking.find({passengerId:q.uid}).sort('-createdAt').populate('commuteId').lean();
  const preciseCommutes=await acceptedCommuteIds(q.uid,bookings.map(booking=>booking.commuteId?._id));
  s.json(bookings.map(booking=>({...booking,commuteId:booking.commuteId?publicCommute(booking.commuteId,{precise:preciseCommutes.has(String(booking.commuteId._id))}):null})));
}));
app.patch('/api/bookings/:id',auth,h(async(q,s)=>{
  const b=await Booking.findById(q.params.id).populate('commuteId');
  if(!b)return s.status(404).json({error:'Not found'});
  if(String(b.passengerId)!==q.uid&&String(b.commuteId.userId)!==q.uid)return s.status(403).json({error:'Not allowed'});
  if(!['cancelled','completed'].includes(q.body.status))return s.status(400).json({error:'Invalid booking status'});
  const prev=b.status;
  b.status=q.body.status; await b.save();
  if(q.body.status==='cancelled'){
    // Release seat when a confirmed booking is cancelled
    if(prev==='confirmed'){
      if(b.occurrenceId) await releaseSeat(b.occurrenceId,b.seatNumber);
      if(b.requestId) await Request.updateOne({_id:b.requestId,status:'accepted'},{status:'cancelled'});
    }
    const recipient=String(b.passengerId)===q.uid?b.commuteId.userId:b.passengerId;
    await notify({userId:recipient,type:'BOOKING_CANCELLED',message:'A confirmed ride was cancelled.',rideId:b.commuteId._id,commuteId:b.commuteId._id,bookingId:b._id,data:{requestId:b.requestId,requestedDate:b.requestedDate,seatNumber:b.seatNumber}});
  }
  s.json(b);
}));

// ---- trips + cost split
app.post('/api/trips',auth,h(async(q,s)=>{const{commuteId,distanceKm,fare}=q.body,c=await Commute.findOne({_id:commuteId,userId:q.uid});if(!c)return s.status(403).json({error:'Not your commute'});
  const tripDate=q.body.tripDate||new Date().toISOString().slice(0,10);const tripDay=q.body.tripDay;
  const bookingFilter={commuteId,status:'confirmed',$or:[{requestedDate:tripDate},{requestedDate:{$exists:false},requestedDay:{$exists:false}}]};if(tripDay!==undefined)bookingFilter.$or.push({requestedDay:+tripDay});
  const bookings=await Booking.find(bookingFilter);const rq=bookings.length?null:await Request.find({commuteId,status:'accepted'});const riders=bookings.length?bookings.map(b=>b.passengerId):rq.map(r=>r.fromUser);if(!riders.length)return s.status(400).json({error:'No accepted riders yet'});
  if(!(+fare>0))return s.status(400).json({error:'Enter the total fare'});
  const t=await Trip.create({commuteId,driverId:q.uid,riders,origin:c.origin,dest:c.dest,tripDate,startTime:c.startTime,endTime:c.endTime,distanceKm:+distanceKm,fare:+fare,perPerson:Math.round(+fare/(riders.length+1)),status:'completed'});
  if(bookings.length)await Booking.updateMany({_id:{$in:bookings.map(b=>b._id)}},{status:'completed'});await Request.updateMany({commuteId,status:'accepted'},{status:'completed',tripId:t._id});await RideOccurrence.updateOne({commuteId,date:tripDate,status:{$in:['active','full']}},{status:'completed'});s.json(t);}));

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