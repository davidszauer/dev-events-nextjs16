import mongoose, { Schema, Model, Document } from 'mongoose';

/**
 * Interface for Event document
 * Defines the structure and types for Event documents in MongoDB
 */
export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string; // ISO format date string
  time: string; // Normalized time string
  mode: string; // e.g., 'online', 'offline', 'hybrid'
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Event schema definition
 * All fields are required and validated
 */
const eventSchema = new Schema<IEvent>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Title cannot be empty',
      },
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Description cannot be empty',
      },
    },
    overview: {
      type: String,
      required: [true, 'Overview is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Overview cannot be empty',
      },
    },
    image: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Image URL cannot be empty',
      },
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Venue cannot be empty',
      },
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Location cannot be empty',
      },
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      trim: true,
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
      trim: true,
    },
    mode: {
      type: String,
      required: [true, 'Mode is required'],
      trim: true,
      enum: {
        values: ['online', 'offline', 'hybrid'],
        message: 'Mode must be one of: online, offline, hybrid',
      },
    },
    audience: {
      type: String,
      required: [true, 'Audience is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Audience cannot be empty',
      },
    },
    agenda: {
      type: [String],
      required: [true, 'Agenda is required'],
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: 'Agenda must be a non-empty array',
      },
    },
    organizer: {
      type: String,
      required: [true, 'Organizer is required'],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: 'Organizer cannot be empty',
      },
    },
    tags: {
      type: [String],
      required: [true, 'Tags are required'],
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        message: 'Tags must be a non-empty array',
      },
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

/**
 * Generates a URL-friendly slug from a string
 * Converts to lowercase, replaces spaces/special chars with hyphens
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Normalizes date string to ISO format
 * Accepts various date formats and converts to ISO string
 */
function normalizeDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateString}`);
  }
  return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
}

/**
 * Normalizes time string to consistent format (HH:MM)
 * Handles various time input formats
 */
function normalizeTime(timeString: string): string {
  // Remove whitespace
  const trimmed = timeString.trim();
  
  // Try to parse as Date if it includes AM/PM
  if (trimmed.match(/[ap]m/i)) {
    const date = new Date(`2000-01-01 ${trimmed}`);
    if (!isNaN(date.getTime())) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  
  // If already in HH:MM or HH:MM:SS format, extract HH:MM
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10).toString().padStart(2, '0');
    const minutes = timeMatch[2];
    return `${hours}:${minutes}`;
  }
  
  // If format is not recognized, return trimmed string
  return trimmed;
}

/**
 * Pre-save hook: Generates slug from title if title changed
 * Normalizes date to ISO format and time to consistent format
 */
eventSchema.pre<IEvent>('save', async function () {
  const event = this;

  // Generate slug only if title is new or has changed
  if (event.isNew || event.isModified('title')) {
    let baseSlug = generateSlug(event.title);
    let slug = baseSlug;
    let counter = 1;

    // Ensure slug uniqueness by appending a number if needed
    while (true) {
      const existingEvent = await mongoose.model<IEvent>('Event').findOne({ slug });
      if (!existingEvent || existingEvent._id.toString() === event._id.toString()) {
        break;
      }
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    event.slug = slug;
  }

  // Normalize date to ISO format
  if (event.isModified('date') || event.isNew) {
    event.date = normalizeDate(event.date);
  }

  // Normalize time to consistent format
  if (event.isModified('time') || event.isNew) {
    event.time = normalizeTime(event.time);
  }
});

// Create unique index on slug for faster lookups
eventSchema.index({ slug: 1 }, { unique: true });

/**
 * Event model
 * Exported for use throughout the application
 */
export const Event: Model<IEvent> =
  mongoose.models.Event || mongoose.model<IEvent>('Event', eventSchema);
