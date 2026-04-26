import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyAE5SkmMNV6iffrI4IWc_Jl0l8I4uHm_Zk',
  authDomain: 'yata-e56f7.firebaseapp.com',
  projectId: 'yata-e56f7',
  storageBucket: 'yata-e56f7.firebasestorage.app',
  messagingSenderId: '322121330042',
  appId: '1:322121330042:web:230fb265c277c340707ac3',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
