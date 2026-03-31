import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from './auth.service';

export const loginGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowAddAccount = route.queryParamMap.get('addAccount') === '1';

  return auth.ensureInitialized().pipe(
    map(() => {
      if (allowAddAccount) {
        return true;
      }
      if (!auth.isAuthenticated()) {
        return true;
      }
      return auth.needsOnboarding()
        ? router.createUrlTree(['/onboarding'])
        : router.createUrlTree(['/home']);
    })
  );
};

export const onboardingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureInitialized().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login']);
      }
      return auth.needsOnboarding()
        ? true
        : router.createUrlTree(['/home']);
    })
  );
};

export const homeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureInitialized().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login']);
      }
      return auth.needsOnboarding()
        ? router.createUrlTree(['/onboarding'])
        : true;
    })
  );
};

export const accountGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureInitialized().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login']);
      }
      if (auth.needsOnboarding()) {
        return router.createUrlTree(['/onboarding']);
      }
      if (auth.isGuest()) {
        return router.createUrlTree(['/home']);
      }
      return true;
    })
  );
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureInitialized().pipe(
    map(() => {
      if (!auth.isAuthenticated()) {
        return router.createUrlTree(['/login']);
      }
      if (auth.needsOnboarding()) {
        return router.createUrlTree(['/onboarding']);
      }
      return auth.isAdmin() ? true : router.createUrlTree(['/home']);
    })
  );
};
