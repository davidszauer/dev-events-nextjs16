import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import type { IEvent } from './event.model';

/**
 * Interface for Booking document
 * Defines the structure and types for Booking documents in MongoDB
 */
export interface IBooking extends Document {
  eventId: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Email validation regex pattern
 * Validates standard email format
 */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Booking schema definition
 * References Event model and validates email format
 */
const bookingSchema = new Schema<IBooking>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event ID is required'],
      index: true, // Index for faster queries
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: (value: string) => {
          return emailRegex.test(value);
        },
        message: 'Please provide a valid email address',
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

/**
 * Pre-save hook: Validates that the referenced event exists
 * Throws an error if the eventId does not correspond to an existing Event
 */
bookingSchema.pre<IBooking>('save', async function () {
  const booking = this;

  // Only validate if eventId is new or has been modified
  if (booking.isNew || booking.isModified('eventId')) {
    // Use mongoose.model to avoid circular dependency
    const EventModel = mongoose.model<IEvent>('Event');
    const event = await EventModel.findById(booking.eventId);
    if (!event) {
      throw new Error(`Event with ID ${booking.eventId} does not exist`);
    }
  }
});

// Create index on eventId for faster queries
bookingSchema.index({ eventId: 1 });

/**
 * Booking model
 * Exported for use throughout the application
 */
export const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', bookingSchema);
