/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { 
  Dumbbell, 
  Clock, 
  Target, 
  ArrowLeft, 
  Flame, 
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Youtube,
  Image as ImageIcon,
  ExternalLink,
  History,
  Trash2,
  Trash,
  Star,
  Save,
  Award,
  Plus,
  Minus,
  User,
  Play,
  RotateCcw,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Award as AwardIcon,
  TrendingUp,
  LineChart as LineChartIcon,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogOut,
  LogIn,
  CloudOff
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  CartesianGrid,
  Legend
} from 'recharts';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  query, 
  orderBy, 
  deleteDoc,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Goal = 'perdrePoids' | 'prendreMuscle' | 'gagnerForce';
type Intensity = 'faible' | 'modérée' | 'élevée';
type Experience = 'débutant' | 'intermédiaire' | 'avancé' | 'professionnel';
type Equipment = 'maison' | 'typique' | 'professionnel';
type Gender = 'homme' | 'femme';

interface UserData {
  firstName: string; // Nouveau: prénom
  age: string;
  gender: Gender; // Nouveau: genre
  focus: string;
  targetMuscles: string[];
  experience: Experience;
  equipment: Equipment;
  duration: string;
  intensity: Intensity;
  goal: Goal;
}

interface Exercise {
  name: string;
  sets: string;
  reps: string;
  notes: string;
  form: string; 
  modifications: string; 
  youtubeUrl: string; 
  googleImageUrl: string;
  completedWeights?: string[]; // Poids saisis par l'utilisateur
  completedRPEs?: string[]; // RPE (0-10)
}

interface ExerciseStep {
  name: string;
  youtubeUrl?: string;
  googleImageUrl?: string;
}

interface WorkoutPlan {
  id: string;
  date: string;
  title: string;
  description: string;
  exercises: Exercise[];
  warmup: ExerciseStep[];
  cooldown: ExerciseStep[];
  params: UserData;
  isFavorite?: boolean; 
  avgRpe?: string;
  volume?: number;
  createdAt?: string | any; // Any for FieldValue
}

