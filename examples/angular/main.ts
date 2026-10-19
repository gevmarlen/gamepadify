import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { GamepadDirective, GamepadFocusableDirective, provideGamepadify } from 'gamepadify-angular';
import { options } from '../input';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [GamepadDirective, GamepadFocusableDirective],
  template: `<h1>Angular</h1><p>Press a controller button to start. On Xbox, X saves and A activates the focused card. Other controllers show their own button prompts.</p>
    <button [gamepad]="'xbox:x'" (click)="activate()">Save</button>
    <section><button gamepadFocusable (click)="activate()">First card</button><button gamepadFocusable (click)="activate()">Second card</button></section>
    <output>{{ count() }} actions</output>`,
})
class App {
  count = signal(0);
  activate() { this.count.update(value => value + 1); }
}
bootstrapApplication(App, { providers: [provideZonelessChangeDetection(), provideGamepadify(options)] });
