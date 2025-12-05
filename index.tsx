import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import * as firebaseApp from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile as updateFirebaseProfile,
  updatePassword,
  updateEmail,
  sendPasswordResetEmail
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc,
  getDoc
} from "firebase/firestore";
import {
  Activity,
  Droplet,
  Pill,
  Download,
  Printer,
  Brain,
  LogOut,
  User as UserIcon,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Stethoscope,
  ClipboardList,
  Settings,
  Loader2,
  Clock,
  Calendar,
  BarChart2,
  List,
  Heart,
  Mail,
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBhWsjTfF2191NGV9VRT_L2PjPxO8Fm8js",
  authDomain: "health-tracker-d1bad.firebaseapp.com",
  projectId: "health-tracker-d1bad",
  storageBucket: "health-tracker-d1bad.firebasestorage.app",
  messagingSenderId: "1041512043894",
  appId: "1:1041512043894:web:9ba1494143fe863ed71657",
  measurementId: "G-SJCER4MWR4"
};

const app = firebaseApp.initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = 'default-app-id';

// --- Types ---

type UserProfile = {
  uid: string;
  name: string;
  email: string;
  age: number;
};

type RecordType = 'bp' | 'sugar' | 'pulse' | 'heartrate' | 'medicine';

interface HealthRecord {
  id: string;
  type: RecordType;
  date: string;
  timestamp: number;
  systolic?: string;
  diastolic?: string;
  sugarLevel?: string;
  sugarType?: 'Fasting' | 'Post-Prandial' | 'Random';
  bpm?: string;
  spo2?: string;
  medicineName?: string;
  dosage?: string;
  frequency?: string;
}

// --- Components ---

