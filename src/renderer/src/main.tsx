import { createRoot } from 'react-dom/client'
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/newsreader/opsz-italic.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import 'katex/dist/katex.min.css'
import './styles/app.css'
import './styles/markdown.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)
