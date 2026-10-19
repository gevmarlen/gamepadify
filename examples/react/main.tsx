import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GamepadProvider, useGamepad } from 'gamepadify-react';
import { options } from '../input';
import '../style.css';

function App() {
  const [count, setCount] = useState(0);
  const save = useGamepad<HTMLButtonElement>('xbox:x');
  const first = useGamepad<HTMLButtonElement>({ focusable: true });
  const second = useGamepad<HTMLButtonElement>({ focusable: true });
  const activate = () => setCount(value => value + 1);
  return <><h1>React</h1><p>Press a controller button to start. On Xbox, X saves and A activates the focused card. Other controllers show their own button prompts.</p>
    <button ref={save} onClick={activate}>Save</button>
    <section><button ref={first} onClick={activate}>First card</button><button ref={second} onClick={activate}>Second card</button></section>
    <output>{count} actions</output></>;
}
createRoot(document.getElementById('app')!).render(<StrictMode><GamepadProvider options={options}><App /></GamepadProvider></StrictMode>);
