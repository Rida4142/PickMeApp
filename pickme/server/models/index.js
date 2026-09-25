const mongoose = require('mongoose');

const { Schema, model } = mongoose;
const ID = Schema.Types.ObjectId;
const timestamps = { timestamps: true };

const Loc = { name: String, lat: Number, lng: Number };

const User = model('User', new Schema({
  name: String,
  phone: { type: String, unique: true },
  email: String,
  cnic: String,
  password: String,
  verified: { type: Boolean, default: false },
  gender: String,
  city: String,
  rideCapability: { type: String, default: 'need', enum: ['need', 'offer', 'either'] },
  vehicle: { make: String, model: String, type: String, color: String, seats: Number },
  blocked: [ID],
  blockedBy: [ID],
}, timestamps));

const Commute = model('Commute', new Schema({
  userId: { type: ID, ref: 'User' },
  origin: Loc,
  dest: Loc,
  days: [Number],
  startTime: String,
  endTime: String,
  startDate: String,
  endDate: String,
  role: String,
  seats: Number,
  price: Number,
  active: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  routeGeo: { type: Array, default: [] },
  distanceKm: Number,
}, timestamps));

const SavedLocation = model('SavedLocation', new Schema({
  userId: { type: ID, ref: 'User' }, label: String, name: String,
  lat: Number, lng: Number, type: String,
}, timestamps));

const Notification = model('Notification', new Schema({
  userId: { type: ID, ref: 'User' }, type: String, message: String,
  rideId: ID, read: { type: Boolean, default: false }, data: Schema.Types.Mixed,
}, timestamps));

const Request = model('Request', new Schema({
  commuteId: { type: ID, ref: 'Commute' },
  fromUser: { type: ID, ref: 'User' },
  toUser: { type: ID, ref: 'User' },
  status: { type: String, default: 'pending' },
  tripId: ID,
}, timestamps));

const Trip = model('Trip', new Schema({
  commuteId: ID,
  driverId: { type: ID, ref: 'User' },
  riders: [{ type: ID, ref: 'User' }],
  origin: Loc,
  dest: Loc,
  distanceKm: Number,
  fare: Number,
  perPerson: Number,
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'] },
  startTime: String,
  endTime: String,
}, timestamps));

const Rating = model('Rating', new Schema({
  tripId: ID, fromUser: ID, toUser: ID, stars: Number, comment: String,
}, timestamps));

const Report = model('Report', new Schema({
  fromUser: ID, againstUser: ID, reason: String, description: String,
  resolved: { type: Boolean, default: false },
}, timestamps));

module.exports = {
  User,
  Commute,
  SavedLocation,
  Notification,
  Request,
  Trip,
  Rating,
  Report,
  ID,
};
