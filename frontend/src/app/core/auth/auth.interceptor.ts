import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const AUTH_PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/guest',
  '/api/auth/google',
  '/api/auth/status',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/profiles',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = environment.apiUrl;
  if (!req.url.startsWith(apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const isPublicPath = AUTH_PUBLIC_PATHS.some((path) => req.url.includes(path));
  let authReq = req.clone({ withCredentials: true });
  const token = auth.accessToken();

  if (token && !isPublicPath) {
    authReq = authReq.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isPublicPath ||
        req.url.includes('/api/auth/refresh') ||
        req.headers.has('X-Auth-Retry')
      ) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap(() => {
          const refreshedToken = auth.accessToken();
          if (!refreshedToken) {
            auth.handleUnauthorized();
            return throwError(() => error);
          }

          return next(
            authReq.clone({
              setHeaders: {
                Authorization: `Bearer ${refreshedToken}`,
                'X-Auth-Retry': '1',
              },
            })
          );
        }),
        catchError((refreshError) => {
          auth.handleUnauthorized();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