const MUSCLE_GROUPS = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 
  'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Abdos',
  'Avant-bras', 'Trapèzes'
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [step, setStep] = useState<'info' | 'workout' | 'history'>('info');
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [triviaIndex, setTriviaIndex] = useState(0);

  const triviaFacts = [
    "Le cœur est le muscle le plus puissant du corps humain par rapport à sa taille.",
    "S'étirer après une séance aide à réduire les courbatures et améliore la récupération.",
    "L'hydratation est cruciale : une perte de 2% d'eau peut réduire vos performances de 20%.",
    "Le muscle le plus long du corps est le couturier (sartorius), situé dans la cuisse.",
    "Soulever des poids renforce non seulement les muscles, mais aussi la densité osseuse.",
    "Le sommeil est le moment où vos muscles se réparent et se construisent réellement.",
    "Faire de l'exercice libère des endorphines, les hormones du bonheur.",
    "Le muscle grand fessier est le plus volumineux du corps humain.",
    "La régularité bat l'intensité : 30 min par jour valent mieux qu'une séance de 4h par semaine.",
    "Vos muscles brûlent des calories même au repos, contrairement à la masse grasse."
  ];

  // Logic for loading progress and trivia
  useEffect(() => {
    let interval: any;
    let triviaInterval: any;
    if (loading) {
      setLoadingProgress(0);
      setTriviaIndex(Math.floor(Math.random() * triviaFacts.length));
      
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 95) return prev;
          return prev + (100 - prev) * 0.1;
        });
      }, 300);

      triviaInterval = setInterval(() => {
        setTriviaIndex(prev => (prev + 1) % triviaFacts.length);
      }, 4000);
    } else {
      setLoadingProgress(100);
    }
    return () => {
      clearInterval(interval);
      clearInterval(triviaInterval);
    };
  }, [loading]);

  const [loadingAlternative, setLoadingAlternative] = useState<number | null>(null);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [history, setHistory] = useState<WorkoutPlan[]>(() => {
    const saved = localStorage.getItem('repz_history') || localStorage.getItem('fitfocus_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<WorkoutPlan[]>(() => {
    const saved = localStorage.getItem('repz_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  
  // Appliquer le mode sombre
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);
  
  // Charger le profil depuis le localStorage
  const [profile, setProfile] = useState<{
    firstName: string;
    age: string;
    gender: Gender;
    experience: Experience;
    equipment: Equipment;
    goal: Goal;
    focus: string;
  } | null>(() => {
    const saved = localStorage.getItem('repz_profile') || localStorage.getItem('fitfocus_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [formData, setFormData] = useState<UserData>({
    firstName: profile?.firstName || '',
    age: profile?.age || '',
    gender: profile?.gender || 'homme',
    experience: profile?.experience || 'débutant',
    equipment: profile?.equipment || 'typique',
    goal: profile?.goal || 'prendreMuscle',
    focus: profile?.focus || '',
    targetMuscles: [],
    duration: '30',
    intensity: 'modérée',
  });

  // Mettre à jour formData quand le profil change
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        ...profile
      }));
      localStorage.setItem('repz_profile', JSON.stringify(profile));
    }
  }, [profile]);

  const [historyTab, setHistoryTab] = useState<'sessions' | 'favorites' | 'stats'>('sessions');
  const [focusedExerciseIndex, setFocusedExerciseIndex] = useState<number | null>(null);
  // Centralized Error Handler for Firestore
  const handleFirestoreError = (error: any, operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write', path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error:', JSON.stringify(errInfo));
  };

  // Initialisation IA
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Initialisation Auth et Test Connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Synchronisation avec Firestore
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      // Pas d'utilisateur : on recharge les données locales
      const savedProfile = localStorage.getItem('repz_profile') || localStorage.getItem('fitfocus_profile');
      if (savedProfile) setProfile(JSON.parse(savedProfile));
      
      const savedHistory = localStorage.getItem('repz_history') || localStorage.getItem('fitfocus_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
      
      const savedFavs = localStorage.getItem('repz_favorites') || localStorage.getItem('fitfocus_favorites');
      if (savedFavs) setFavorites(JSON.parse(savedFavs));
      
      return;
    }

    const syncData = async () => {
      try {
        // 1. Profil
        const profileDocRef = doc(db, 'users', user.uid);
        const profileDoc = await getDoc(profileDocRef);
        
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as any);
        } else {
          // Migration: Si l'utilisateur n'a pas encore de profil sur Firestore, on l'upload
          const localProfileStr = localStorage.getItem('repz_profile') || localStorage.getItem('fitfocus_profile');
          if (localProfileStr) {
            const profileData = JSON.parse(localProfileStr);
            await setDoc(profileDocRef, { ...profileData, updatedAt: serverTimestamp() })
              .catch(err => handleFirestoreError(err, 'write', `users/${user.uid}`));
            setProfile(profileData);
          }
        }

        // 2. Historique & Migration
        const historyCollRef = collection(db, 'users', user.uid, 'history');
        const historySnap = await getDocs(historyCollRef);
        const remoteHistory = historySnap.docs.map(d => d.data() as WorkoutPlan);

        if (remoteHistory.length === 0) {
          // Migration de l'historique local vers Firestore
          const localHistoryStr = localStorage.getItem('repz_history') || localStorage.getItem('fitfocus_history');
          if (localHistoryStr) {
            const localHistory: WorkoutPlan[] = JSON.parse(localHistoryStr);
            const uploadPromises = localHistory.map(w => 
              setDoc(doc(historyCollRef, w.id), { ...w, createdAt: w.createdAt || serverTimestamp() })
            );
            await Promise.all(uploadPromises);
            setHistory(localHistory);
          }
        } else {
          // On trie par date si distant
          const sortedRemote = [...remoteHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setHistory(sortedRemote);
        }

        // 3. Favoris & Migration
        const favsCollRef = collection(db, 'users', user.uid, 'favorites');
        const favsSnap = await getDocs(favsCollRef);
        const remoteFavs = favsSnap.docs.map(d => d.data() as WorkoutPlan);

        if (remoteFavs.length === 0) {
          const localFavsStr = localStorage.getItem('repz_favorites');
          if (localFavsStr) {
            const localFavs: WorkoutPlan[] = JSON.parse(localFavsStr);
            const uploadPromises = localFavs.map(w => setDoc(doc(favsCollRef, w.id), w));
            await Promise.all(uploadPromises);
            setFavorites(localFavs);
          }
        } else {
          setFavorites(remoteFavs);
        }

      } catch (err) {
        console.error("Erreur lors de la synchronisation Firestore:", err);
      }
    };

    syncData();
  }, [user]);

  // Sauvegarder automatiquement les champs du profil dans localStorage en temps réel
  useEffect(() => {
    const profileToSave = {
      firstName: formData.firstName,
      age: formData.age,
      gender: formData.gender,
      experience: formData.experience,
      equipment: formData.equipment,
      goal: formData.goal,
      focus: formData.focus
    };
    localStorage.setItem('repz_profile', JSON.stringify(profileToSave));

    if (user && formData.firstName && formData.age) {
       setDoc(doc(db, 'users', user.uid), {
         ...profileToSave,
         updatedAt: serverTimestamp()
       }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
    }
  }, [
    formData.firstName, 
    formData.age, 
    formData.gender, 
    formData.experience, 
    formData.equipment, 
    formData.goal, 
    formData.focus,
    user
  ]);

  // Sauvegarder l'historique et les favoris quand ils changent
  useEffect(() => {
    localStorage.setItem('repz_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('repz_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleMuscle = (muscle: string) => {
    setFormData(prev => ({
      ...prev,
      targetMuscles: prev.targetMuscles.includes(muscle)
        ? prev.targetMuscles.filter(m => m !== muscle)
        : [...prev.targetMuscles, muscle]
    }));
  };

  const safeSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.log("Connexion annulée par l'utilisateur.");
        return;
      }
      console.error("Erreur de connexion:", err);
    }
  };

  const generateWorkout = async () => {
    // Si le profil n'est pas complet, on le sauvegarde d'abord
    if (!profile || showProfileEdit) {
      if (!formData.firstName || !formData.age || !formData.gender) {
        setError('Veuillez compléter votre profil.');
        return;
      }
      const newProfile = {
        firstName: formData.firstName,
        age: formData.age,
        gender: formData.gender,
        experience: formData.experience,
        equipment: formData.equipment,
        goal: formData.goal,
        focus: formData.focus
      };
      setProfile(newProfile);
      setShowProfileEdit(false);
      setError(null);
      return; // IMPORTANT: On s'arrête ici pour laisser l'utilisateur choisir ses muscles
    }

    if (!formData.duration) {
      setError('Veuillez remplir la durée.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prompt plus robuste
      const prompt = `Tu es Repz AI, un coach de fitness expert. 
Génère un programme d'entraînement PERSONNALISÉ et ÉQUILIBRÉ en respectant STRICTEMENT ces paramètres :
- Utilisateur : ${formData.gender}, ${formData.age} ans
- Niveau : ${formData.experience}
- Objectif : ${formData.goal}
- Équipement : ${formData.equipment}
- Séance : ${formData.duration} minutes, Intensité ${formData.intensity}
- Muscles cibles : ${formData.targetMuscles.join(', ') || 'Corps complet'}

Réponds UNIQUEMENT avec un objet JSON valide suivant ce schéma exact :
{
  "title": "Nom motivant (ex: Puissance & Cardio)",
  "description": "Courte description accrocheuse",
  "warmup": [
    {
      "name": "Nom de l'exercice d'échauffement",
      "youtubeUrl": "Lien YouTube",
      "googleImageUrl": "Lien Google Images"
    }
  ],
  "exercises": [
    {
      "name": "Nom de l'exercice",
      "sets": "Nombre de séries (chiffre)",
      "reps": "Nombre de répétitions ou temps",
      "notes": "Conseil clé pour l'exécution",
      "form": "Explications détaillées de la technique",
      "modifications": "Variantes selon le niveau",
      "youtubeUrl": "Lien de recherche YouTube : https://www.youtube.com/results?search_query=Nom+de+l'exercice+form",
      "googleImageUrl": "Lien Google Images : https://www.google.com/search?tbm=isch&q=Nom+de+l'exercice+demonstration"
    }
  ],
  "cooldown": [
    {
      "name": "Nom de l'exercice de retour au calme",
      "youtubeUrl": "Lien YouTube",
      "googleImageUrl": "Lien Google Images"
    }
  ]
}
Le JSON doit être propre, sans texte avant ou après.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("L'IA n'a pas renvoyé de contenu.");

      const data = JSON.parse(text);

      const newWorkout: WorkoutPlan = {
        ...data,
        id: crypto.randomUUID(),
        date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        params: { ...formData }
      };
      setWorkout(newWorkout);
      setStep('workout');
    } catch (err) {
      console.error(err);
      let message = 'Erreur lors de la génération. Veuillez réessayer.';
      if (err instanceof Error) {
        if (err.message.includes('503') || err.message.includes('high demand')) {
          message = 'Les serveurs de l\'IA sont surchargés. Réessayez dans quelques secondes !';
        } else if (err.message.includes('API key')) {
          message = 'Problème de configuration (Clé API).';
        } else {
          message = err.message;
        }
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const updateWeight = (exerciseIndex: number, setIndex: number, weight: string) => {
    if (!workout) return;
    const updatedExercises = [...workout.exercises];
    const exercise = { ...updatedExercises[exerciseIndex] };
    const weights = [...(exercise.completedWeights || [])];
    
    // S'assurer que le tableau a assez de places pour le setIndex
    while (weights.length <= setIndex) weights.push('');
    
    const wasEmpty = weights[setIndex] === '';
    weights[setIndex] = weight;
    exercise.completedWeights = weights;
    updatedExercises[exerciseIndex] = exercise;
    
    setWorkout({ ...workout, exercises: updatedExercises });
  };

  const updateRPE = (exerciseIndex: number, setIndex: number, rpe: string) => {
    if (!workout) return;
    const updatedExercises = [...workout.exercises];
    const exercise = { ...updatedExercises[exerciseIndex] };
    const rpes = [...(exercise.completedRPEs || [])];
    
    while (rpes.length <= setIndex) rpes.push('');
    
    rpes[setIndex] = rpe;
    exercise.completedRPEs = rpes;
    updatedExercises[exerciseIndex] = exercise;
    
    setWorkout({ ...workout, exercises: updatedExercises });
  };

  const toggleFavorite = async () => {
    if (!workout) return;
    const isFav = favorites.some(f => f.id === workout.id);
    if (isFav) {
      setFavorites(prev => prev.filter(f => f.id !== workout.id));
      if (user) {
        await deleteDoc(doc(db, 'users', user.uid, 'favorites', workout.id))
          .catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/favorites/${workout.id}`));
      }
    } else {
      const newFav = { ...workout, isFavorite: true };
      setFavorites(prev => [...prev, newFav]);
      if (user) {
        await setDoc(doc(db, 'users', user.uid, 'favorites', workout.id), newFav)
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/favorites/${workout.id}`));
      }
    }
  };

  const finishSession = async () => {
    if (!workout) return;
    
    // Calculer les stats de session
    let totalVolume = 0;
    let totalSets = 0;
    let rpeSum = 0;
    let setsWithRpe = 0;

    workout.exercises.forEach(ex => {
      ex.completedWeights?.forEach((w, idx) => {
        const weight = parseFloat(w);
        const reps = parseInt(ex.reps) || 0;
        if (!isNaN(weight)) {
          totalVolume += weight * reps;
          totalSets++;
        }
      });
      ex.completedRPEs?.forEach(r => {
        const rpe = parseFloat(r);
        if (!isNaN(rpe)) {
          rpeSum += rpe;
          setsWithRpe++;
        }
      });
    });

    const averageRpe = setsWithRpe > 0 ? (rpeSum / setsWithRpe).toFixed(1) : null;

    const completedWorkout = {
      ...workout,
      volume: totalVolume,
      avgRpe: averageRpe,
      date: new Date().toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      createdAt: new Date().toISOString() // ISO string for local history, Firestore uses serverTimestamp
    };

    setHistory(prev => [completedWorkout, ...prev]);

    if (user) {
      await setDoc(doc(db, 'users', user.uid, 'history', completedWorkout.id), {
        ...completedWorkout,
        createdAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/history/${completedWorkout.id}`));
    }

    setStep('history');
    setFocusedExerciseIndex(null);
  };

  const reset = () => {
    setStep('info');
    setWorkout(null);
    setFocusedExerciseIndex(null);
  };

  const deleteExercise = (index: number) => {
    if (!workout) return;
    const updatedExercises = workout.exercises.filter((_, i) => i !== index);
    const updatedWorkout = { ...workout, exercises: updatedExercises };
    setWorkout(updatedWorkout);
    // Si la séance est déjà dans l'historique, on la met à jour
    setHistory(prev => prev.map(h => h.id === workout.id ? updatedWorkout : h));
  };

  const getAlternative = async (index: number) => {
    if (!workout || loadingAlternative !== null) return;
    const exercise = workout.exercises[index];
    
    setLoadingAlternative(index);
    try {
      const prompt = `
        Tu es un coach de fitness professionnel. L'utilisateur ne peut pas faire l'exercice suivant : "${exercise.name}".
        Propose un exercice ALTERNATIF qui travaille les mêmes muscles, adapté au niveau "${formData.experience}" et à l'équipement "${formData.equipment}".
        
        Paramètres du profil :
        - Genre : ${formData.gender}
        - Âge : ${formData.age}
        - Équipement disponible : ${formData.equipment}

        Réponds UNIQUEMENT avec un objet JSON valide au format suivant :
        {
          "name": "Nom du nouvel exercice", 
          "sets": "${exercise.sets}", 
          "reps": "${exercise.reps}", 
          "notes": "astuce courte",
          "form": "Explication de la forme correcte",
          "modifications": "Adaptations",
          "youtubeUrl": "Lien YouTube : https://www.youtube.com/results?search_query=Nom+de+l'exercice+form",
          "googleImageUrl": "Lien Google Images : https://www.google.com/search?tbm=isch&q=Nom+de+l'exercice+demonstration"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      if (!text) throw new Error("L'IA n'a pas renvoyé de contenu.");

      const data = JSON.parse(text);

      const updatedExercises = [...workout.exercises];
      updatedExercises[index] = data;
      const updatedWorkout = { ...workout, exercises: updatedExercises };
      
      setWorkout(updatedWorkout);
      setHistory(prev => prev.map(h => h.id === workout.id ? updatedWorkout : h));
    } catch (err) {
      console.error(err);
      setError("Impossible de générer une alternative. Réessayez.");
    } finally {
      setLoadingAlternative(null);
    }
  };

  const deleteFromHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(w => w.id !== id));
    if (user) {
      await deleteDoc(doc(db, 'users', user.uid, 'history', id))
        .catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/history/${id}`));
    }
  };

  return (
    <div className="min-h-[100dvh] bg-natural-bg text-natural-ink font-sans selection:bg-natural-highlight flex flex-col transition-colors duration-300 overflow-x-hidden">
      {/* Salutation du haut */}
      <div className="w-full bg-white/80 dark:bg-natural-bg/80 backdrop-blur-md border-b border-stone-200 dark:border-white/10 safe-p-top sticky top-0 z-50 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between relative min-h-[50px] sm:min-h-[64px]">
          <div className="flex items-center gap-1 sm:gap-2">
             {(step !== 'info' && !loading) && (
               <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => setStep('info')}
                className="p-1 sm:p-2 hover:bg-stone-100 dark:hover:bg-white/5 rounded-full transition-all text-stone-400 hover:text-natural-accent -ml-2"
                aria-label="Retour au profil"
                title="Retour"
               >
                 <ChevronLeft className="w-6 h-6" />
               </motion.button>
             )}
             <button onClick={reset} className="flex items-center gap-2 border-none bg-transparent cursor-pointer group">
               <span className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-natural-accent leading-none group-hover:scale-105 transition-transform drop-shadow-[0_0_12px_rgba(202,255,51,0.4)]">Repz</span>
             </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {authLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[8px] font-black uppercase tracking-widest text-natural-accent">Sync Cloud Active</span>
                  <span className="text-[10px] font-bold opacity-60 truncate max-w-[120px]">{user.displayName || user.email}</span>
                </div>
                {user.photoURL && (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-natural-accent/30 shadow-[0_0_10px_rgba(202,255,51,0.2)]" referrerPolicy="no-referrer" />
                )}
                <button 
                  onClick={() => signOut(auth)}
                  className="group flex items-center gap-2 p-2 hover:bg-red-500/10 rounded-full transition-all"
                  title="Se déconnecter"
                >
                  <LogOut className="w-5 h-5 text-stone-400 group-hover:text-red-500" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest text-stone-400">
                  <div className="w-1 h-1 bg-stone-400 rounded-full" />
                  Mode Invité
                </span>
                <button 
                  onClick={safeSignIn}
                  className="flex items-center gap-2 px-4 py-2 bg-natural-accent text-black font-bold rounded-full text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-natural-accent/30 active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Connexion</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 md:py-16 flex-grow">
        <AnimatePresence mode="wait">
          {step === 'info' && (
            <motion.div
              key="info-form"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-natural-subtle rounded-[40px] shadow-2xl shadow-stone-200/50 dark:shadow-black/20 overflow-hidden flex flex-col transition-colors duration-300"
            >
              <div className="p-6 sm:p-8 md:p-12 pb-0">
                <header className="mb-8 md:mb-10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex-grow">
                    {profile && showProfileEdit && (
                      <motion.button 
                        whileHover={{ x: -4 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowProfileEdit(false)}
                        aria-label="Annuler la modification du profil"
                        className="flex items-center gap-2 text-stone-400 hover:text-natural-accent transition-all mb-4 group"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Retour</span>
                      </motion.button>
                    )}
                    <h1 className="text-3xl sm:text-4xl font-serif font-medium text-natural-accent mb-2 tracking-tight">
                      {(!profile || showProfileEdit) ? "Votre Profil" : "Ma Séance"}
                    </h1>
                    <p className="text-stone-600 dark:text-stone-300 text-sm sm:text-base max-w-xl">
                      {(!profile || showProfileEdit) 
                        ? "Configurez vos informations de base." 
                        : "Prêt pour votre entraînement ?"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {profile && !showProfileEdit && (
                      <button 
                        onClick={() => setShowProfileEdit(true)}
                        className="group flex items-center gap-2 px-6 py-2.5 bg-neutral-subtle dark:bg-white/5 rounded-full border border-stone-200 dark:border-white/10 hover:border-natural-accent transition-all shadow-sm"
                      >
                        <User className="w-4 h-4 text-stone-600 dark:text-stone-400 group-hover:text-natural-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300 group-hover:text-natural-accent">Modifier mon profil</span>
                      </button>
                    )}
                    {history.length > 0 && profile && !showProfileEdit && (
                      <button 
                        onClick={() => setStep('history')}
                        className="group flex items-center gap-2 px-6 py-2.5 bg-neutral-subtle dark:bg-white/5 rounded-full border border-stone-200 dark:border-white/10 hover:border-natural-accent transition-all shadow-sm"
                      >
                        <History className="w-4 h-4 text-stone-600 dark:text-stone-400 group-hover:text-natural-accent" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-700 dark:text-stone-300 group-hover:text-natural-accent">Mon Journal ({history.length})</span>
                      </button>
                    )}
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
                  {/* Si Profile non complet ou Edition : Afficher tout */}
                  {(!profile || showProfileEdit) ? (
                    <>
                      {/* Colonne Gauche (Profil) */}
                      <div className="space-y-8 sm:space-y-10">
                        <section>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">Profil</label>
                          <div className="flex flex-col gap-4">
                            <div className="group w-full">
                              <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                placeholder="Votre prénom"
                                className="w-full bg-natural-subtle dark:bg-white/5 border-b-2 border-stone-100 dark:border-white/10 px-3 py-4 focus:border-natural-accent outline-none transition-all placeholder:text-stone-300 dark:placeholder:text-stone-600 font-medium"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="group">
                                <input
                                  type="number"
                                  name="age"
                                  value={formData.age}
                                  onChange={handleInputChange}
                                  placeholder="Âge"
                                  className="w-full bg-natural-subtle dark:bg-white/5 border-b-2 border-stone-100 dark:border-white/10 px-3 py-4 focus:border-natural-accent outline-none transition-all placeholder:text-stone-300 dark:placeholder:text-stone-600"
                                />
                              </div>
                              <div className="flex bg-stone-50 dark:bg-white/5 p-1 rounded-2xl gap-1 relative overflow-hidden">
                                {(['homme', 'femme'] as const).map((g) => (
                                  <button
                                    key={g}
                                    onClick={() => setFormData(prev => ({ ...prev, gender: g }))}
                                    className={`relative flex-1 min-h-[44px] py-1 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
                                      formData.gender === g 
                                        ? 'text-natural-accent dark:text-stone-900' 
                                        : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                                    }`}
                                  >
                                    {formData.gender === g && (
                                      <motion.div 
                                        layoutId="genderHighlight"
                                        className="absolute inset-0 bg-white dark:bg-natural-accent rounded-xl shadow-sm"
                                        transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                                      />
                                    )}
                                    <span className="relative z-10">{g}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>

                            <section>
                              <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">Environnement</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-1 gap-2">
                                {[
                                  { id: 'maison', label: 'À la maison', icon: '🏠' },
                                  { id: 'typique', label: 'Salle standard', icon: '🏢' },
                                  { id: 'professionnel', label: 'Salle pro / Club', icon: '💎' }
                                ].map((env) => (
                                  <button
                                    key={env.id}
                                    onClick={() => setFormData(prev => ({ ...prev, equipment: env.id as Equipment }))}
                                    className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${
                                      formData.equipment === env.id 
                                      ? 'border-natural-accent bg-natural-subtle dark:bg-natural-accent/10' 
                                      : 'border-stone-50 dark:border-white/5 hover:bg-natural-subtle/50'
                                    }`}
                                  >
                                    <span className="text-xl">{env.icon}</span>
                                    <span className="text-xs font-semibold">{env.label}</span>
                                  </button>
                                ))}
                              </div>
                            </section>
                          </div>

                      {/* Colonne Droite (Objectifs) */}
                      <div className="space-y-10">
                        <section>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">Niveau</label>
                          <div className="grid grid-cols-2 gap-3">
                            {(['débutant', 'intermédiaire', 'avancé', 'professionnel'] as const).map((lvl) => (
                              <label key={lvl} className="flex-1 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="experience" 
                                  checked={formData.experience === lvl}
                                  onChange={() => setFormData(prev => ({ ...prev, experience: lvl }))}
                                  className="hidden peer" 
                                />
                                <div className="text-center py-4 rounded-3xl border border-stone-50 dark:border-white/5 bg-stone-50/50 dark:bg-white/5 peer-checked:bg-natural-accent peer-checked:border-natural-accent peer-checked:text-black transition-all text-[10px] font-bold uppercase tracking-widest leading-none shadow-sm peer-checked:shadow-[0_0_15px_rgba(202,255,51,0.2)]">
                                  {lvl}
                                </div>
                              </label>
                            ))}
                          </div>
                        </section>

                        <section>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">Objectif Global</label>
                          <select
                            name="goal"
                            value={formData.goal}
                            onChange={handleInputChange}
                            className="w-full bg-natural-subtle border-b-2 border-stone-100 px-3 py-4 text-xs font-semibold focus:border-natural-accent outline-none transition-all"
                          >
                            <option value="perdrePoids">Perdre du poids</option>
                            <option value="prendreMuscle">Prendre du muscle</option>
                            <option value="gagnerForce">Gagner en force</option>
                          </select>
                        </section>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* MODE SÉANCE RAPIDE (Profil déjà sauvé) */}
                      <div className="space-y-10">
                        <section>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">Groupes Musculaires</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {MUSCLE_GROUPS.map((muscle) => (
                              <button
                                key={muscle}
                                onClick={() => toggleMuscle(muscle)}
                                className={`py-4 sm:py-2 px-1 text-[10px] font-black uppercase tracking-tight rounded-xl border transition-all ${
                                  formData.targetMuscles.includes(muscle)
                                  ? 'bg-natural-accent border-natural-accent text-black shadow-[0_0_15px_rgba(202,255,51,0.2)]' 
                                  : 'bg-white dark:bg-white/5 border-stone-100 dark:border-white/5 text-stone-500 hover:border-natural-accent'
                                }`}
                              >
                                {muscle}
                              </button>
                            ))}
                          </div>
                        </section>
                      </div>

                      <div className="space-y-10">
                        <section>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-4">Durée & Intensité</label>
                          <div className="space-y-6">
                            <div className="group">
                              <input
                                type="number"
                                name="duration"
                                value={formData.duration}
                                onChange={handleInputChange}
                                placeholder="Durée (min)"
                                className="w-full bg-natural-subtle border-b-2 border-stone-100 px-3 py-4 focus:border-natural-accent outline-none transition-all placeholder:text-stone-300 font-bold text-xl"
                              />
                            </div>
                            <div className="flex bg-stone-50 dark:bg-white/5 p-1.5 rounded-2xl gap-1">
                              {(['faible', 'modérée', 'élevée'] as const).map((level) => (
                                <button
                                  key={level}
                                  onClick={() => setFormData(prev => ({ ...prev, intensity: level }))}
                                  className={`flex-1 min-h-[44px] py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                                    formData.intensity === level 
                                      ? 'bg-white dark:bg-natural-accent text-natural-accent dark:text-black shadow-[0_0_15px_rgba(202,255,51,0.2)]' 
                                      : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
                                  }`}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                          </div>
                        </section>
                      </div>
                    </>
                  )}
                </div>

                {error && (
                  <div className="mt-8 flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-medium border border-red-100">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
              </div>

              {/* Barre d'action */}
              <div className="mt-12 bg-natural-accent p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
                <div className="text-black/80 font-medium text-sm text-center md:text-left tracking-wide leading-relaxed">
                  <p>
                    {(!profile || showProfileEdit) 
                      ? "Le profil utilisateur sera mémorisé pour vos prochaines visites." 
                      : `Programme pour ${profile.gender} (${profile.age} ans) • ${profile.experience}`}
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={generateWorkout}
                  disabled={loading}
                  aria-label={(!profile || showProfileEdit) ? "Continuer vers les options de séance" : "Générer mon pack d'entraînement personnalisé"}
                  className="w-full md:w-auto bg-black text-natural-accent px-12 py-5 rounded-full font-black shadow-2xl transition-all uppercase tracking-[0.25em] text-[11px] flex items-center justify-center gap-3 disabled:opacity-70 border border-natural-accent/20"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    (!profile || showProfileEdit) ? "Valider mon profil" : "Bâtir mon programme"
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}

          {step === 'workout' && workout && (
            focusedExerciseIndex !== null ? (
              <motion.div
                key="focus-mode"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="fixed inset-0 z-[100] bg-white dark:bg-stone-950 flex flex-col"
              >
                {/* Header - Fixed & Optimized */}
                <div className="p-4 md:p-8 md:pb-6 shrink-0 z-20 bg-white dark:bg-stone-950">
                  <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
                    <button 
                      onClick={() => setFocusedExerciseIndex(null)}
                      className="flex items-center gap-2 text-stone-500 hover:text-black dark:text-stone-400 dark:hover:text-white transition-colors group"
                    >
                      <Minimize2 className="w-5 h-5 md:w-6 md:h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Quitter</span>
                    </button>
                    <div className="flex items-center gap-3 md:gap-6">
                      <span className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] text-natural-accent whitespace-nowrap">Ex {focusedExerciseIndex + 1}/{workout.exercises.length}</span>
                      <div className="w-20 md:w-64 h-1.5 md:h-2 bg-stone-100 dark:bg-white/5 rounded-full overflow-hidden border border-stone-200/50 dark:border-white/10">
                        <div 
                          className="h-full bg-natural-accent transition-all duration-700 ease-out shadow-[0_0_10px_rgba(202,255,51,0.3)]" 
                          style={{ width: `${((focusedExerciseIndex + 1) / workout.exercises.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Content - Scrollable area */}
                <div className="flex-1 overflow-hidden flex flex-col max-w-7xl mx-auto w-full relative">
                  <div className="flex-1 overflow-y-auto px-4 md:px-8 custom-scrollbar">
                    <div className="flex flex-col lg:flex-row gap-6 md:gap-8 pb-32 lg:pb-8">
                      {/* Left Column: Visuals & Info */}
                      <div className="flex-1 space-y-4 md:space-y-6">
                         <div className="relative aspect-video bg-stone-100 dark:bg-white/5 rounded-[32px] md:rounded-[40px] overflow-hidden group">
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 md:p-8 text-center">
                            <Dumbbell className="w-12 h-12 md:w-16 md:h-16 text-natural-accent mb-3 md:mb-4 opacity-20" />
                            <h2 className="text-2xl md:text-3xl lg:text-5xl font-serif font-medium mb-3 md:mb-4 text-balance leading-tight">
                              {workout.exercises[focusedExerciseIndex].name}
                            </h2>
                            <div className="flex gap-2 md:gap-4 flex-wrap justify-center">
                              {workout.exercises[focusedExerciseIndex].youtubeUrl && (
                                 <a 
                                   href={workout.exercises[focusedExerciseIndex].youtubeUrl} 
                                   target="_blank" 
                                   rel="noreferrer"
                                   className="px-4 md:px-6 py-2 md:py-3 bg-red-500 text-white rounded-full font-bold text-[9px] md:text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                                 >
                                   <Youtube className="w-4 h-4" /> Vidéo
                                 </a>
                              )}
                              {workout.exercises[focusedExerciseIndex].googleImageUrl && (
                                 <a 
                                   href={workout.exercises[focusedExerciseIndex].googleImageUrl} 
                                   target="_blank" 
                                   rel="noreferrer"
                                   className="px-4 md:px-6 py-2 md:py-3 bg-blue-500 text-white rounded-full font-bold text-[9px] md:text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                                 >
                                   <ImageIcon className="w-4 h-4" /> Image
                                 </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="bg-stone-50 dark:bg-white/5 p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-stone-100 dark:border-white/5">
                          <div className="flex items-center gap-2 mb-3 md:mb-4 text-natural-accent">
                            <ClipboardList className="w-4 h-4 md:w-5 md:h-5" />
                            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest">Instructions</h3>
                          </div>
                          <p className="text-sm md:text-lg text-stone-700 dark:text-stone-300 font-serif leading-relaxed italic">
                            {workout.exercises[focusedExerciseIndex].form}
                          </p>
                        </div>
                      </div>

                      {/* Right Column: Tracking & Log */}
                      <div className="w-full lg:w-[420px] shrink-0">
                        <div className="bg-stone-900 text-white p-6 md:p-8 rounded-[32px] md:rounded-[48px] shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-natural-accent/15 rounded-full blur-3xl -mr-16 -mt-16" />
                          
                          <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-6 md:mb-8">
                               <div className="space-y-1">
                                  <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-natural-accent">Objectif</p>
                                  <p className="text-xl md:text-3xl font-black">{workout.exercises[focusedExerciseIndex].sets} x {workout.exercises[focusedExerciseIndex].reps}</p>
                               </div>
                            </div>

                            <div className="space-y-4">
                              <label className="block text-[8px] md:text-[10px] font-black uppercase tracking-widest text-white/60">Log des Séries</label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 overflow-y-visible">
                                {Array.from({ length: parseInt(workout.exercises[focusedExerciseIndex].sets) || 1 }).map((_, setIdx) => {
                                  const isCompleted = workout.exercises[focusedExerciseIndex].completedWeights?.[setIdx];
                                  return (
                                    <motion.div 
                                      key={setIdx} 
                                      whileHover={{ scale: 1.01 }}
                                      className={`p-4 md:p-5 rounded-[24px] md:rounded-[28px] border-2 transition-all flex flex-col gap-2 ${
                                        isCompleted
                                        ? 'bg-natural-accent/15 border-natural-accent shadow-[0_0_20px_rgba(202,255,51,0.15)] scale-[1.02]'
                                        : 'bg-white/5 border-white/10'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-natural-accent' : 'opacity-60'}`}>Série {setIdx + 1}</span>
                                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-natural-accent" />}
                                      </div>
                                      
                                      <div className="flex items-end gap-3">
                                        <div className="flex-1">
                                          <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-1">Poids (kg)</p>
                                          <input 
                                            type="text"
                                            inputMode="decimal"
                                            value={workout.exercises[focusedExerciseIndex].completedWeights?.[setIdx] || ''}
                                            onChange={(e) => updateWeight(focusedExerciseIndex, setIdx, e.target.value)}
                                            placeholder="0.0"
                                            className="bg-transparent text-xl md:text-3xl font-black focus:outline-none placeholder:text-white/20 w-full"
                                          />
                                        </div>
                                        <div className="w-[80px]">
                                          <p className="text-[7px] font-black text-white/30 uppercase tracking-widest mb-1 text-right">RPE (0-10)</p>
                                          <input 
                                            type="text"
                                            inputMode="numeric"
                                            value={workout.exercises[focusedExerciseIndex].completedRPEs?.[setIdx] || ''}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 10)) {
                                                updateRPE(focusedExerciseIndex, setIdx, val);
                                              }
                                            }}
                                            placeholder="—"
                                            className="bg-transparent text-lg md:text-xl font-black focus:outline-none placeholder:text-white/20 w-full text-right"
                                          />
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Desktop Controls */}
                            <div className="hidden lg:flex mt-8 pt-8 border-t border-white/10 flex-col gap-4">
                               <div className="flex items-center gap-4">
                                  <button 
                                    onClick={() => focusedExerciseIndex > 0 && setFocusedExerciseIndex(focusedExerciseIndex - 1)}
                                    disabled={focusedExerciseIndex === 0}
                                    className="h-16 w-16 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/15 disabled:opacity-20 transition-all font-black"
                                  >
                                    <ChevronLeft className="w-8 h-8" />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (focusedExerciseIndex < workout.exercises.length - 1) {
                                        setFocusedExerciseIndex(focusedExerciseIndex + 1);
                                      } else {
                                        setFocusedExerciseIndex(null);
                                      }
                                    }}
                                    className="h-16 flex-1 rounded-[32px] bg-natural-accent text-black font-black uppercase tracking-[0.1em] text-xs flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_40px_rgba(202,255,51,0.25)]"
                                  >
                                    <span>{focusedExerciseIndex < workout.exercises.length - 1 ? 'Exercice Suivant' : 'Terminer Focus'}</span>
                                    <ChevronRight className="w-6 h-6" />
                                  </button>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fixed Mobile Navigation Footer */}
                  <div className="lg:hidden p-4 pb-8 md:pb-10 bg-white dark:bg-stone-950 border-t border-stone-100 dark:border-white/5 shrink-0 z-30">
                    <div className="flex items-center gap-3 max-w-sm mx-auto">
                        <button 
                          onClick={() => focusedExerciseIndex > 0 && setFocusedExerciseIndex(focusedExerciseIndex - 1)}
                          disabled={focusedExerciseIndex === 0}
                          className="h-14 w-14 rounded-full flex items-center justify-center bg-stone-100 dark:bg-white/10 border border-stone-200 dark:border-white/10 disabled:opacity-30 active:scale-95 transition-all"
                        >
                          <ChevronLeft className="w-6 h-6" />
                        </button>
                        
                        <button 
                          onClick={() => {
                            if (focusedExerciseIndex < workout.exercises.length - 1) {
                              setFocusedExerciseIndex(focusedExerciseIndex + 1);
                            } else {
                              setFocusedExerciseIndex(null);
                            }
                          }}
                          className="h-14 flex-1 rounded-[24px] bg-natural-accent text-black font-black uppercase tracking-[0.1em] text-[10px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg"
                        >
                          <span>{focusedExerciseIndex < workout.exercises.length - 1 ? 'Suivant' : 'Terminer'}</span>
                          <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="workout-display"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-stone-900/40 backdrop-blur-sm rounded-[40px] shadow-2xl shadow-stone-200/50 dark:shadow-black/40 overflow-hidden border border-transparent dark:border-white/5"
            >
              <div className="p-8 md:p-12">
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 text-stone-400 hover:text-natural-accent transition-colors mb-8 group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest">Ajuster mes données</span>
                </button>

                <header className="mb-12 border-b border-stone-100 pb-10">
                  {/* Progress Bar Container */}
                  <div className="mb-8 group">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-natural-accent">Progression Séance</span>
                       <span className="text-[10px] font-black text-stone-400 tabular-nums">
                         {Math.round((workout.exercises.reduce((acc, ex) => acc + (ex.completedWeights?.filter(w => w !== '').length || 0), 0) / 
                          (workout.exercises.reduce((acc, ex) => acc + (parseInt(ex.sets) || 1), 0) || 1)) * 100)}%
                       </span>
                    </div>
                    <div className="p-1 bg-stone-100 dark:bg-white/5 rounded-full overflow-hidden border border-stone-200/50 dark:border-white/5">
                      <div 
                        className="h-2 bg-natural-accent rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(202,255,51,0.3)]" 
                        style={{ 
                          width: `${(workout.exercises.reduce((acc, ex) => acc + (ex.completedWeights?.filter(w => w !== '').length || 0), 0) / 
                            (workout.exercises.reduce((acc, ex) => acc + (parseInt(ex.sets) || 1), 0) || 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <h2 className="text-4xl font-serif font-medium text-natural-accent tracking-tight">{workout?.title}</h2>
                      <button 
                        onClick={toggleFavorite}
                        className={`p-3 rounded-full border transition-all ${
                          favorites.some(f => f.id === workout?.id)
                          ? 'bg-yellow-50 border-yellow-200 text-yellow-500'
                          : 'bg-stone-50 border-stone-100 text-stone-300 hover:text-yellow-500'
                        }`}
                        title="Enregistrer ce programme"
                      >
                        <Star className={`w-5 h-5 ${favorites.some(f => f.id === workout?.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-natural-highlight text-natural-accent px-4 py-1.5 rounded-full shadow-sm">
                      <Zap className="w-4 h-4 fill-current" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{formData.intensity}</span>
                    </div>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 text-lg leading-relaxed font-serif italic italic-small">"{workout?.description}"</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-12">
                  <div className="bg-natural-subtle dark:bg-white/5 p-4 sm:p-6 rounded-[24px] sm:rounded-[30px] border border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-stone-400 mb-1 sm:mb-2 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                      <Clock className="w-3 h-3 sm:w-4 h-4" />
                      <span>Durée</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold">{formData.duration} <span className="text-xs sm:text-sm font-medium text-stone-400">min</span></p>
                  </div>
                  <div className="bg-natural-subtle dark:bg-white/5 p-4 sm:p-6 rounded-[24px] sm:rounded-[30px] border border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-stone-400 mb-1 sm:mb-2 text-[8px] sm:text-[10px] font-bold uppercase tracking-widest">
                      <Target className="w-3 h-3 sm:w-4 h-4" />
                      <span>Cibles</span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold truncate">{formData.targetMuscles.join(', ') || 'Corps complet'}</p>
                  </div>
                </div>

                <div className="space-y-16">
                  {/* Échauffement */}
                  {workout?.warmup && workout.warmup.length > 0 && (
                    <section>
                      <div className="flex items-center gap-4 mb-8">
                        <div className="h-px bg-stone-100 dark:bg-white/5 flex-grow" />
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full border border-orange-100 dark:border-orange-800">
                          <Flame className="w-4 h-4 text-orange-500" />
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-orange-600 dark:text-orange-400 shrink-0">Échauffement</h3>
                        </div>
                        <div className="h-px bg-stone-100 dark:bg-white/5 flex-grow" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {workout.warmup.map((step, i) => (
                           <div key={`warmup-${i}`} className="flex items-start justify-between gap-6 p-4 bg-stone-50 dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-white/10 group hover:border-orange-300 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-white/10 text-xs font-black text-stone-500 dark:text-stone-400 group-hover:text-orange-500 transition-colors shadow-sm">
                                {i + 1}
                              </span>
                              <p className="text-base font-bold text-stone-800 dark:text-white">{typeof step === 'string' ? step : step.name}</p>
                            </div>
                            
                            {typeof step !== 'string' && (
                              <div className="flex gap-2 shrink-0">
                                {step.youtubeUrl && (
                                  <a href={step.youtubeUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 text-stone-400 hover:text-red-500 transition-all border border-stone-100 dark:border-white/5 hover:border-red-500/50">
                                    <Youtube className="w-5 h-5" />
                                  </a>
                                )}
                                {step.googleImageUrl && (
                                  <a href={step.googleImageUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 text-stone-400 hover:text-blue-500 transition-all border border-stone-100 dark:border-white/5 hover:border-blue-500/50">
                                    <ImageIcon className="w-5 h-5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="flex items-center gap-4 mb-10">
                      <div className="h-px bg-stone-100 dark:bg-white/5 flex-grow" />
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                        <Dumbbell className="w-4 h-4 text-blue-500" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600 dark:text-blue-400 shrink-0">Corps de Séance</h3>
                      </div>
                      <div className="h-px bg-stone-100 dark:bg-white/5 flex-grow" />
                    </div>
                    <div className="space-y-10">
                      {workout?.exercises.map((ex, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="bg-white dark:bg-black/20 border border-stone-200 dark:border-white/5 rounded-[32px] overflow-hidden hover:border-natural-accent transition-all duration-300"
                        >
                          <div className="p-5 sm:p-6 md:p-8">
                            <div className="flex flex-col gap-5 sm:gap-6">
                              {/* Header: Titre et Actions */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <h4 className="font-serif font-bold text-xl sm:text-2xl text-black dark:text-white leading-tight flex-grow max-w-full sm:max-w-[70%] tracking-tight">
                                  {ex.name}
                                </h4>
                                
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                                  <button
                                    onClick={() => setFocusedExerciseIndex(i)}
                                    className="px-4 py-2 bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-300 font-bold uppercase tracking-widest text-[9px] rounded-full hover:bg-natural-accent hover:text-black transition-all flex items-center gap-2 border border-stone-200 dark:border-white/10"
                                    title="Mode Focus"
                                  >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                    <span>Focus</span>
                                  </button>

                                  <button
                                    onClick={() => deleteExercise(i)}
                                    className="p-2 text-stone-300 dark:text-stone-500 hover:text-red-500 transition-colors bg-stone-50/50 dark:bg-white/5 rounded-lg"
                                    title="Supprimer l'exercice"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => getAlternative(i)}
                                    disabled={loadingAlternative !== null}
                                    className="px-6 py-2.5 bg-natural-accent text-black font-bold uppercase tracking-widest text-[10px] rounded-full hover:opacity-90 transition-all flex items-center gap-2 group/alt shadow-[0_0_15px_rgba(202,255,51,0.3)]"
                                    title="Trouver une alternative"
                                  >
                                    {loadingAlternative === i ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Zap className="w-4 h-4 fill-current" />
                                    )}
                                    <span>Alternative</span>
                                  </button>

                                  {/* Dock Vidéo/Image */}
                                  <div className="flex gap-2 shrink-0">
                                    {ex.youtubeUrl && (
                                      <a 
                                        href={ex.youtubeUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center justify-center w-10 h-10 rounded-full bg-natural-subtle dark:bg-white/5 text-stone-500 hover:text-red-500 transition-all border border-stone-200 dark:border-white/10 hover:border-red-500/50"
                                        title="Vidéo"
                                      >
                                        <Youtube className="w-5 h-5" />
                                      </a>
                                    )}
                                    {ex.googleImageUrl && (
                                      <a 
                                        href={ex.googleImageUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center justify-center w-10 h-10 rounded-full bg-natural-subtle dark:bg-white/5 text-stone-500 hover:text-blue-500 transition-all border border-stone-200 dark:border-white/10 hover:border-blue-500/50"
                                        title="Images"
                                      >
                                        <ImageIcon className="w-5 h-5" />
                                      </a>
                                    )}
                                  </div>

                                  {/* Badges de stats - Harmonisation de la largeur */}
                                  <div className="flex gap-3">
                                    <div className="bg-natural-subtle dark:bg-transparent px-4 py-2 rounded-2xl text-center min-w-[70px] border-2 border-natural-accent shadow-[0_0_10px_rgba(202,255,51,0.1)]">
                                      <span className="block text-[8px] font-black uppercase tracking-tighter text-natural-accent mb-0.5">Séries</span>
                                      <span className="font-black text-natural-ink text-lg leading-none">{ex.sets}</span>
                                    </div>
                                    <div className="bg-natural-subtle dark:bg-transparent px-4 py-2 rounded-2xl text-center min-w-[70px] border-2 border-natural-accent shadow-[0_0_10px_rgba(202,255,51,0.1)]">
                                      <span className="block text-[8px] font-black uppercase tracking-tighter text-natural-accent mb-0.5">Reps</span>
                                      <span className="font-black text-natural-ink text-lg leading-none">{ex.reps}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Détails Techniques */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-4">
                                  <div className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">Technique & Forme</label>
                                    <p className="text-sm text-stone-700 dark:text-stone-200 leading-relaxed font-serif italic text-balance">{ex.form}</p>
                                  </div>
                                  
                                  {/* Suivi des poids */}
                                  <div className="pt-4 border-t border-stone-100 dark:border-white/5">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400 mb-3">Suivi des poids (kg)</label>
                                    <div className="flex flex-wrap gap-2 items-end">
                                      {Array.from({ length: parseInt(ex.sets) || 1 }).map((_, setIdx) => (
                                        <div key={setIdx} className="flex flex-col gap-1">
                                          <div className="flex items-center justify-between px-1">
                                            <span className="text-[9px] font-bold text-stone-400 dark:text-stone-500 uppercase">S{setIdx + 1}</span>
                                            {ex.completedWeights?.[setIdx] && (
                                              <CheckCircle2 className="w-2 h-2 text-natural-accent" />
                                            )}
                                          </div>
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={ex.completedWeights?.[setIdx] || ''}
                                            onChange={(e) => updateWeight(i, setIdx, e.target.value)}
                                            placeholder="—"
                                            className={`w-12 h-10 bg-stone-50 dark:bg-white/5 border rounded-lg text-center text-xs font-bold focus:border-natural-accent outline-none transition-all ${
                                              ex.completedWeights?.[setIdx] 
                                              ? 'border-natural-accent/40 bg-natural-accent/5' 
                                              : 'border-stone-100 dark:border-white/10'
                                            }`}
                                          />
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-2">
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">Adaptation ({formData.experience})</label>
                                  <p className="text-sm text-natural-accent dark:text-natural-accent font-medium leading-relaxed">{ex.modifications}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-natural-subtle dark:bg-white/5 px-8 py-3 flex items-center gap-2 border-t border-stone-100 dark:border-white/5">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600 dark:text-stone-400">Conseil : {ex.notes}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>

                  {/* Retour au calme */}
                  {workout?.cooldown && workout.cooldown.length > 0 && (
                    <section>
                      <div className="flex items-center gap-4 mb-8">
                        <div className="h-px bg-stone-100 dark:bg-white/5 flex-grow" />
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-teal-50 dark:bg-teal-900/20 rounded-full border border-teal-100 dark:border-teal-800">
                          <CheckCircle2 className="w-4 h-4 text-teal-500" />
                          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-teal-600 dark:text-teal-400 shrink-0">Retour au calme</h3>
                        </div>
                        <div className="h-px bg-stone-100 dark:bg-white/5 flex-grow" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {workout.cooldown.map((step, i) => (
                            <div key={`cooldown-${i}`} className="flex items-start justify-between gap-6 p-4 bg-stone-50 dark:bg-white/5 rounded-2xl border border-stone-200 dark:border-white/10 group hover:border-teal-300 transition-colors">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-white/10 text-xs font-black text-stone-500 dark:text-stone-400 group-hover:text-teal-500 transition-colors shadow-sm">
                                {i + 1}
                              </span>
                              <p className="text-base font-bold text-stone-800 dark:text-white">{typeof step === 'string' ? step : step.name}</p>
                            </div>

                            {typeof step !== 'string' && (
                              <div className="flex gap-2 shrink-0">
                                {step.youtubeUrl && (
                                  <a href={step.youtubeUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 text-stone-400 hover:text-red-500 transition-all border border-stone-100 dark:border-white/5 hover:border-red-500/50">
                                    <Youtube className="w-5 h-5" />
                                  </a>
                                )}
                                {step.googleImageUrl && (
                                  <a href={step.googleImageUrl} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-white/10 text-stone-400 hover:text-blue-500 transition-all border border-stone-100 dark:border-white/5 hover:border-blue-500/50">
                                    <ImageIcon className="w-5 h-5" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <div className="mt-20 flex flex-col items-center">
                  <button 
                    onClick={finishSession}
                    className="bg-natural-accent text-black px-16 py-6 rounded-full font-black shadow-[0_0_30px_rgba(202,255,51,0.4)] hover:scale-105 active:scale-95 transition-all transition-all uppercase tracking-[0.3em] text-[11px] mb-4"
                  >
                    Séance Terminée
                  </button>
                  <p className="text-stone-500 dark:text-stone-400 text-[11px] font-bold uppercase tracking-widest">Enregistrer & Quitter</p>
                </div>
              </div>
            </motion.div>
          ))}

          {step === 'history' && (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-natural-subtle rounded-[40px] shadow-2xl shadow-stone-200/50 dark:shadow-black/20 overflow-hidden transition-colors duration-300"
            >
              <div className="p-8 md:p-12 text-center md:text-left">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStep('info')}
                  aria-label="Retour au profil"
                  className="flex items-center gap-2 text-stone-400 hover:text-natural-accent transition-all mb-8 group mx-auto md:mx-0 bg-stone-100 dark:bg-white/5 px-4 py-2 rounded-full"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Retour au profil</span>
                </motion.button>

                <header className="mb-12 border-b border-stone-100 pb-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-4xl font-serif font-medium text-natural-accent tracking-tight mb-2">Mon Journal</h2>
                    
                    <div className="flex flex-wrap bg-stone-100 dark:bg-white/5 p-1 rounded-2xl gap-1 w-full sm:w-auto">
                      <button
                        onClick={() => setHistoryTab('sessions')}
                        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          historyTab === 'sessions' 
                          ? 'bg-white dark:bg-natural-accent text-natural-accent dark:text-black shadow-sm' 
                          : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
                        }`}
                      >
                        Historique
                      </button>
                      <button
                        onClick={() => setHistoryTab('favorites')}
                        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          historyTab === 'favorites' 
                          ? 'bg-white dark:bg-natural-accent text-natural-accent dark:text-black shadow-sm' 
                          : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
                        }`}
                      >
                        Favoris ({favorites.length})
                      </button>
                      <button
                        onClick={() => setHistoryTab('stats')}
                        className={`flex-1 sm:flex-none px-4 sm:px-6 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                          historyTab === 'stats' 
                          ? 'bg-white dark:bg-natural-accent text-natural-accent dark:text-black shadow-sm' 
                          : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
                        }`}
                      >
                        Stats
                      </button>
                    </div>
                  </div>
                  <p className="text-stone-600 dark:text-stone-400 text-sm">
                    {historyTab === 'sessions' 
                      ? "Retrouvez toutes vos performances passées en un clin d'œil." 
                      : historyTab === 'favorites' 
                      ? "Vos programmes préférés prêts à être relancés."
                      : "Visualisez votre progression et vos efforts."}
                  </p>
                </header>

                <div className="space-y-4">
                  {historyTab === 'sessions' && !user && (
                    <div className="p-8 bg-natural-accent/5 border border-natural-accent/20 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
                      <div className="flex items-center gap-4 text-center md:text-left">
                        <CloudOff className="w-10 h-10 text-natural-accent opacity-50" />
                        <div>
                          <h3 className="font-bold text-sm uppercase tracking-widest mb-1">Tes données sont en Local</h3>
                          <p className="text-xs text-stone-500 max-w-xs">Connecte-toi à Repz Cloud pour synchroniser ton historique sur tous tes appareils.</p>
                        </div>
                      </div>
                      <button 
                        onClick={safeSignIn}
                        className="px-8 py-4 bg-natural-accent text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-full hover:scale-105 transition-all shadow-lg shadow-natural-accent/20 active:scale-95 whitespace-nowrap"
                      >
                        Synchroniser maintenant
                      </button>
                    </div>
                  )}
                  {historyTab === 'sessions' ? (
                    history.length === 0 ? (
                      <div className="text-center py-20 grayscale opacity-30">
                        <History className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-serif italic font-medium">Aucune séance enregistrée pour le moment.</p>
                      </div>
                    ) : (
                      history.map((h) => (
                        <div 
                          key={h.id}
                          onClick={() => {
                            setWorkout(h);
                            setStep('workout');
                          }}
                          className="group flex flex-col md:flex-row md:items-center justify-between p-6 bg-natural-subtle dark:bg-white/5 hover:bg-stone-100 dark:hover:bg-white/10 border border-transparent hover:border-natural-accent rounded-[32px] transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-stone-200/40"
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-3 mb-2">
                               <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-widest">{h.date}</span>
                               <div className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600" />
                               <span className="text-[11px] font-bold text-natural-accent uppercase tracking-widest">{h.params.goal}</span>
                            </div>
                            <h4 className="text-xl font-serif font-medium text-natural-ink dark:text-white">{h.title}</h4>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {h.exercises.map((e, idx) => (
                                <div key={`${h.id}-ex-${idx}`} className="flex items-center gap-1.5 px-2 py-0.5 bg-stone-100 dark:bg-white/10 rounded-md text-[8px] font-medium text-stone-500 dark:text-stone-400 uppercase border border-stone-100 dark:border-white/5">
                                  <span>{e.name}</span>
                                  {e.completedWeights && (
                                    <Award className="w-2.5 h-2.5 text-blue-400" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-4 md:mt-0 justify-between md:justify-end">
                            <div className="flex flex-col items-end gap-1">
                               <div className="flex -space-x-2">
                                  <div className="px-3 py-1 bg-white dark:bg-natural-accent/30 border border-stone-200 dark:border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-tighter text-stone-600 dark:text-stone-300 shadow-sm z-10 uppercase">
                                    {h.params.intensity}
                                  </div>
                                  <div className="px-3 py-1 bg-white dark:bg-natural-accent/30 border border-stone-200 dark:border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-tighter text-stone-600 dark:text-stone-300 shadow-sm">
                                    {h.params.duration} min
                                  </div>
                               </div>
                               {(h as any).volume > 0 && (
                                 <div className="flex items-center gap-2 text-[9px] font-black uppercase text-natural-accent tracking-widest mt-1">
                                   <TrendingUp className="w-3 h-3" />
                                   <span>{(h as any).volume} kg</span>
                                   {(h as any).avgRpe && (
                                     <>
                                       <span className="text-white/20">•</span>
                                       <span>RPE {(h as any).avgRpe}</span>
                                     </>
                                   )}
                                 </div>
                               )}
                            </div>
                            <button 
                              onClick={(e) => deleteFromHistory(h.id, e)}
                              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )
                  ) : historyTab === 'favorites' ? (
                    favorites.length === 0 ? (
                      <div className="text-center py-20 grayscale opacity-30">
                        <Star className="w-12 h-12 mx-auto mb-4" />
                        <p className="font-serif italic font-medium">Enregistrez un programme pour le retrouver ici.</p>
                      </div>
                    ) : (
                      favorites.map((f) => (
                        <div 
                          key={f.id}
                          onClick={() => {
                            setWorkout({
                              ...f,
                              id: crypto.randomUUID(), // Nouveau ID pour une nouvelle séance
                              date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                            });
                            setStep('workout');
                          }}
                          className="group flex flex-col md:flex-row md:items-center justify-between p-6 bg-natural-accent/5 hover:bg-natural-accent/10 border border-natural-accent/20 hover:border-natural-accent rounded-[32px] transition-all cursor-pointer shadow-sm hover:shadow-[0_0_20px_rgba(202,255,51,0.1)]"
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-3 mb-2">
                               <span className="text-[10px] font-bold text-natural-accent uppercase tracking-widest">Programme Enregistré</span>
                               <div className="w-1.5 h-1.5 rounded-full bg-natural-accent/30" />
                               <span className="text-[10px] font-bold text-natural-ink/60 dark:text-white/60 uppercase tracking-widest">{f.params.goal}</span>
                            </div>
                            <h4 className="text-xl font-serif font-medium text-natural-ink dark:text-white">{f.title}</h4>
                            <p className="text-xs text-stone-600 dark:text-stone-400 mt-1 truncate max-w-sm">{f.description}</p>
                          </div>
                          <div className="flex items-center gap-4 mt-4 md:mt-0 justify-between md:justify-end">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setFavorites(prev => prev.filter(fav => fav.id !== f.id));
                              }}
                              className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="px-8 py-3 bg-natural-accent text-black rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg group-hover:scale-105 transition-transform">
                              Lancer
                            </div>
                          </div>
                        </div>
                      ))
                    )
                  ) : (
                    <div className="space-y-12">
                      {/* Dashboard Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-natural-subtle dark:bg-stone-900/50 p-6 rounded-[32px] border border-stone-100 dark:border-white/5 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Séances</p>
                          <p className="text-4xl font-black text-natural-accent tabular-nums">{history.length}</p>
                        </div>
                        <div className="bg-natural-subtle dark:bg-stone-900/50 p-6 rounded-[32px] border border-stone-100 dark:border-white/5 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Favoris</p>
                          <p className="text-4xl font-black text-natural-accent tabular-nums">{favorites.length}</p>
                        </div>
                        <div className="bg-natural-subtle dark:bg-stone-900/50 p-6 rounded-[32px] border border-stone-100 dark:border-white/5 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Minutes</p>
                          <p className="text-4xl font-black text-natural-accent tabular-nums">
                            {history.reduce((acc, h) => acc + parseInt(h.params.duration || '0'), 0)}
                          </p>
                        </div>
                        <div className="bg-natural-subtle dark:bg-stone-900/50 p-6 rounded-[32px] border border-stone-100 dark:border-white/5 shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Séries Tot.</p>
                          <p className="text-4xl font-black text-natural-accent tabular-nums">
                            {history.reduce((acc, h) => acc + h.exercises.reduce((exAcc, ex) => exAcc + (parseInt(ex.sets) || 0), 0), 0)}
                          </p>
                        </div>
                      </div>

                      {/* Distribution de l'Intensité */}
                      <div className="bg-white dark:bg-stone-900/40 p-8 rounded-[40px] border border-stone-100 dark:border-white/5 shadow-xl shadow-stone-200/20">
                         <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-stone-500 flex items-center gap-2">
                               <Activity className="w-4 h-4 text-natural-accent" />
                               Intensité des Séances
                            </h3>
                         </div>
                         <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                               <LineChart data={history.slice(-10).map((h, i) => ({
                                  name: h.date?.split(' ')[0] || `S${i}`,
                                  intensity: h.params.intensity === 'faible' ? 1 : h.params.intensity === 'modérée' ? 2 : 3,
                                  duration: parseInt(h.params.duration || '0')
                               }))}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                  <YAxis hide domain={[0, 4]} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: '16px', fontSize: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                                    itemStyle={{ color: '#ACE149' }}
                                  />
                                  <Line 
                                    type="monotone" 
                                    dataKey="intensity" 
                                    stroke="#ACE149" 
                                    strokeWidth={4} 
                                    dot={{ fill: '#ACE149', strokeWidth: 2, r: 4, stroke: '#fff' }}
                                    activeDot={{ r: 8, strokeWidth: 0 }}
                                  />
                               </LineChart>
                            </ResponsiveContainer>
                         </div>
                         <div className="flex justify-center gap-6 mt-6">
                            <div className="flex items-center gap-2">
                               <div className="w-2.5 h-2.5 rounded-full bg-natural-accent opacity-30" />
                               <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">1: Faible</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="w-2.5 h-2.5 rounded-full bg-natural-accent opacity-60" />
                               <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">2: Modérée</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="w-2.5 h-2.5 rounded-full bg-natural-accent" />
                               <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">3: Élevée</span>
                            </div>
                         </div>
                      </div>

                      {/* Muscle Distribution & sets per session */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white dark:bg-stone-900/40 p-8 rounded-[40px] border border-stone-100 dark:border-white/5 shadow-xl shadow-stone-200/20">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-stone-500 mb-8 flex items-center gap-2">
                             <PieChartIcon className="w-4 h-4 text-natural-accent" />
                             Répartition des Muscles
                          </h3>
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={Object.entries(
                                    history.reduce((acc: any, h) => {
                                      h.params.targetMuscles?.forEach(m => acc[m] = (acc[m] || 0) + 1);
                                      return acc;
                                    }, {})
                                  ).map(([name, value]) => ({ name, value }))}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={70}
                                  outerRadius={90}
                                  paddingAngle={8}
                                  dataKey="value"
                                >
                                  {Object.entries(history.reduce((acc: any, h) => {
                                    h.params.targetMuscles?.forEach(m => acc[m] = (acc[m] || 0) + 1);
                                    return acc;
                                  }, {})).map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#ACE149' : `rgba(172, 225, 73, ${1 - index * 0.15})`} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: '16px', fontSize: '10px' }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-8">
                             {Object.entries(
                               history.reduce((acc: any, h) => {
                                 h.params.targetMuscles?.forEach(m => acc[m] = (acc[m] || 0) + 1);
                                 return acc;
                               }, {})
                             ).sort((a: any, b: any) => b[1] - a[1]).slice(0, 4).map(([muscle, count]) => (
                               <div key={String(muscle)} className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-white/5 rounded-2xl border border-stone-100 dark:border-white/5">
                                 <div className="w-2 h-2 rounded-full bg-natural-accent" />
                                 <div className="flex-1">
                                   <p className="text-[10px] font-black uppercase text-stone-500 tracking-tighter">{muscle as string}</p>
                                   <p className="text-xs font-bold text-stone-800 dark:text-stone-200">{count as number} sessions</p>
                                 </div>
                               </div>
                             ))}
                          </div>
                        </div>

                        <div className="bg-white dark:bg-stone-900/40 p-8 rounded-[40px] border border-stone-100 dark:border-white/5 shadow-xl shadow-stone-200/20">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-stone-500 mb-8 flex items-center gap-2">
                             <TrendingUp className="w-4 h-4 text-natural-accent" />
                             Volume de Travail
                          </h3>
                          <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={history.slice(-8).map((h, i) => ({
                                name: `S${history.length - history.slice(-8).length + i + 1}`,
                                sets: h.exercises.reduce((acc, e) => acc + (parseInt(e.sets) || 0), 0)
                              }))}>
                                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: '16px', fontSize: '10px' }}
                                  cursor={{ fill: 'rgba(202, 255, 51, 0.05)' }}
                                />
                                <Bar dataKey="sets" fill="#ACE149" radius={[6, 6, 0, 0]} barSize={32} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-8 p-4 bg-natural-accent/5 rounded-[24px] border border-natural-accent/10">
                            <p className="text-[10px] font-bold text-natural-accent uppercase tracking-widest text-center mb-1">Analyse du Volume</p>
                            <p className="text-xs text-stone-600 dark:text-stone-400 text-center italic">
                              {history.length > 1 
                                ? `Volume moyen de ${(history.reduce((acc, h) => acc + h.exercises.reduce((exAcc, ex) => exAcc + (parseInt(ex.sets) || 0), 0), 0) / history.length).toFixed(1)} séries par séance.`
                                : "Continuez vos séances pour voir votre volume moyen apparaître."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Progression des Poids sur les Exercices Phares */}
                      <div className="bg-natural-ink text-white p-8 md:p-12 rounded-[48px] shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-natural-accent/10 rounded-full blur-[100px] -mr-32 -mt-32" />
                        
                        <div className="relative z-10">
                           <h3 className="text-xl font-serif mb-8 flex items-center gap-3">
                              <LineChartIcon className="w-6 h-6 text-natural-accent" />
                              Evolution des Performances
                           </h3>
                           
                           {history.length < 2 ? (
                             <div className="py-12 text-center opacity-50 italic text-stone-400">
                               Plus de données nécessaires pour afficher la courbe de progression.
                             </div>
                           ) : (
                             <div className="space-y-12">
                               {/* We'll pick a few common exercises to track */}
                               {['Développé Couché', 'Squat', 'Deadlift'].map(exName => {
                                 const logs = history.filter(h => h.exercises?.some(e => e.name.toLowerCase().includes(exName.toLowerCase())))
                                   .map(h => {
                                      const ex = h.exercises.find(e => e.name.toLowerCase().includes(exName.toLowerCase()));
                                      const maxWeight = Math.max(...(ex?.completedWeights?.filter(w => w !== '' && !isNaN(parseFloat(w))).map(w => parseFloat(w)) || [0]));
                                      return { date: h.date?.split(' ')[0] || '', weight: maxWeight };
                                   }).filter(l => l.weight > 0);
                                 
                                 if (logs.length < 2) return null;

                                 return (
                                   <div key={exName} className="space-y-4">
                                      <div className="flex justify-between items-end">
                                         <p className="text-xs font-black uppercase tracking-[0.2em] text-natural-accent">{exName}</p>
                                         <p className="text-2xl font-black tabular-nums">{logs[logs.length-1].weight} kg</p>
                                      </div>
                                      <div className="h-[120px] w-full">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={logs}>
                                               <Line type="stepAfter" dataKey="weight" stroke="#ACE149" strokeWidth={3} dot={{ fill: '#ACE149', r: 3 }} />
                                               <Tooltip contentStyle={{ display: 'none' }} />
                                            </LineChart>
                                         </ResponsiveContainer>
                                      </div>
                                   </div>
                                 );
                               })}
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="w-full text-center py-10 space-y-4">
                    <button 
                      onClick={() => setStep('history')}
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 hover:text-natural-accent transition-colors"
                    >
                      Voir mon historique
                    </button>
                    <p className="text-stone-600 dark:text-stone-400 text-sm flex items-center justify-center gap-2 opacity-60">
                      <span className="font-black uppercase not-italic text-natural-accent tracking-tighter text-2xl drop-shadow-[0_0_8px_rgba(202,255,51,0.3)]">Repz</span>
                      <span className="text-xs">by EL BOUZZAOUI</span>
                    </p>
      </footer>

      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 dark:bg-stone-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-full max-w-md space-y-12">
              <div className="relative">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <Dumbbell className="w-16 h-16 text-natural-accent animate-bounce" />
                    <div className="absolute inset-0 bg-natural-accent/20 blur-2xl rounded-full" />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter italic">
                    Génération du <span className="text-natural-accent">Repz</span>...
                  </h2>
                </div>
              </div>

              <div className="space-y-4">
                <div className="h-2 w-full bg-stone-200 dark:bg-white/5 rounded-full overflow-hidden border border-stone-100 dark:border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${loadingProgress}%` }}
                    className="h-full bg-natural-accent shadow-[0_0_15px_rgba(202,255,51,0.5)]"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-stone-400">
                  <span>Analyse de ton profil</span>
                  <span>{Math.round(loadingProgress)}%</span>
                </div>
              </div>

              <motion.div 
                key={triviaIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-stone-50 dark:bg-white/5 p-8 rounded-[32px] border border-stone-100 dark:border-white/10"
              >
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-natural-accent" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-natural-accent">Le saviez-vous ?</span>
                </div>
                <p className="text-lg md:text-xl font-serif italic text-stone-600 dark:text-stone-300 leading-relaxed">
                  "{triviaFacts[triviaIndex]}"
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
