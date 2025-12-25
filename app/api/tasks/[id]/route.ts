import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = parseInt((await params).id);
        const task = await prisma.task.findUnique({
            where: { id }
        });

        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

        return NextResponse.json({ task });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = parseInt((await params).id);
        const body = await request.json();

        // Body should contain { masteredIds: number[], isCompleted: boolean }
        const { masteredIds, isCompleted } = body;

        const updateData: any = {};

        if (masteredIds) {
            updateData.progress = JSON.stringify({ masteredIds });
            updateData.completedCount = masteredIds.length;
        }

        if (isCompleted) {
            updateData.status = 'COMPLETED';
        }

        const task = await prisma.task.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json({ task });

    } catch (error) {
        console.error("Error updating task", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
