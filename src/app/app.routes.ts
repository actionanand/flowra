import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then((module) => module.Home),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./features/calendar/calendar').then((module) => module.CalendarPage),
  },
  {
    path: 'log',
    loadComponent: () => import('./features/log/log').then((module) => module.LogPage),
  },
  {
    path: 'insights',
    loadComponent: () =>
      import('./features/insights/insights').then((module) => module.InsightsPage),
  },
  {
    path: 'profiles',
    loadComponent: () =>
      import('./features/profiles/profiles').then((module) => module.ProfilesPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings').then((module) => module.SettingsPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: '**', redirectTo: 'home' },
];
