import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const response = NextResponse.json({ success: true });

    // Clear the cookie
    response.cookies.delete('auth_token');

    return response;
}
