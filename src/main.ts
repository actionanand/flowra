import { bootstrapApplication } from '@angular/platform-browser';
import { defineCustomElements } from 'ionicons/loader';
import { appConfig } from './app/app.config';
import { App } from './app/app';

defineCustomElements(globalThis.window);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
