import { Component, inject, signal } from '@angular/core';
import { GamepadDirective, GamepadifyService } from 'gamepadify-angular';
import type { Button } from 'gamepadify';

@Component({
  selector: 'app-root', standalone: true, imports: [GamepadDirective],
  template: '<output id="count" [attr.data-revision]="revision()">{{count()}}</output>@if(show()){<button id="action" [gamepad]="binding()" (click)="count.update(increment)">Action</button>}',
})
export class App {
  count = signal(0);
  show = signal(true);
  binding = signal<Button>('west');
  revision = signal(0);
  increment = (value: number) => value + 1;
  constructor() {
    const pad = inject(GamepadifyService).controller;
    if (typeof window !== 'undefined') Object.assign(window, { pad, changeBinding: (button: Button) => this.binding.set(button), rerender: () => this.revision.update(value => value + 1), toggle: () => this.show.update(value => !value) });
  }
}
