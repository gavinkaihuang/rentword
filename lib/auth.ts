import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getJwtKey() {
    const secret = process.env.JWT_SECRET_KEY;

    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('JWT_SECRET_KEY is required in production');
        }
        // Dev-only fallback for local setup convenience.
        return new TextEncoder().encode('dev-only-insecure-secret-key-change-me');
    }

    return new TextEncoder().encode(secret);
}

export async function signToken(payload: any) {
    const key = getJwtKey();
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(key);
}

export async function verifyToken(token: string) {
    try {
        const key = getJwtKey();
        const { payload } = await jwtVerify(token, key);
        return payload;
    } catch (error) {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return await verifyToken(token);
}

export async function getUserId() {
    const session = await getSession();
    return session ? (session.userId as number) : null;
}
