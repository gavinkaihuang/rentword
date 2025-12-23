import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, password } = body;

        // Hardcoded credentials as requested
        if (username === 'admin' && password === '1234567890') {
            const response = NextResponse.json({ success: true });

            // Set simple auth cookie
            // In production, use a signed JWT or session ID.
            // For this requirements: simple value is sufficient.
            // HttpOnly, Path=/, SameSite=Strict
            response.cookies.set('auth_token', 'valid_user_session', {
                httpOnly: true,
                path: '/',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 7 // 7 days
            });

            return response;
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
