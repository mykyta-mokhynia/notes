import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdPrompt {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: Record<string, string | number | boolean>
  ): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdPrompt;
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private scriptPromise: Promise<boolean> | null = null;

  isConfigured(): boolean {
    return !!environment.googleClientId.trim();
  }

  async renderButton(
    host: HTMLElement,
    onCredential: (credential: string) => void
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    const loaded = await this.ensureLoaded();
    if (!loaded || !window.google?.accounts?.id) {
      return false;
    }

    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: GoogleCredentialResponse) => {
        if (typeof response.credential === 'string' && response.credential.trim()) {
          onCredential(response.credential);
        }
      },
    });

    host.innerHTML = '';
    window.google.accounts.id.renderButton(host, {
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      logo_alignment: 'center',
      shape: 'pill',
      width: host.clientWidth || 320,
    });
    return true;
  }

  private ensureLoaded(): Promise<boolean> {
    if (window.google?.accounts?.id) {
      return Promise.resolve(true);
    }
    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<boolean>((resolve) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-google-identity="true"]'
      );
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset['googleIdentity'] = 'true';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }
}
