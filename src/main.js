import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import * as Theme from './lib/theme.js';

// Before mounting, so the page starts in the chosen colors
Theme.apply(Theme.load());

export default mount(App, { target: document.getElementById('app') });
