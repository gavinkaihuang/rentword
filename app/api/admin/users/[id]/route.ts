import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = parseInt(id);
        const body = await request.json();
        const { password, role } = body;

        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        const data: any = {};
        if (password && password.trim() !== '') {
            data.password = await bcrypt.hash(password, 10);
        }
        if (role) {
            data.role = role;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: { id: true, username: true, role: true, createdAt: true }
        });

        return NextResponse.json({ user });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const userId = parseInt(id);

        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await prisma.user.delete({
            where: { id: userId }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
