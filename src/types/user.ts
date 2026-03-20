export type User = {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
    aud?: string;
    created_at?: string;
};
