import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { ConfigPage } from './components/config/ConfigPage';

export const router = createBrowserRouter([
    {
        path: '/',
        element: <App />,
    },
    {
        path: '/config',
        element: <ConfigPage />,
    },
]);
