import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, RefreshCw, ArrowLeft, Key } from 'lucide-react';

const SETTINGS_STORAGE_KEY = 'raindrop_ai_studio_settings_v1';
const RAINDROP_CACHE_STORAGE_KEY = 'raindrop_ai_studio_cache_v1';

function AuthCallbackContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('Processing Raindrop OAuth authentication...');

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_description') || searchParams.get('error_reason');

    if (error) {
      setStatus('error');
      setMessage(`Raindrop OAuth authorization failed: ${errorReason || error}`);
      return;
    }

    const saveTokensAndRedirect = (
      accessToken: string,
      refreshToken?: string | null,
      expiresIn?: string | number | null
    ) => {
      try {
        const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
        const currentSettings = saved ? JSON.parse(saved) : {};
        const parsedExpiresIn = expiresIn ? Number(expiresIn) : 1209600;
        const expiresAt = Date.now() + (isNaN(parsedExpiresIn) ? 1209600 : parsedExpiresIn) * 1000;

        const updatedSettings = {
          ...currentSettings,
          raindropToken: accessToken,
          ...(refreshToken ? { raindropRefreshToken: refreshToken } : {}),
          raindropExpiresAt: expiresAt,
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
        localStorage.removeItem(RAINDROP_CACHE_STORAGE_KEY);

        setStatus('success');
        setMessage('Successfully authenticated with Raindrop.io! Redirecting to Shower Studio...');

        setTimeout(() => {
          navigate('/');
        }, 1000);
      } catch (err: any) {
        console.error('Failed to save Raindrop token to localStorage:', err);
        setStatus('error');
        setMessage(`Failed to save authentication: ${err.message || 'Unknown error'}`);
      }
    };

    // Check if tokens are passed directly in searchParams or hash (OAuth implicit or server redirect)
    const hashParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash)
      : new URLSearchParams();

    const directAccessToken = searchParams.get('access_token') || hashParams.get('access_token') || searchParams.get('token') || hashParams.get('token');
    const directRefreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');
    const directExpiresIn = searchParams.get('expires_in') || hashParams.get('expires_in');

    if (directAccessToken) {
      saveTokensAndRedirect(directAccessToken, directRefreshToken, directExpiresIn);
      return;
    }

    // Also check if oh-auth stored the token in localStorage
    const ohAuthKey = 'oh-auth:provider-tokens:raindrop';
    const ohTokenRaw = localStorage.getItem(ohAuthKey);
    if (ohTokenRaw) {
      try {
        const parsed = JSON.parse(ohTokenRaw);
        if (parsed?.accessToken) {
          saveTokensAndRedirect(
            parsed.accessToken,
            parsed.refreshToken,
            parsed.expiresIn || (parsed.expiresAt ? Math.round((parsed.expiresAt - Date.now()) / 1000) : 1209600)
          );
          return;
        }
      } catch (e) {
        console.warn('Error reading oh-auth token:', e);
      }
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code or access token found in URL query parameters.');
      return;
    }

    const state = searchParams.get('state');

    const isValidVercelDomain = (urlStr: string) => {
      try {
        const url = new URL(urlStr);
        if (url.hostname === 'localhost') return true;
        if (url.hostname === 'shower-app.vercel.app') return true;
        if (url.hostname.endsWith('.vercel.app')) return true;
        return false;
      } catch {
        return false;
      }
    };

    if (
      state &&
      isValidVercelDomain(state) &&
      !state.startsWith(window.location.origin)
    ) {
      const redirectUriParam = `${window.location.origin}/auth/callback`;
      const bounceUrl = new URL(`${state}/auth/callback`);
      bounceUrl.searchParams.set('code', code);
      bounceUrl.searchParams.set('redirect_uri', redirectUriParam);
      window.location.href = bounceUrl.toString();
      return;
    }

    const exchangeCode = async () => {
      try {
        const paramRedirectUri = searchParams.get('redirect_uri');
        const redirectUri = paramRedirectUri || `${window.location.origin}/auth/callback`;

        const res = await fetch('/api/auth/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code,
            redirect_uri: redirectUri,
          }),
        });

        const data = await res.json();

        if (res.ok && data.status === 'success' && data.access_token) {
          saveTokensAndRedirect(data.access_token, data.refresh_token, data.expires_in);
        } else {
          setStatus('error');
          setMessage(data.message || 'Failed to exchange authorization code for access token.');
        }
      } catch (err: any) {
        console.error('Error during OAuth callback exchange:', err);
        setStatus('error');
        setMessage(`Authentication error: ${err.message || 'Network failure'}`);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-base-300 text-base-content flex items-center justify-center p-4 font-sans">
      <div className="card bg-base-100 border border-base-300 shadow-2xl rounded-3xl p-8 max-w-md w-full text-center relative overflow-hidden">
        <div className="flex justify-center mb-5">
          {status === 'loading' && (
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="w-16 h-16 bg-success/10 text-success rounded-2xl flex items-center justify-center border border-success/20 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          )}
          {status === 'error' && (
            <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center border border-error/20 shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold text-base-content mb-2">
          {status === 'loading' && 'Authenticating with Raindrop.io'}
          {status === 'success' && 'Login Successful!'}
          {status === 'error' && 'Authentication Failed'}
        </h2>

        <p className="text-xs sm:text-sm text-base-content/70 leading-relaxed mb-6">
          {message}
        </p>

        {status === 'error' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary gap-2 w-full"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Home Page
            </button>
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-success">
            <span className="loading loading-dots loading-xs"></span>
            Redirecting...
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-base-300 text-base-content flex items-center justify-center p-4">
          <div className="card bg-base-100 p-8 rounded-3xl shadow-xl flex items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm font-semibold">Loading authentication...</span>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
