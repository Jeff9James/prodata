"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Chrome, LogIn } from "lucide-react";

export function LoginPrompt() {
    return (
        <div className="flex min-h-[80vh] items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <span className="text-2xl font-bold">Oh</span>
                    </div>
                    <CardTitle className="text-3xl">Welcome to OhMyDashboard</CardTitle>
                    <CardDescription className="text-base">
                        A unified dashboard for indie hackers to track all their business metrics in one place.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        <Button asChild className="w-full" size="lg">
                            <Link href="/auth/signin">
                                <LogIn className="mr-2 h-5 w-5" />
                                Sign In
                            </Link>
                        </Button>

                        <Button asChild variant="outline" className="w-full" size="lg">
                            <Link href="/auth/signin">
                                <Chrome className="mr-2 h-5 w-5" />
                                Continue with Google
                            </Link>
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
                                Or
                            </span>
                        </div>
                    </div>

                    <Button asChild variant="ghost" className="w-full" size="lg">
                        <Link href="/auth/signup">
                            Create an account
                        </Link>
                    </Button>

                    <p className="text-center text-sm text-muted-foreground">
                        By signing in, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
