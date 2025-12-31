import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export default async function ProtectedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const authToken = cookieStore.get('auth_token');

    if (!authToken) {
        redirect('/login');
    }

    const payload = await verifyToken(authToken.value);
    if (!payload) {
        redirect('/login');
    }

    return (
        <div className="relative min-h-screen">
            {/* Global User Badge */}
            <div className="absolute z-50 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg left-4 bottom-4 md:top-4 md:bottom-auto">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-xs font-medium text-[#343b58] font-mono">
                    {payload.username as string}
                    <span className="opacity-50 ml-1">({payload.role as string})</span>
                </span>
            </div>
            {children}
        </div>
    );
}
