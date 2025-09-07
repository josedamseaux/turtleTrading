// src/main.ts
import { ApplicationConfig, bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient()    // <-- registra HttpClient para toda la app
  ]
}).catch(err => console.error(err));
