import { Component } from '@angular/core';
import { TurtleScannerComponent } from './components/turtle-scanner/turtle-scanner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TurtleScannerComponent],
  template: `
    <app-turtle-scanner></app-turtle-scanner>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e3c72, #2a5298);
    }
  `]
})
export class AppComponent {
  title = 'turtleTradeAngular';
}
