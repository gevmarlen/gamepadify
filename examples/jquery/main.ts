import $ from 'jquery';
import { installGamepadify } from 'gamepadify-jquery';
import { options } from '../input';
import '../style.css';

installGamepadify($);
$('#app').gamepadify(options);
let count = 0;
$('#app').on('click', 'button', () => $('output').text(`${++count} actions`));
window.addEventListener('pagehide', () => $('#app').gamepadify('destroy'), { once: true });
