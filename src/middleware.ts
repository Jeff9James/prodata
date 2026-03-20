import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    // If there's an auth error (e.g., network issues, invalid session),
    // don't redirect - let the client handle it. Only redirect for
    // truly unauthenticated users (no user and no auth error).
    if (authError) {
        console.error("Auth error in middleware:", authError.message);
    }

    // Protected routes - redirect unauthenticated users to sign in
    // Only redirect if there's no user AND no auth error (meaning the user
    // explicitly logged out or was never logged in)
    if (!user && !authError && request.nextUrl.pathname.startsWith("/settings")) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/signin";
        url.searchParams.set("redirect", request.nextUrl.pathname);
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         * - auth routes (signup, signin, etc.)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
