import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, Directive, ElementRef, inject, Injectable, InjectionToken, Input, makeEnvironmentProviders, NgZone, PLATFORM_ID } from '@angular/core';
import type { EnvironmentProviders, OnChanges, OnDestroy } from '@angular/core';
import { createGamepadify } from 'gamepadify/core';
import type { BindingInput, GamepadifyController, GamepadifyFactory, GamepadifyOptions } from 'gamepadify';

const factoryToken = new InjectionToken<GamepadifyFactory>('Gamepadify factory');
const optionsToken = new InjectionToken<GamepadifyOptions>('Gamepadify options');

@Injectable()
export class GamepadifyService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly controller: GamepadifyController = inject(factoryToken)({ root: inject(DOCUMENT), ...inject(optionsToken) });

  constructor() {
    afterNextRender(() => { if (this.browser) this.zone.runOutsideAngular(() => this.controller.start()); });
  }

  ngOnDestroy(): void { this.controller.destroy(); }
}

export function provideGamepadify(options: GamepadifyOptions = {}, factory: GamepadifyFactory = createGamepadify): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: factoryToken, useValue: factory }, { provide: optionsToken, useValue: options }, GamepadifyService]);
}

@Directive({ selector: '[gamepad]', standalone: true })
export class GamepadDirective implements OnChanges, OnDestroy {
  @Input({ required: true }) gamepad!: BindingInput;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(GamepadifyService);
  private release?: () => void;

  ngOnChanges(): void { this.release?.(); this.release = this.service.controller.bind(this.element.nativeElement, this.gamepad); }
  ngOnDestroy(): void { this.release?.(); }
}

@Directive({ selector: '[gamepadFocusable]', standalone: true })
export class GamepadFocusableDirective implements OnChanges, OnDestroy {
  @Input() gamepadFocusable: boolean | '' = true;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(GamepadifyService);
  private release?: () => void;

  ngOnChanges(): void { this.release?.(); this.release = this.service.controller.bind(this.element.nativeElement, { focusable: this.gamepadFocusable !== false }); }
  ngOnDestroy(): void { this.release?.(); }
}

export type { BindingInput, GamepadifyOptions } from 'gamepadify';
