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
  profileImagePublicId: { type: String, default: null, select: false },
  verified: { type: Boolean, default: false },
  gender: { type: String, required: true, trim: true },
  city: String,
  currentLocation: {
    publicLabel: String,
    privateCoordinates: { lat: Number, lng: Number },
    capturedAt: Date,
  },
  privacy: {
    name: { type: String, enum: ['visible', 'contact-only', 'hidden'], default: 'visible' },
    profileImage: { type: String, enum: ['visible', 'contact-only', 'hidden'], default: 'visible' },
    location: { type: String, enum: ['visible', 'contact-only', 'hidden'], default: 'visible' },
    email: { type: String, enum: ['visible', 'contact-only', 'hidden'], default: 'contact-only' },
    phone: { type: String, enum: ['visible', 'contact-only', 'hidden'], default: 'contact-only' },
    gender: { type: String, enum: ['visible', 'contact-only', 'hidden'], default: 'visible' },
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
  // tripType distinguishes a single-date trip from a recurring schedule
  tripType: { type: String, enum: ['one_time', 'recurring'], default: 'recurring' },
  // one_time only: the specific date of travel (YYYY-MM-DD)
  tripDate: { type: String, default: null },
  days: [Number],
  cancelledFromDate: { type: String, default: null },
  startTime: String,
  endTime: String,
  startDate: String,
  endDate: String,
  role: String,
  rideMode: { type: String, enum: ['own_vehicle', 'hired_shared_ride'], default: 'own_vehicle' },
  vehicleSnapshot: new Schema({
    make: String,
    model: String,
    type: String,
    color: String,
    passengerCapacity: Number,
  }, { _id: false }),
  requestedSeats: { type: Number, min: 1, default: null },
  maleCount: { type: Number, min: 0, default: 0 },
  femaleCount: { type: Number, min: 0, default: 0 },
  otherCount: { type: Number, min: 0, default: 0 },
  passengerCapacity: { type: Number, min: 1 },
  seats: Number,
  price: Number,
  // flexibility window in minutes (±) applied to departure matching
  timeFlexibility: { type: Number, default: 0 },
  // maximum total detour in km the user is willing to accept; null = no limit
  maximumDetour: { type: Number, default: null },
  active: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  routeGeo: { type: Array, default: [] },
  distanceKm: Number,
}, timestamps));

// ---------------------------------------------------------------------------
// RideOccurrence — one canonical record per (commute, date).
//
// Generated lazily from a Commute template the first time a date is accessed.
// All seat-availability checks, bookings, and requests are scoped to an
// occurrence so that state is date-specific rather than global.
//
// Status lifecycle:
//   active      → seats still available, accepting bookings
//   full        → no seats remaining (auto-set when confirmedSeats == capacity)
//   cancelled   → this date was manually cancelled by the driver
//   completed   → the ride happened and has been finalised
// ---------------------------------------------------------------------------
const RideOccurrence = model('RideOccurrence', new Schema({
  commuteId:      { type: ID, ref: 'Commute', required: true },
  userId:         { type: ID, ref: 'User',    required: true }, // driver / owner
  date:           { type: String, required: true },              // YYYY-MM-DD
  startTime:      { type: String, required: true },              // HH:MM (copied from Commute)
  endTime:        { type: String, required: true },
  origin:         Loc,
  dest:           Loc,
  passengerCapacity: { type: Number, required: true, min: 1 },
  initialSeats:   { type: Number, default: 0, min: 0 },
  initialMaleCount: { type: Number, default: 0, min: 0 },
  initialFemaleCount: { type: Number, default: 0, min: 0 },
  initialOtherCount: { type: Number, default: 0, min: 0 },
  bookedSeatNumbers: { type: [Number], default: [] },
  selectedSeatNumbers: { type: [Number], default: [] },
  confirmedSeats: { type: Number, default: 0 },                  // initial party seats plus accepted bookings
  status: {
    type: String,
    enum: ['active', 'full', 'cancelled', 'completed'],
    default: 'active',
  },
  cancellationReason: { type: String, default: null },
}, timestamps));
// Guarantee one record per commute+date
RideOccurrence.schema.index({ commuteId: 1, date: 1 }, { unique: true });

const SavedLocation = model('SavedLocation', new Schema({
  userId: { type: ID, ref: 'User' }, label: String, name: String,
  lat: Number, lng: Number,
  type: { type: String, enum: ['Home', 'University', 'Work', 'Other'], default: 'Other' },
}, timestamps));

const Notification = model('Notification', new Schema({
  userId: { type: ID, ref: 'User' }, type: String, message: String,
  rideId: ID, commuteId: ID, bookingId: ID, tripId: ID,
  scheduledFor: Date, channel: String, status: { type: String, default: 'pending' },
  read: { type: Boolean, default: false }, data: Schema.Types.Mixed,
}, timestamps));

const Request = model('Request', new Schema({
  commuteId:     { type: ID, ref: 'Commute' },
  occurrenceId:  { type: ID, ref: 'RideOccurrence', default: null }, // which specific date
  fromUser:      { type: ID, ref: 'User' },
  toUser:        { type: ID, ref: 'User' },
  requestedDate: String,
  requestedDay:  Number,
  seatNumber:    { type: Number, min: 1, default: null },
  message:       String,
  status: { type: String, default: 'pending', enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'] },
  tripId: ID,
}, timestamps));
Request.schema.index(
  { occurrenceId: 1, seatNumber: 1 },
  { unique: true, partialFilterExpression: { status: 'pending', occurrenceId: { $type: 'objectId' }, seatNumber: { $type: 'number' } } }
);
Request.schema.index(
  { occurrenceId: 1, fromUser: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'accepted'] }, occurrenceId: { $type: 'objectId' } } }
);

const Booking = model('Booking', new Schema({
  commuteId:     { type: ID, ref: 'Commute', required: true },
  occurrenceId:  { type: ID, ref: 'RideOccurrence', default: null }, // which specific date
  passengerId:   { type: ID, ref: 'User', required: true },
  requestId:     { type: ID, ref: 'Request' },
  acceptedBy:    { type: ID, ref: 'User' },
  requestedDate: String,
  requestedDay:  Number,
  seatNumber:    Number,
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
}, timestamps));
Booking.schema.index({ requestId: 1 }, { unique: true, sparse: true });
Booking.schema.index(
  { occurrenceId: 1, seatNumber: 1 },
  { unique: true, partialFilterExpression: { status: 'confirmed', occurrenceId: { $type: 'objectId' }, seatNumber: { $type: 'number' } } }
);

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
  RideOccurrence,
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
