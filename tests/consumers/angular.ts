import { Component, inject, signal } from '@angular/core';
import { GamepadDirective, GamepadifyService } from 'gamepadify-angular';

@Component({
  selector: 'app-root', standalone: true, imports: [GamepadDirective],
  template: '<output id="count">{{count()}}</output>@if(show()){<button id="action" [gamepad]="\'west\'" (click)="count.update(increment)">Action</button>}',
})
export class App {
  count = signal(0);
  show = signal(true);
  increment = (value: number) => value + 1;
  constructor() {
    const pad = inject(GamepadifyService).controller;
    if (typeof window !== 'undefined') Object.assign(window, { pad, toggle: () => this.show.update(value => !value) });
  }
}
