import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Event, { IEvent } from '@/database/event.model';

/**
 * GET API route handler for fetching an event by slug
 * 
 * @param req - Next.js request object
 * @param params - Route parameters containing the slug
 * @returns JSON response with event data or error message
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    // Await params to get the slug value (Next.js 15+ requires awaiting params)
    const { slug } = await params;

    // Validate slug parameter
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { message: 'Slug parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate slug format (should be non-empty after trimming)
    const trimmedSlug = slug.trim().toLowerCase();
    if (trimmedSlug.length === 0) {
      return NextResponse.json(
        { message: 'Slug cannot be empty' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Query event by slug (case-insensitive search)
    const event: IEvent | null = await Event.findOne({ slug: trimmedSlug });

    // Handle event not found
    if (!event) {
      return NextResponse.json(
        { message: `Event with slug "${trimmedSlug}" not found` },
        { status: 404 }
      );
    }

    // Return successful response with event data
    return NextResponse.json(
      {
        message: 'Event fetched successfully',
        event: {
          _id: event._id,
          title: event.title,
          slug: event.slug,
          description: event.description,
          overview: event.overview,
          image: event.image,
          venue: event.venue,
          location: event.location,
          date: event.date,
          time: event.time,
          mode: event.mode,
          audience: event.audience,
          agenda: event.agenda,
          organizer: event.organizer,
          tags: event.tags,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    // Log error for debugging (in production, use proper logging service)
    console.error('Error fetching event by slug:', error);

    // Handle known error types
    if (error instanceof Error) {
      // Database connection errors
      if (error.message.includes('MongoServerError') || error.message.includes('connection')) {
        return NextResponse.json(
          { message: 'Database connection error', error: 'Unable to connect to database' },
          { status: 503 }
        );
      }

      // Mongoose validation errors
      if (error.name === 'ValidationError' || error.name === 'CastError') {
        return NextResponse.json(
          { message: 'Invalid request parameters', error: error.message },
          { status: 400 }
        );
      }
    }

    // Generic error response for unexpected errors
    return NextResponse.json(
      {
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}