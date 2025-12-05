import { Injectable, computed, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user';
import { AppStateService } from './app-state.service';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

const AUTH_STORAGE_KEY = 'bookstore-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userSignal = signal<User | null>(null);
  private readonly isAuthenticatedSignal = computed(() => this.userSignal() !== null);

  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = this.isAuthenticatedSignal;
  readonly isAdmin = computed(() => {
    const user = this.userSignal();
    return user?.role === 'admin';
  });

  private readonly appState = inject(AppStateService);
  private readonly api = inject(ApiService);

  constructor(private readonly router: Router) {
    this.init();
  }

  // Restore persisted user on service init
  private init(): void {
    const restored = this.restoreUser();
    if (restored) {
      this.userSignal.set(restored);
      this.appState.loadUserData(restored.id);
    }
  }

  // Login checks users on the server. Returns an observable that emits true/false.
  login(email: string, password: string): Observable<boolean> {
    return this.api.getUsers().pipe(map(users => {
      const found = (users || []).find((u: any) => u.email === email && (!u.password || u.password === password));
      if (!found) {
        return false;
      }
      const user: User = {
        id: found.id,
        name: found.name,
        email: found.email,
        role: found.role,
        referralCode: `USER${found.id}`
      };
      this.userSignal.set(user);
      this.persistUser(user);
      // load user-specific data from server
      this.appState.loadUserData(user.id);
      return true;
    }));
  }

  // Register a new user on the server
  register(name: string, email: string, password: string, mobile_number : string): Observable<boolean> {
    // Do not provide an id; let json-server assign one
    const newUserPayload: Partial<User & { password?: string }> = { name, email, password, mobile_number, role: 'customer' as any };
    return this.api.getUsers().pipe(
      switchMap(users => {
        if ((users || []).some((u: any) => u.email === email)) {
          return of(false);
        }
        return this.api.createUser(newUserPayload).pipe(
          map(created => {
            const createdId = created?.id ?? '';
            const user: User = {
              id: String(createdId),
              name: created.name,
              email: created.email,
              role: created.role,
              referralCode: `USER${createdId}`
            };
            this.userSignal.set(user);
            this.persistUser(user);
            this.appState.loadUserData(user.id);
            return true;
          }),
          catchError(() => of(false))
        );
      }),
      catchError(() => of(false))
    );
  }

  logout(): void {
    this.appState.clearUserData();
    this.userSignal.set(null);
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {};
    this.router.navigate(['/login']);
  }

  updateUserProfile(userId: string, updates: {name?: string, email?: string, mobile_number?: string}): Observable<boolean> {
    return this.api.updateUser(userId, updates).pipe(
      map(updated => {
        const current = this.userSignal();
        if (current && updated) {
          const newUser: User = { ...current, name: updated.name || current.name, email: updated.email || current.email };
          this.userSignal.set(newUser);
          this.persistUser(newUser);
        }
        return true;
      }),
      catchError(() => of(false))
    );
  }

  private persistUser(user: User): void {
    try {
      const data = JSON.stringify({ id: user.id, name: user.name, email: user.email, role: user.role, referralCode: user.referralCode });
      localStorage.setItem(AUTH_STORAGE_KEY, data);
    } catch {
      // ignore storage errors
    }
  }

  private restoreUser(): User | null {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.id) return null;
      const user: User = { id: String(parsed.id), name: parsed.name, email: parsed.email, role: parsed.role, referralCode: parsed.referralCode };
      return user;
    } catch {
      return null;
    }
  }

  changePassword(email: string, currentPassword: string, newPassword: string): Observable<boolean> {
    return this.api.getUsers().pipe(
      switchMap(users => {
        const user = (users || []).find((u: any) => u.email === email && u.password === currentPassword);
        if (!user) return of(false);
        return this.api.updateUser(user.id, { password: newPassword }).pipe(
          map(() => {
            this.logout();
            return true;
          }),
          catchError(() => of(false))
        );
      }),
      catchError(() => of(false))
    );
  }
  getCharges(): Observable<any[]> {
    return this.api.getCharges();
  }
}