// Interactive Line Chart Component
const SimpleLineChart = ({ data, lines, height = 200 }) => {
  const [selectedPoint, setSelectedPoint] = useState<{x: number, y: number, value: number, label: string, date: string} | null>(null);

  if (!data || data.length < 2) return <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">Not enough data to display chart</div>;

  // Sort data by timestamp ascending
  const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);
  
  // Find min/max for scaling
  let minVal = Infinity;
  let maxVal = -Infinity;
  
  lines.forEach(line => {
    sortedData.forEach(d => {
      const val = parseInt(d[line.key] || 0);
      if (!isNaN(val)) {
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    });
  });

  // Add padding
  const padding = 20;
  const range = maxVal - minVal || 1;
  const chartMin = Math.max(0, minVal - range * 0.1);
  const chartMax = maxVal + range * 0.1;
  
  // SVG Dimensions
  const svgHeight = height;
  const svgWidth = 600; // Fixed width for coordinate system

  const getX = (index) => (index / (sortedData.length - 1)) * (svgWidth - padding * 2) + padding;
  const getY = (val) => svgHeight - padding - ((val - chartMin) / (chartMax - chartMin)) * (svgHeight - padding * 2);

  return (
    <div className="w-full h-full relative" onMouseLeave={() => setSelectedPoint(null)}>
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full block" preserveAspectRatio="none">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line 
            key={i} 
            x1={padding} 
            y1={getY(chartMin + t * (chartMax - chartMin))} 
            x2={svgWidth - padding} 
            y2={getY(chartMin + t * (chartMax - chartMin))} 
            stroke="#e2e8f0" 
            strokeWidth="1" 
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Lines */}
        {lines.map((line) => {
           const points = sortedData.map((d, i) => {
             const val = parseInt(d[line.key]);
             return isNaN(val) ? null : `${getX(i)},${getY(val)}`;
           }).filter(p => p).join(' ');
           
           return (
             <React.Fragment key={line.key}>
                <polyline 
                  points={points} 
                  fill="none" 
                  stroke={line.color} 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
             </React.Fragment>
           );
        })}

        {/* Interactive Dots - Rendered after lines to be on top */}
        {lines.map((line) => 
           sortedData.map((d, i) => {
             const val = parseInt(d[line.key]);
             if (isNaN(val)) return null;
             const cx = getX(i);
             const cy = getY(val);
             
             return (
                <g key={`${line.key}-${i}`} 
                   onMouseEnter={() => {
                     setSelectedPoint({
                       x: cx, 
                       y: cy, 
                       value: val, 
                       label: line.key === 'systolic' ? 'Sys' : line.key === 'diastolic' ? 'Dia' : 'Val',
                       date: new Date(d.timestamp).toLocaleDateString() + ' ' + new Date(d.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                     });
                   }}
                   onClick={(e) => {
                     e.stopPropagation();
                     setSelectedPoint({
                       x: cx, 
                       y: cy, 
                       value: val, 
                       label: line.key === 'systolic' ? 'Sys' : line.key === 'diastolic' ? 'Dia' : 'Val',
                       date: new Date(d.timestamp).toLocaleDateString() + ' ' + new Date(d.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                     });
                   }}
                   className="cursor-pointer group"
                >
                  {/* Invisible larger hit area for easier interaction */}
                  <circle cx={cx} cy={cy} r="15" fill="transparent" />
                  {/* Visible dot */}
                  <circle 
                    cx={cx} 
                    cy={cy} 
                    r="4" 
                    fill="white" 
                    stroke={line.color} 
                    strokeWidth="2" 
                    vectorEffect="non-scaling-stroke"
                    className="transition-all group-hover:r-6"
                  />
                </g>
             );
           })
        )}

        {/* Tooltip rendered last to be visually on top of everything */}
        {selectedPoint && (
          <g transform={`translate(${selectedPoint.x}, ${selectedPoint.y - 15})`} style={{ pointerEvents: 'none' }}>
            {/* Tooltip Background */}
            <rect 
              x="-70" 
              y="-45" 
              width="140" 
              height="50" 
              rx="8" 
              fill="#1e293b" 
              opacity="0.95" 
              filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.3))"
            />
            {/* Arrow */}
            <path d="M -6 5 L 0 12 L 6 5 Z" fill="#1e293b" transform="translate(0, 0)" />
            
            {/* Text */}
            <text x="0" y="-28" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="sans-serif">
              {selectedPoint.date}
            </text>
            <text x="0" y="-12" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="sans-serif">
              {selectedPoint.value} <tspan fontSize="10" fontWeight="normal" fill="#94a3b8">{selectedPoint.label}</tspan>
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

// --- Logo Component ---
const Logo = () => {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex items-center justify-center w-10 h-10 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-sky-200">
        <Activity size={24} className="animate-pulse" />
      </div>
      <div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-700 tracking-tight leading-none">
          PulseGuard
        </h1>
        <span className="text-xs text-sky-500 font-medium tracking-wide">HEALTH COMPANION</span>
      </div>
    </div>
  );
};

// --- Live Clock Component ---
const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end">
      <div className="text-3xl font-bold text-gray-800 tabular-nums">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="text-sm text-sky-600 font-medium flex items-center gap-1">
        <Calendar size={14} />
        {time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
      </div>
    </div>
  );
};

// --- Helper Functions ---

const formatDate = (dateString: string | number) => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// --- Main App Component ---

const App = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'table' | 'chart'>('table');
  
  // Auth Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [authError, setAuthError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Profile Edit States
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  // Input States
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [sugarVal, setSugarVal] = useState('');
  const [sugarType, setSugarType] = useState<'Fasting' | 'Post-Prandial' | 'Random'>('Random');
  const [pulseVal, setPulseVal] = useState('');
  const [heartRateVal, setHeartRateVal] = useState('');
  
  // Medicine States
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [editingMedId, setEditingMedId] = useState<string | null>(null);

  // --- Firebase Subscriptions ---

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        // Fetch additional profile data
        const userRef = doc(db, `artifacts/${APP_ID}/users/${currentUser.uid}/userProfile/info`);
        try {
          const docSnap = await getDoc(userRef);
          let userAge = 0;
          if (docSnap.exists()) {
            userAge = docSnap.data().age || 0;
          }
          
          setUser({
            uid: currentUser.uid,
            name: currentUser.displayName || 'User',
            email: currentUser.email || '',
            age: userAge
          });
        } catch (err) {
          console.error("Error fetching user profile:", err);
          setUser({
            uid: currentUser.uid,
            name: currentUser.displayName || 'User',
            email: currentUser.email || '',
            age: 0
          });
        }
      } else {
        setUser(null);
        setRecords([]);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    // Subscribe to Health Readings
    const readingsRef = collection(db, `artifacts/${APP_ID}/users/${user.uid}/healthReadings`);
    const qReadings = query(readingsRef);
    
    const unsubReadings = onSnapshot(qReadings, (snapshot) => {
      const fetchedReadings: HealthRecord[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let ts = data.timestamp;
        
        // Handle Firestore Timestamp objects if they exist in DB
        if (ts && typeof ts === 'object' && typeof ts.toMillis === 'function') {
           ts = ts.toMillis();
        } else if (ts && typeof ts === 'object' && 'seconds' in ts) {
           ts = ts.seconds * 1000;
        }
        
        const timestamp = ts || Date.now();

        let type: RecordType = 'bp'; 
        if (data.type === 'BP') type = 'bp';
        if (data.type === 'Sugar') type = 'sugar';
        if (data.type === 'Pulse') type = 'pulse';
        if (data.type === 'HeartRate') type = 'heartrate';
        if (data.type === 'SPO2') type = 'heartrate';

        return {
          id: doc.id,
          type: type,
          date: new Date(timestamp).toISOString(),
          timestamp: timestamp,
          systolic: data.systolic,
          diastolic: data.diastolic,
          sugarLevel: data.sugar,
          sugarType: data.sugarType,
          bpm: data.pulse || data.bpm,
        };
      });
      
      setRecords(prev => {
        const meds = prev.filter(r => r.type === 'medicine');
        return [...meds, ...fetchedReadings].sort((a,b) => b.timestamp - a.timestamp);
      });
    });

    // Subscribe to Medications
    const medsRef = collection(db, `artifacts/${APP_ID}/users/${user.uid}/medications`);
    const qMeds = query(medsRef);

    const unsubMeds = onSnapshot(qMeds, (snapshot) => {
      const fetchedMeds: HealthRecord[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let ts = data.createdAt;
        
        // Handle Firestore Timestamp objects if they exist in DB
        if (ts && typeof ts === 'object' && typeof ts.toMillis === 'function') {
           ts = ts.toMillis();
        } else if (ts && typeof ts === 'object' && 'seconds' in ts) {
           ts = ts.seconds * 1000;
        }

        const timestamp = ts || Date.now();

        return {
          id: doc.id,
          type: 'medicine',
          date: new Date(timestamp).toISOString(),
          timestamp: timestamp,
          medicineName: data.medicationName,
          dosage: data.dosage,
          frequency: data.frequency
        };
      });

      setRecords(prev => {
        const readings = prev.filter(r => r.type !== 'medicine');
        return [...readings, ...fetchedMeds].sort((a,b) => b.timestamp - a.timestamp);
      });
    });

    return () => {
      unsubReadings();
      unsubMeds();
    };
  }, [user?.uid]);

  // --- Actions ---

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    try {
      if (authMode === 'signup') {
        if (!name || !email || !password || !age) {
          setAuthError('Please fill in all fields');
          return;
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateFirebaseProfile(userCredential.user, { displayName: name });
        await setDoc(doc(db, `artifacts/${APP_ID}/users/${userCredential.user.uid}/userProfile/info`), {
          age: parseInt(age),
          email: email,
          name: name
        });

      } else if (authMode === 'signin') {
        if (!email || !password) {
          setAuthError('Please enter email and password');
          return;
        }
        await signInWithEmailAndPassword(auth, email, password);
      } else if (authMode === 'forgot') {
         if (!email) {
           setAuthError('Please enter your email address');
           return;
         }
         await sendPasswordResetEmail(auth, email);
         setResetSent(true);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setAuthMode('signin');
      setEmail('');
      setPassword('');
    } catch (err) {
      console.error("Sign out error", err);
    }
  };

  const updateCurrentUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    try {
      if (editName !== user?.name) await updateFirebaseProfile(auth.currentUser, { displayName: editName });
      if (editEmail !== user?.email) await updateEmail(auth.currentUser, editEmail);
      if (editPassword) await updatePassword(auth.currentUser, editPassword);

      await setDoc(doc(db, `artifacts/${APP_ID}/users/${auth.currentUser.uid}/userProfile/info`), {
        age: parseInt(editAge),
        name: editName,
        email: editEmail
      }, { merge: true });

      setUser(prev => prev ? ({ ...prev, name: editName, email: editEmail, age: parseInt(editAge) }) : null);
      setShowProfile(false);
      alert("Profile updated successfully!");
    } catch (err: any) {
      console.error("Update Profile Error:", err);
      if (err.code === 'auth/requires-recent-login') {
        alert("For security, please sign out and sign in again to change sensitive information like email or password.");
      } else {
        alert("Failed to update profile: " + err.message);
      }
    }
  };

  const addRecord = async (type: RecordType, data: any) => {
    if (!user) return;

    try {
      if (type === 'medicine') {
        const collectionRef = collection(db, `artifacts/${APP_ID}/users/${user.uid}/medications`);
        await addDoc(collectionRef, {
          medicationName: data.medicineName,
          dosage: data.dosage,
          frequency: data.frequency,
          createdAt: Date.now()
        });
      } else {
        const collectionRef = collection(db, `artifacts/${APP_ID}/users/${user.uid}/healthReadings`);
        let dbType = '', dbData = {};

        if (type === 'bp') { dbType = 'BP'; dbData = { systolic: parseInt(data.systolic), diastolic: parseInt(data.diastolic) }; } 
        else if (type === 'sugar') { dbType = 'Sugar'; dbData = { sugar: parseInt(data.sugarLevel), sugarType: data.sugarType }; } 
        else if (type === 'pulse') { dbType = 'Pulse'; dbData = { pulse: parseInt(data.bpm) }; } 
        else if (type === 'heartrate') { dbType = 'HeartRate'; dbData = { bpm: parseInt(data.bpm) }; }

        await addDoc(collectionRef, { type: dbType, ...dbData, timestamp: Date.now() });
      }

      if (type === 'bp') { setBpSys(''); setBpDia(''); }
      if (type === 'sugar') { setSugarVal(''); setSugarType('Random'); }
      if (type === 'pulse') setPulseVal('');
      if (type === 'heartrate') setHeartRateVal('');
      if (type === 'medicine') { setMedName(''); setMedDosage(''); setMedFreq(''); }

    } catch (err) {
      console.error("Error adding record:", err);
      alert("Failed to save record.");
    }
  };

  const deleteRecord = async (id: string, type: RecordType) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      const collectionName = type === 'medicine' ? 'medications' : 'healthReadings';
      await deleteDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/${collectionName}`, id));
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete record.");
    }
  };

  const saveEditedMedicine = async () => {
    if (!user || !editingMedId) return;
    try {
      const docRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/medications`, editingMedId);
      await updateDoc(docRef, { medicationName: medName, dosage: medDosage, frequency: medFreq, updatedAt: Date.now() });
      setMedName(''); setMedDosage(''); setMedFreq(''); setEditingMedId(null);
    } catch (err) {
      console.error("Update medicine error:", err);
      alert("Failed to update medicine.");
    }
  };

  const getAIAnalysis = async () => {
    if (!user || !process.env.API_KEY) { alert("API Key missing"); return; }
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Sanitizing data to ensure no circular references or excessive tokens
      const cleanRecords = records.slice(0, 30).map(r => ({
        type: r.type,
        date: r.date,
        val: r.type === 'bp' ? `${r.systolic}/${r.diastolic}` : 
             r.type === 'sugar' ? `${r.sugarLevel} ${r.sugarType}` :
             r.type === 'medicine' ? `${r.medicineName} ${r.dosage}` :
             r.bpm
      }));

      const prompt = `Act as a helpful medical assistant for ${user.name} (Age: ${user.age}). Analyze these records and give a short summary + 3 suggestions. Records: ${JSON.stringify(cleanRecords)}`;
      
      const result = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
      setAiSuggestion(result.text || "No suggestion generated.");
      
      // Auto-scroll to bottom to see AI
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
    } catch (error) {
      console.error("AI Error:", error);
      setAiSuggestion("Could not connect to AI assistant. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const downloadReport = () => {
    if (!user) return;
    
    // Construct Filename
    const dateStr = new Date().toLocaleDateString().replace(/\//g, '-');
    const filename = `${user.name.replace(/\s+/g, '_')}_${dateStr}_PulseGuard.txt`;

    // Construct Content Table
    let content = `PULSEGUARD HEALTH REPORT\n`;
    content += `================================================================================\n`;
    content += `User: ${user.name}\n`;
    content += `Age:  ${user.age}\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    content += `================================================================================\n\n`;
    
    content += `MEDICATIONS\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `| MEDICINE NAME       | DOSAGE          | FREQUENCY       |\n`;
    content += `|---------------------|-----------------|-----------------|\n`;
    records.filter(r => r.type === 'medicine').forEach(r => {
      content += `| ${(r.medicineName || '').padEnd(19)} | ${(r.dosage || '').padEnd(15)} | ${(r.frequency || '').padEnd(15)} |\n`;
    });
    content += `--------------------------------------------------------------------------------\n\n`;
    
    content += `HEALTH HISTORY\n`;
    content += `--------------------------------------------------------------------------------\n`;
    content += `| DATE       | TIME     | TYPE       | VALUE                          |\n`;
    content += `|------------|----------|------------|--------------------------------|\n`;
    
    records.filter(r => r.type !== 'medicine').forEach(r => {
      const d = new Date(r.timestamp);
      const date = d.toLocaleDateString().padEnd(10);
      const time = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).padEnd(8);
      const type = r.type.toUpperCase().padEnd(10);
      
      let val = '';
      if (r.type === 'bp') val = `${r.systolic}/${r.diastolic} mmHg`;
      else if (r.type === 'sugar') val = `${r.sugarLevel} mg/dL (${r.sugarType})`;
      else if (r.type === 'pulse' || r.type === 'heartrate') val = `${r.bpm} BPM`;
      
      content += `| ${date} | ${time} | ${type} | ${val.padEnd(30)} |\n`;
    });
    content += `--------------------------------------------------------------------------------\n`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Render ---

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-sky-600" size={48} /></div>;

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-sky-100">
        <div className="mb-8 scale-150"><Logo /></div>
        <div className="bg-white/80 backdrop-blur-sm p-8 rounded-3xl shadow-xl w-full max-w-md border border-white/50">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">
            {authMode === 'signin' ? 'Welcome Back' : authMode === 'signup' ? 'Get Started' : 'Reset Password'}
          </h2>
          
          {resetSent ? (
            <div className="text-center py-6">
               <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-4 flex flex-col items-center">
                 <CheckCircle2 size={32} className="mb-2" />
                 <p>Reset link sent!</p>
               </div>
               <p className="text-slate-600 mb-6">Check your email {email} for instructions to reset your password.</p>
               <button onClick={() => { setResetSent(false); setAuthMode('signin'); }} className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl transition-all">Back to Sign In</button>
            </div>
          ) : (
            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <input type="text" required className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
                  <input type="number" required className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900" placeholder="Age" value={age} onChange={e => setAge(e.target.value)} />
                </>
              )}
              
              <input type="email" required className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              
              {authMode !== 'forgot' && (
                <input type="password" required className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 text-slate-900" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              )}
              
              {authMode === 'signin' && (
                <div className="flex justify-end">
                   <button type="button" onClick={() => { setAuthMode('forgot'); setAuthError(''); }} className="text-sm text-sky-600 font-medium hover:underline">Forgot Password?</button>
                </div>
              )}

              {authError && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{authError}</p>}
              
              <button type="submit" className="w-full py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-sky-200 transition-all">
                {authMode === 'signin' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'}
              </button>
            </form>
          )}

          {!resetSent && (
            <div className="mt-6 text-center text-sm text-slate-500">
              {authMode === 'signin' ? (
                <p>New here? <button onClick={() => { setAuthMode('signup'); setAuthError(''); }} className="text-sky-600 font-bold hover:underline">Sign up</button></p>
              ) : authMode === 'signup' ? (
                <p>Has account? <button onClick={() => { setAuthMode('signin'); setAuthError(''); }} className="text-sky-600 font-bold hover:underline">Log in</button></p>
              ) : (
                <button onClick={() => { setAuthMode('signin'); setAuthError(''); }} className="flex items-center justify-center gap-1 mx-auto text-slate-500 font-medium hover:text-sky-600 hover:underline"><ArrowLeft size={16} /> Back to Sign In</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const medicineRecords = records.filter(r => r.type === 'medicine');
  const historyRecords = records.filter(r => r.type !== 'medicine');
  
  // Data for Charts
  const bpData = historyRecords.filter(r => r.type === 'bp');
  const sugarData = historyRecords.filter(r => r.type === 'sugar');
  const heartData = historyRecords.filter(r => r.type === 'pulse' || r.type === 'heartrate');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-12 font-sans">
      
      {/* Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditName(user.name); setEditAge(user.age.toString()); setEditEmail(user.email); setEditPassword(''); setShowProfile(true); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} /></button>
            <button onClick={handleLogout} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        
        {/* Profile Modal */}
        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm no-print">
             <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">Edit Profile</h3><button onClick={() => setShowProfile(false)}><X size={24} className="text-slate-400" /></button></div>
                <form onSubmit={updateCurrentUserProfile} className="space-y-4">
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full p-3 bg-white border rounded-xl text-slate-900" placeholder="Name" />
                  <input type="number" value={editAge} onChange={e => setEditAge(e.target.value)} className="w-full p-3 bg-white border rounded-xl text-slate-900" placeholder="Age" />
                  <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full p-3 bg-white border rounded-xl text-slate-900" placeholder="Email" />
                  <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="w-full p-3 bg-white border rounded-xl text-slate-900" placeholder="New Password (Optional)" />
                  <button type="submit" className="w-full py-3 bg-sky-600 text-white font-bold rounded-xl">Save Changes</button>
                </form>
             </div>
          </div>
        )}

        {/* Top Dashboard Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 font-bold text-2xl border-4 border-white shadow-sm">
              {user.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Hello, {user.name}</h2>
              <div className="flex items-center gap-3 text-slate-500 text-sm mt-1">
                 <span className="flex items-center gap-1"><UserIcon size={14} /> Age: {user.age}</span>
                 <span className="h-1 w-1 bg-slate-300 rounded-full"></span>
                 <span className="text-green-600 font-medium">Status: Active</span>
              </div>
            </div>
          </div>
          <div className="hidden md:block h-12 w-px bg-slate-100"></div>
          <LiveClock />
        </div>

        {/* Input Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
          
          {/* BP Card */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-rose-500 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 bg-rose-50/50 border-b border-rose-100 flex items-center gap-2">
              <Activity className="text-rose-500" size={20} />
              <h3 className="font-bold text-rose-900">Blood Pressure</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-3">
                <div className="flex-1"><label className="text-xs font-bold text-slate-400 mb-1 block">SYS</label><input type="number" value={bpSys} onChange={e => setBpSys(e.target.value)} className="w-full p-2 bg-slate-50 border-slate-200 rounded-lg text-lg font-mono text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none" placeholder="120" /></div>
                <div className="flex-1"><label className="text-xs font-bold text-slate-400 mb-1 block">DIA</label><input type="number" value={bpDia} onChange={e => setBpDia(e.target.value)} className="w-full p-2 bg-slate-50 border-slate-200 rounded-lg text-lg font-mono text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none" placeholder="80" /></div>
              </div>
              <button onClick={() => { if(bpSys && bpDia) addRecord('bp', { systolic: bpSys, diastolic: bpDia }) }} className="w-full py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium flex justify-center items-center gap-2"><Plus size={18} /> Add</button>
            </div>
          </div>

          {/* Sugar Card */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-amber-500 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex items-center gap-2">
              <Droplet className="text-amber-500" size={20} />
              <h3 className="font-bold text-amber-900">Blood Sugar</h3>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-bold text-slate-400 mb-1 block">LEVEL (mg/dL)</label><input type="number" value={sugarVal} onChange={e => setSugarVal(e.target.value)} className="w-full p-2 bg-slate-50 border-slate-200 rounded-lg text-lg font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none" placeholder="110" /></div>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {['Fasting', 'Post-Prandial', 'Random'].map(t => (
                  <button key={t} onClick={() => setSugarType(t as any)} className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${sugarType === t ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500'}`}>{t === 'Post-Prandial' ? 'PP' : t}</button>
                ))}
              </div>
              <button onClick={() => { if(sugarVal) addRecord('sugar', { sugarLevel: sugarVal, sugarType }) }} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium flex justify-center items-center gap-2"><Plus size={18} /> Add</button>
            </div>
          </div>

          {/* Pulse Card */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-emerald-500 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex items-center gap-2">
              <Heart className="text-emerald-500" size={20} />
              <h3 className="font-bold text-emerald-900">Pulse</h3>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-bold text-slate-400 mb-1 block">BPM</label><input type="number" value={pulseVal} onChange={e => setPulseVal(e.target.value)} className="w-full p-2 bg-slate-50 border-slate-200 rounded-lg text-lg font-mono text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="72" /></div>
              <button onClick={() => { if(pulseVal) addRecord('pulse', { bpm: pulseVal }) }} className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex justify-center items-center gap-2"><Plus size={18} /> Add</button>
            </div>
          </div>

          {/* Heart Rate Card */}
          <div className="bg-white rounded-2xl shadow-sm border-l-4 border-cyan-500 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 bg-cyan-50/50 border-b border-cyan-100 flex items-center gap-2">
              <Stethoscope className="text-cyan-500" size={20} />
              <h3 className="font-bold text-cyan-900">Heart Rate</h3>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-bold text-slate-400 mb-1 block">MONITOR BPM</label><input type="number" value={heartRateVal} onChange={e => setHeartRateVal(e.target.value)} className="w-full p-2 bg-slate-50 border-slate-200 rounded-lg text-lg font-mono text-slate-900 focus:ring-2 focus:ring-cyan-500 outline-none" placeholder="75" /></div>
              <button onClick={() => { if(heartRateVal) addRecord('heartrate', { bpm: heartRateVal }) }} className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium flex justify-center items-center gap-2"><Plus size={18} /> Add</button>
            </div>
          </div>
        </div>

        {/* Medicines Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-violet-100 overflow-hidden break-inside-avoid">
          <div className="bg-violet-50/50 p-6 border-b border-violet-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg text-violet-600"><Pill size={24} /></div>
              <h3 className="text-xl font-bold text-slate-800">Medications</h3>
            </div>
            <div className="flex gap-2">
               {/* Simplified Add Form Inline for Desktop could go here, but keeping it simple */}
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
             {/* Add/Edit Form */}
             <div className="lg:col-span-1 bg-slate-50 p-5 rounded-2xl h-fit no-print">
                <h4 className="font-bold text-slate-700 mb-4">{editingMedId ? 'Edit Medicine' : 'Add New Medicine'}</h4>
                <div className="space-y-3">
                  <input type="text" value={medName} onChange={e => setMedName(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm" placeholder="Name (e.g. Aspirin)" />
                  <div className="flex gap-2">
                    <input type="text" value={medDosage} onChange={e => setMedDosage(e.target.value)} className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm" placeholder="Dosage" />
                    <input type="text" value={medFreq} onChange={e => setMedFreq(e.target.value)} className="w-1/2 p-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm" placeholder="Freq" />
                  </div>
                  {editingMedId ? (
                    <div className="flex gap-2 mt-2">
                      <button onClick={saveEditedMedicine} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold">Save</button>
                      <button onClick={() => {setEditingMedId(null); setMedName(''); setMedDosage(''); setMedFreq('');}} className="flex-1 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm font-bold">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => { if(medName) addRecord('medicine', { medicineName: medName, dosage: medDosage, frequency: medFreq }) }} className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 mt-2"><Plus size={16} /> Add to List</button>
                  )}
                </div>
             </div>

             {/* List */}
             <div className="lg:col-span-2 min-h-[300px] max-h-[500px] overflow-y-auto pr-2 custom-scrollbar print:max-h-none print:h-auto">
                {medicineRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                    <Pill size={48} className="mb-2 opacity-20" />
                    <p>No medicines recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicineRecords.map(med => (
                      <div key={med.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-violet-200 transition-colors break-inside-avoid">
                        <div>
                          <div className="font-bold text-slate-800 text-lg">{med.medicineName}</div>
                          <div className="text-sm text-slate-500 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded-md mt-1">{med.dosage} • {med.frequency}</div>
                        </div>
                        <div className="flex items-center gap-2 no-print">
                          <button onClick={() => { setMedName(med.medicineName); setMedDosage(med.dosage); setMedFreq(med.frequency); setEditingMedId(med.id); }} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg"><Edit2 size={18} /></button>
                          <button onClick={() => deleteRecord(med.id, 'medicine')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* History & Trends Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden card break-inside-avoid">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><ClipboardList size={24} /></div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Health History</h3>
                <p className="text-sm text-slate-500 hidden sm:block">{historyRecords.length} records recorded</p>
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-print">
              <div className="flex bg-slate-200 p-1 rounded-xl mr-2">
                <button onClick={() => setHistoryView('table')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${historyView === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}><List size={16} /> Table</button>
                <button onClick={() => setHistoryView('chart')} className={`px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${historyView === 'chart' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}><BarChart2 size={16} /> Trends</button>
              </div>
              <button onClick={() => window.print()} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-50 flex items-center gap-2"><Printer size={16} /> Print</button>
              <button onClick={downloadReport} className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 flex items-center gap-2"><Download size={16} /> Export</button>
            </div>
          </div>

          <div className="p-0">
            {historyRecords.length === 0 ? (
               <div className="p-12 text-center text-slate-400">
                 <ClipboardList size={48} className="mx-auto mb-3 opacity-20" />
                 <p>No health records yet. Add your first reading above.</p>
               </div>
            ) : historyView === 'table' ? (
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Value</th>
                      <th className="px-6 py-4 text-right no-print">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {historyRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors break-inside-avoid">
                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{formatDate(r.timestamp)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            r.type === 'bp' ? 'bg-rose-100 text-rose-700' : 
                            r.type === 'sugar' ? 'bg-amber-100 text-amber-700' : 
                            'bg-emerald-100 text-emerald-700'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-mono text-base">
                          {r.type === 'bp' && <span><span className="font-bold text-slate-900">{r.systolic}</span>/<span className="font-bold text-slate-900">{r.diastolic}</span> <span className="text-xs text-slate-400 ml-1">mmHg</span></span>}
                          {r.type === 'sugar' && <span><span className="font-bold text-slate-900">{r.sugarLevel}</span> <span className="text-xs text-slate-400 ml-1">mg/dL</span> <span className="text-xs bg-slate-100 px-1 rounded ml-2">{r.sugarType === 'Post-Prandial' ? 'PP' : r.sugarType}</span></span>}
                          {(r.type === 'pulse' || r.type === 'heartrate') && <span><span className="font-bold text-slate-900">{r.bpm}</span> <span className="text-xs text-slate-400 ml-1">BPM</span></span>}
                        </td>
                        <td className="px-6 py-4 text-right no-print">
                          <button onClick={() => deleteRecord(r.id, r.type)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Charts - Visible on print as well */}
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 break-inside-avoid">
                    <h4 className="font-bold text-rose-900 mb-4 flex items-center gap-2"><Activity size={18} /> Blood Pressure Trend</h4>
                    <SimpleLineChart data={bpData} lines={[{key:'systolic', color:'#f43f5e'}, {key:'diastolic', color:'#fb7185'}]} />
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 break-inside-avoid">
                    <h4 className="font-bold text-amber-900 mb-4 flex items-center gap-2"><Droplet size={18} /> Blood Sugar Trend</h4>
                    <SimpleLineChart data={sugarData} lines={[{key:'sugarLevel', color:'#f59e0b'}]} />
                 </div>
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 lg:col-span-2 break-inside-avoid">
                    <h4 className="font-bold text-emerald-900 mb-4 flex items-center gap-2"><Heart size={18} /> Heart Rate Trend</h4>
                    <SimpleLineChart data={heartData} lines={[{key:'bpm', color:'#10b981'}]} height={150} />
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Assistant (Moved to bottom) */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl shadow-lg shadow-indigo-200 text-white p-8 no-print">
           <div className="flex flex-col md:flex-row gap-6 items-start">
             <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm">
               <Brain size={48} className="text-white" />
             </div>
             <div className="flex-1 space-y-4">
               <div>
                 <h3 className="text-2xl font-bold">AI Health Assistant</h3>
                 <p className="text-indigo-100">Get personalized insights based on your recent records.</p>
               </div>
               
               {aiSuggestion && (
                 <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 animate-in fade-in slide-in-from-bottom-4">
                   <div className="prose prose-invert max-w-none">
                     <p className="whitespace-pre-wrap leading-relaxed">{aiSuggestion}</p>
                   </div>
                 </div>
               )}

               <button 
                 onClick={getAIAnalysis} 
                 disabled={aiLoading}
                 className="px-6 py-3 bg-white text-indigo-700 font-bold rounded-xl shadow-lg hover:bg-indigo-50 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {aiLoading ? <Loader2 className="animate-spin" size={20} /> : <Brain size={20} />}
                 {aiLoading ? 'Analyzing...' : aiSuggestion ? 'Refresh Analysis' : 'Generate Health Insights'}
               </button>
             </div>
           </div>
        </div>

      </main>

      <footer className="text-center text-slate-400 text-sm mt-8 pb-8 no-print">
        <p>&copy; {new Date().getFullYear()} PulseGuard. Product of Cordulatech.</p>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);