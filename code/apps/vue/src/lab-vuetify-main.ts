import { createApp, h, reactive } from 'vue';
import { createVuetify } from 'vuetify';
import LabVuetifyCandidate from './LabVuetifyCandidate.vue';
import 'vuetify/styles';
import './labs.css';
import './lab-candidate-frame.css';

type Example = 'table' | 'form' | 'dialog' | 'nav';
const query = new URLSearchParams(location.search);
const selected = query.get('example');
const example: Example = selected === 'form' || selected === 'dialog' || selected === 'nav' ? selected : 'table';
const state = reactive({ example, keyword: '', status: 'all' as 'all' | 'online' | 'offline', name: '', dialog: false, message: '' });
const localTheme = query.get('theme') === 'light' ? 'light' : 'dark';
const app = createApp({ render: () => h(LabVuetifyCandidate, {
  localTheme,
  example: state.example, 'onUpdate:example': (value: Example) => { state.example = value; window.parent.postMessage({ type: 'lab-candidate-example', value }, location.origin); },
  keyword: state.keyword, 'onUpdate:keyword': (value: string) => { state.keyword = value; },
  status: state.status, 'onUpdate:status': (value: typeof state.status) => { state.status = value; },
  name: state.name, 'onUpdate:name': (value: string) => { state.name = value; },
  dialog: state.dialog, 'onUpdate:dialog': (value: boolean) => { state.dialog = value; },
  message: state.message, 'onUpdate:message': (value: string) => { state.message = value; },
}) });
app.use(createVuetify({ theme: { defaultTheme: 'dark' } }));
app.mount('#app');
