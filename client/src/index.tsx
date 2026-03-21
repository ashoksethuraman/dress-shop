import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from 'react-redux';
import store from './store';
import { initFirebase } from './services/firebaseClient';
import { authService } from './services/authService';
import { setUser } from './store/userSlice';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

// initialize firebase and hook auth state to Redux
initFirebase();
authService.onAuthStateChanged((u) => {
  store.dispatch(setUser(u));
});
