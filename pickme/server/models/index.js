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
  profileImage: { type: String, default: null },
  verified: { type: Boolean, default: false },
  gender: { type: String, required: true, trim: true },
  city: String,
  currentLocation: {
    publicLabel: String,
    privateCoordinates: { lat: Number, lng: Number },
    capturedAt: Date,
  },
  vehicle: new Schema({
    make: String,
    model: String,
    type: String,
    color: String,
    passengerCapacity: { type: Number, min: 1 },
    seats: Number,
    active: { type: Boolean, default: true },
  }, { _id: false }),
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
  rideMode: { type: String, enum: ['own_vehicle', 'hired_shared_ride'], default: 'own_vehicle' },
  passengerCapacity: { type: Number, min: 1 },
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
  rideId: ID, commuteId: ID, bookingId: ID, tripId: ID,
  scheduledFor: Date, channel: String, status: { type: String, default: 'pending' },
  read: { type: Boolean, default: false }, data: Schema.Types.Mixed,
}, timestamps));

const Request = model('Request', new Schema({
  commuteId: { type: ID, ref: 'Commute' },
  fromUser: { type: ID, ref: 'User' },
  toUser: { type: ID, ref: 'User' },
  requestedDate: String,
  requestedDay: Number,
  message: String,
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] },
  tripId: ID,
}, timestamps));

const Booking = model('Booking', new Schema({
  commuteId: { type: ID, ref: 'Commute', required: true },
  passengerId: { type: ID, ref: 'User', required: true },
  requestId: { type: ID, ref: 'Request' },
  acceptedBy: { type: ID, ref: 'User' },
  requestedDate: String,
  requestedDay: Number,
  seatNumber: Number,
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
}, timestamps));
Booking.schema.index({ requestId: 1 }, { unique: true, sparse: true });

const Buddy = model('Buddy', new Schema({
  userId: { type: ID, ref: 'User', required: true },
  buddyId: { type: ID, ref: 'User', required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected', 'blocked', 'removed'] },
}, timestamps));
Buddy.schema.index({ userId: 1, buddyId: 1 }, { unique: true });

const Invitation = model('Invitation', new Schema({
  commuteId: { type: ID, ref: 'Commute', required: true },
  inviterId: { type: ID, ref: 'User', required: true },
  inviteeId: { type: ID, ref: 'User', required: true },
  requestedDate: String,
  requestedDay: Number,
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected', 'cancelled'] },
}, timestamps));

const Trip = model('Trip', new Schema({
  commuteId: ID,
  driverId: { type: ID, ref: 'User' },
  riders: [{ type: ID, ref: 'User' }],
  origin: Loc,
  dest: Loc,
  tripDate: String,
  distanceKm: Number,
  fare: Number,
  perPerson: Number,
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'] },
  startTime: String,
  endTime: String,
}, timestamps));

const Rating = model('Rating', new Schema({
  tripId: { type: ID, ref: 'Trip', required: true },
  fromUser: { type: ID, ref: 'User', required: true },
  toUser: {
    type: ID,
    ref: 'User',
    required: true,
    validate: { validator: function (value) { return !this.fromUser || String(value) !== String(this.fromUser); }, message: 'Users cannot rate themselves' },
  },
  stars: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: { validator: Number.isInteger, message: 'Stars must be an integer from 1 to 5' },
  },
  comment: { type: String, trim: true },
}, timestamps));
Rating.schema.index({ tripId: 1, fromUser: 1, toUser: 1 }, { unique: true });

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
  Booking,
  Buddy,
  Invitation,
  Trip,
  Rating,
  Report,
  ID,
};
