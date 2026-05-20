import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppShellComponent } from './app/app-shell.component';

bootstrapApplication(AppShellComponent, appConfig)
  .then(() => console.log('App started successfully!'))
  .catch((err) => console.error('Failed to start app:', err));