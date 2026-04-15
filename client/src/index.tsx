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

// Initialize Firebase app (Firestore/Storage)
initFirebase();

// Restore non-sensitive user metadata from localStorage so the UI renders
// correctly on refresh without a flash of unauthenticated state.
// Full session validation happens when the user visits the Profile page.
const restoredUser = authService.restoreUser();
if (restoredUser) {
  store.dispatch(setUser(restoredUser));
}
