import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

const PROTECTED_ROUTES = [
    '/learn',
    '/mistakes',
    '/stats',
    '/admin',
    '/select',
    '/calendar'
];

// API routes that require auth (almost all except login)
const PROTECTED_API_PREFIXES = [
    '/api/learn',
    '/api/mistakes',
    '/api/stats',
    '/api/tasks',
    '/api/wordbooks',
    '/api/admin',
    '/api/calendar'
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if path is protected
    const isProtectedPage = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix));

    if (!isProtectedPage && !isProtectedApi) {
        return NextResponse.next();
    }

    const token = request.cookies.get('auth_token')?.value;
    const session = token ? await verifyToken(token) : null;

    if (!session) {
        if (isProtectedApi) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Role check for admin
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        if (session.role !== 'ADMIN') {
            if (isProtectedApi) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
            return NextResponse.redirect(new URL('/', request.url));
        }
    }

    // Inject user info into headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(session.userId));
    requestHeaders.set('x-user-role', String(session.role));

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
