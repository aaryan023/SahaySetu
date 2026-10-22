import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyATq_fequYbJtaiWFrzAfikiPKvfr8QAP8',
  authDomain: 'sahaysetu-6023a.firebaseapp.com',
  projectId: 'sahaysetu-6023a',
  storageBucket: 'sahaysetu-6023a.firebasestorage.app',
  messagingSenderId: '561191257105',
  appId: '1:561191257105:web:c6d48382c52d03473fddb0',
  measurementId: 'G-WVXTYEV3PS'
};

const app = initializeApp(firebaseConfig);
window.firebaseApp = app;

isSupported()
  .then(supported => {
    if (supported) window.firebaseAnalytics = getAnalytics(app);
  })
  .catch(error => console.warn('Firebase Analytics is unavailable in this browser:', error));
