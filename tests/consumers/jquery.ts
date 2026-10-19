import $ from 'jquery';
import { installGamepadify } from 'gamepadify-jquery';
import { createGamepadSimulator } from 'gamepadify/testing';

installGamepadify($);
installGamepadify($);
const sim = createGamepadSimulator();
let count = 0, show = true;
const root = $('#app');
root.html('<output id="count">0</output><button id="action" data-gamepad="west">Action</button>');
root.on('click', '#action', () => $('#count').text(String(++count)));
root.gamepadify({ source: sim, bodyClass: 'consumer-active' });
root.gamepadify({ showHints: true });
Object.assign(window, { sim, pad: root.gamepadify('instance'), changeBinding: (button: string) => $('#action').attr('data-gamepad', button), rerender: () => root.gamepadify({ bodyClass: 'consumer-active' }), toggle: () => { show = !show; if (show) root.append('<button id="action" data-gamepad="west">Action</button>'); else $('#action').remove(); }, unmount: () => { root.gamepadify('destroy'); root.empty(); } });
