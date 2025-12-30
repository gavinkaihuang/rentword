
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
    const cookieStore = await cookies();
    const activeId = cookieStore.get('active_wordbook_id')?.value;

    // Default to 1 if not set
    const activeWordBookId = activeId ? parseInt(activeId) : 1;

    return NextResponse.json({ activeWordBookId });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { wordBookId } = body;

        if (!wordBookId) {
            return NextResponse.json({ error: 'Missing wordBookId' }, { status: 400 });
        }

        const response = NextResponse.json({ success: true, activeWordBookId: wordBookId });

        response.cookies.set('active_wordbook_id', wordBookId.toString(), {
            httpOnly: true,
            path: '/',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 // 1 year
        });

        return response;

    } catch (error) {
        console.error('Error setting active wordbook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
