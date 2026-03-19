import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);
        if (Number.isNaN(userId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = parseInt((await params).id);
        const task = await prisma.task.findUnique({
            where: { id }
        });

        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        if (task.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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
        const userIdHeader = request.headers.get('x-user-id');
        if (!userIdHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = parseInt(userIdHeader);
        if (Number.isNaN(userId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const id = parseInt((await params).id);
        const body = await request.json();

        const existingTask = await prisma.task.findUnique({ where: { id } });
        if (!existingTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        if (existingTask.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

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
