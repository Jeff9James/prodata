"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { apiGet } from "@/lib/api-client";

interface AmazonConnectButtonProps {
  integrationId: string;
  integrationName: string;
  onAccountAdded: () => void;
  /** Whether OAuth is configured via environment variables */
  oauthConfigured: boolean;
}

export function AmazonConnectButton({
  integrationId,
  integrationName,
  onAccountAdded,
  oauthConfigured,
}: AmazonConnectButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const handleOAuthConnect = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiGet<{
        authUrl?: string;
        error?: string;
      }>("/api/integrations/amazon/connect");

      if (response.error) {
        setError(response.error);
        return;
      }

      if (response.authUrl) {
        // Redirect to Amazon OAuth
        window.location.href = response.authUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start OAuth flow");
    } finally {
      setLoading(false);
    }
  };

  // If OAuth is configured, use OAuth flow
  if (oauthConfigured) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-border/60 bg-background/80 shadow-sm"
          onClick={handleOAuthConnect}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ExternalLink className="mr-2 h-3.5 w-3.5" />
              Connect with Amazon
            </>
          )}
        </Button>
        
        {/* Option to use manual credentials */}
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showManual ? "Use OAuth instead" : "Use manual credentials"}
        </button>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {showManual && (
          <p className="text-xs text-muted-foreground">
            Manual credentials coming soon. Use OAuth for now.
          </p>
        )}
      </div>
    );
  }

  // Fallback: Show manual credential input prompt
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="border-border/60 bg-background/80 shadow-sm"
        onClick={() => setShowManual(!showManual)}
      >
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add Account
      </Button>
      
      {showManual && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">OAuth not configured</p>
          <p className="mt-1 text-xs">
            To enable one-click Amazon connection, set these environment variables:
          </p>
          <ul className="mt-2 list-inside list-disc text-xs">
            <li>AMAZON_LWA_CLIENT_ID</li>
            <li>AMAZON_LWA_CLIENT_SECRET</li>
            <li>AMAZON_APPLICATION_ID</li>
            <li>AMAZON_REDIRECT_URI</li>
          </ul>
        </div>
      )}
    </div>
  );
}
