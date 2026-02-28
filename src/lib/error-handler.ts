import { NextResponse } from 'next/server';
import { ApiResponseBuilder } from './api-response';
import { AppError } from './errors';
import { ZodError } from 'zod';

/**
 * Standard centralized error handler for API routes
 * Used to catch and format all exceptions thrown during request processing.
 */
export function handleError(error: unknown) {
    // 1. Zod Validation Errors
    if (error instanceof ZodError) {
        const formattedErrors = (error as any).errors.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
        }));

        return NextResponse.json(
            ApiResponseBuilder.error('Validation failed', 'VALIDATION_ERROR', 400, formattedErrors),
            { status: 400 }
        );
    }

    // 2. Operational App Errors (Expected)
    if (error instanceof AppError) {
        return NextResponse.json(
            ApiResponseBuilder.error(error.message, error.code, error.statusCode, error.details),
            { status: error.statusCode }
        );
    }

    // 3. Programmer Errors / Unexpected system failures
    console.error('[Unhandled Exception]:', error); // Required server log, but hidden from client

    return NextResponse.json(
        ApiResponseBuilder.error('An unexpected error occurred on the server.', 'INTERNAL_SERVER_ERROR', 500),
        { status: 500 }
    );
}
