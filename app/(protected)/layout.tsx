import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

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

    return <>{children}</>;
}
