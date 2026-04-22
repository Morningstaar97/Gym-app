/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
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
  Sun,
  Moon
} from 'lucide-react';

type Goal = 'perdrePoids' | 'prendreMuscle' | 'gagnerForce';
type Intensity = 'faible' | 'modérée' | 'élevée';
type Experience = 'débutant' | 'intermédiaire' | 'avancé' | 'professionnel';
type Equipment = 'maison' | 'typique' | 'professionnel';
type Gender = 'homme' | 'femme';

interface UserData {
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
  googleImageUrl: string; // Nouveau: lien image
}

interface WorkoutPlan {
  id: string; // Nouveau: unique ID
  date: string; // Nouveau: date de création
  title: string;
  description: string;
  exercises: Exercise[];
  warmup: string[];
  cooldown: string[];
  params: UserData; // Nouveau: paramètres utilisés
}

const MUSCLE_GROUPS = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 
  'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Abdos'
];

export default function App() {
  const [step, setStep] = useState<'info' | 'workout' | 'history'>('info'); // Nouveau: étape historique
  const [loading, setLoading] = useState(false);
  const [workout, setWorkout] = useState<WorkoutPlan | null>(null);
  const [history, setHistory] = useState<WorkoutPlan[]>(() => {
    const saved = localStorage.getItem('fitfocus_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('fitfocus_darkmode');
    return saved === 'true';
  });
  
  // Appliquer le mode sombre
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('fitfocus_darkmode', darkMode.toString());
  }, [darkMode]);
  
  // Charger le profil depuis le localStorage
  const [profile, setProfile] = useState<{
    age: string;
    gender: Gender;
    experience: Experience;
    equipment: Equipment;
    goal: Goal;
    focus: string;
  } | null>(() => {
    const saved = localStorage.getItem('fitfocus_profile');
    return saved ? JSON.parse(saved) : null;
  });

  const [formData, setFormData] = useState<UserData>({
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
      localStorage.setItem('fitfocus_profile', JSON.stringify(profile));
    }
  }, [profile]);

  // Sauvegarder l'historique quand il change
  useEffect(() => {
    localStorage.setItem('fitfocus_history', JSON.stringify(history));
  }, [history]);

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

  const generateWorkout = async () => {
    // Si le profil n'est pas complet, on le sauvegarde d'abord
    if (!profile || showProfileEdit) {
      if (!formData.age || !formData.gender) {
        setError('Veuillez compléter votre profil.');
        return;
      }
      const newProfile = {
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
      const prompt = `
        Tu es un coach de fitness professionnel. Génère un plan d'entraînement équilibré basé sur les infos suivantes :
        - Âge : ${formData.age}
        - Genre : ${formData.gender}
        - Niveau : ${formData.experience}
        - Équipement : ${formData.equipment === 'maison' ? 'Sans équipement' : formData.equipment === 'typique' ? 'Salle standard' : 'Salle pro avancée'}
        - Muscles cibles : ${formData.targetMuscles.length > 0 ? formData.targetMuscles.join(', ') : 'Corps complet'}
        - Focus général : ${formData.focus}
        - Durée : ${formData.duration} minutes
        - Intensité : ${formData.intensity}
        - Objectif : ${formData.goal}

        Exigences :
        1. Les exercices DOIVENT être adaptés au niveau : ${formData.experience} et au genre : ${formData.gender}.
        2. Ils doivent être réalisables avec l'équipement : ${formData.equipment}.
        3. Pour chaque exercice, inclus la technique parfaite ("form") et des modifications pour différents niveaux ("modifications").
        4. Pour chaque exercice, fournis deux liens :
           - "youtubeUrl": un lien de recherche YouTube (ex: https://www.youtube.com/results?search_query=bench+press+form)
           - "googleImageUrl": un lien de recherche Google Images (ex: https://www.google.com/search?tbm=isch&q=bench+press+exercise+demonstration)
        5. RÉPONDS UNIQUEMENT EN FRANÇAIS.

        Structure JSON attendue :
        {
          "title": "Titre accrocheur",
          "description": "Aperçu court",
          "warmup": ["étape 1", "étape 2"],
          "exercises": [{
            "name": "Nom de l'exercice", 
            "sets": "nombre", 
            "reps": "répétitions", 
            "notes": "astuce courte",
            "form": "Explication de la forme correcte",
            "modifications": "Adaptations selon le niveau",
            "youtubeUrl": "lien youtube",
            "googleImageUrl": "lien google images"
          }],
          "cooldown": ["étape 1", "étape 2"]
        }
        Réponds UNIQUEMENT avec le JSON.
      `;

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la communication avec le serveur.');
      }

      const data = await res.json();
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
      setError('Erreur lors de la génération. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const finishSession = () => {
    if (workout) {
      setHistory(prev => [workout, ...prev]);
    }
    reset();
  };

  const reset = () => {
    setStep('info');
    setWorkout(null);
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(w => w.id !== id));
  };

  return (
    <div className="min-h-screen bg-natural-bg text-natural-ink font-sans selection:bg-natural-highlight flex flex-col transition-colors duration-300">
      {/* Salutation du haut */}
      <div className="w-full text-center py-4 bg-white/30 backdrop-blur-sm border-b border-stone-100 dark:bg-black/10 dark:border-white/5 flex items-center justify-between px-6">
        <div className="flex-1" />
        <span className="text-xl font-serif text-natural-accent/60 italic tracking-widest">بالصحة و الراحة</span>
        <div className="flex-1 flex justify-end">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-white/5 transition-all text-stone-600 dark:text-stone-400"
            title={darkMode ? "Mode Jour" : "Mode Nuit"}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 flex-grow">
        <AnimatePresence mode="wait">
          {step === 'info' && (
            <motion.div
              key="info-form"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-natural-subtle rounded-[40px] shadow-2xl shadow-stone-200/50 dark:shadow-black/20 overflow-hidden flex flex-col transition-colors duration-300"
            >
              <div className="p-8 md:p-12 pb-0">
                <header className="mb-10 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h1 className="text-4xl font-serif font-medium text-natural-accent mb-3 tracking-tight">
                      {(!profile || showProfileEdit) ? "Votre Profil" : "Ma Séance"}
                    </h1>
                    <p className="text-stone-500 max-w-xl">
                      {(!profile || showProfileEdit) 
                        ? "Configurez vos informations de base une seule fois." 
                        : "Prêt pour votre entraînement du jour ?"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {profile && !showProfileEdit && (
                      <button 
                        onClick={() => setShowProfileEdit(true)}
                        className="group flex items-center gap-2 px-4 py-2 bg-stone-50 dark:bg-white/5 rounded-full border border-stone-100 dark:border-white/5 hover:border-natural-accent transition-all"
                      >
                        <Zap className="w-4 h-4 text-stone-400 group-hover:text-natural-accent" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Profil</span>
                      </button>
                    )}
                    {history.length > 0 && (
                      <button 
                        onClick={() => setStep('history')}
                        className="group flex items-center gap-2 px-4 py-2 bg-natural-subtle rounded-full border border-stone-100 hover:border-natural-accent transition-all"
                      >
                        <History className="w-4 h-4 text-stone-400 group-hover:text-natural-accent" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Historique ({history.length})</span>
                      </button>
                    )}
                  </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
                  {/* Si Profile non complet ou Edition : Afficher tout */}
                  {(!profile || showProfileEdit) ? (
                    <>
                      {/* Colonne Gauche (Profil) */}
                      <div className="space-y-10">
                        <section>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4">Profil</label>
                          <div className="flex flex-wrap gap-4">
                            <div className="flex-1 min-w-[80px] group">
                              <input
                                type="number"
                                name="age"
                                value={formData.age}
                                onChange={handleInputChange}
                                placeholder="Âge"
                                className="w-full bg-natural-subtle border-b-2 border-stone-100 px-3 py-4 focus:border-natural-accent outline-none transition-all placeholder:text-stone-300"
                              />
                            </div>
                            <div className="w-full flex bg-stone-50 p-1 rounded-2xl gap-1">
                              {(['homme', 'femme'] as const).map((g) => (
                                <button
                                  key={g}
                                  onClick={() => setFormData(prev => ({ ...prev, gender: g }))}
                                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                                    formData.gender === g 
                                      ? 'bg-white text-natural-accent shadow-sm' 
                                      : 'text-stone-400 hover:text-stone-600'
                                  }`}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </div>
                        </section>

                        <section>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4">Environnement</label>
                          <div className="grid grid-cols-1 gap-2">
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
                                  ? 'border-natural-accent bg-natural-subtle' 
                                  : 'border-stone-50 hover:bg-natural-subtle/50'
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
                          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4">Niveau</label>
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
                                <div className="text-center py-4 rounded-3xl border border-stone-50 dark:border-white/5 bg-stone-50/50 dark:bg-white/5 peer-checked:bg-natural-highlight peer-checked:border-natural-accent peer-checked:text-natural-accent transition-all text-[10px] font-bold uppercase tracking-widest leading-none">
                                  {lvl}
                                </div>
                              </label>
                            ))}
                          </div>
                        </section>

                        <section>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4">Objectif Global</label>
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
                          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4">Groupes Musculaires</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {MUSCLE_GROUPS.map((muscle) => (
                              <button
                                key={muscle}
                                onClick={() => toggleMuscle(muscle)}
                                className={`py-2 px-1 text-[10px] font-bold uppercase tracking-tight rounded-xl border transition-all ${
                                  formData.targetMuscles.includes(muscle)
                                  ? 'bg-natural-accent border-natural-accent text-white' 
                                  : 'border-stone-100 text-stone-400 hover:border-natural-accent'
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
                          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-4">Durée & Intensité</label>
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
                                  className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
                                    formData.intensity === level 
                                      ? 'bg-white dark:bg-natural-accent text-natural-accent dark:text-white shadow-sm' 
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
              <div className="mt-12 bg-natural-accent p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-white/70 text-xs text-center md:text-left tracking-wide leading-relaxed">
                  <p>
                    {(!profile || showProfileEdit) 
                      ? "Le profil utilisateur sera mémorisé pour vos prochaines visites." 
                      : `Programme pour ${profile.gender} (${profile.age} ans) • ${profile.experience}`}
                  </p>
                </div>
                <button
                  onClick={generateWorkout}
                  disabled={loading}
                  className="w-full md:w-auto bg-white text-natural-accent px-12 py-5 rounded-full font-bold shadow-xl hover:bg-stone-50 transition-all active:scale-95 uppercase tracking-[0.25em] text-[10px] flex items-center justify-center gap-3 disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    (!profile || showProfileEdit) ? "Valider mon profil" : "Bâtir mon programme"
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'workout' && workout && (
            <motion.div
              key="workout-display"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[40px] shadow-2xl shadow-stone-200/50 overflow-hidden"
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
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h2 className="text-4xl font-serif font-medium text-natural-accent tracking-tight">{workout?.title}</h2>
                    <div className="inline-flex items-center gap-2 bg-natural-highlight text-natural-accent px-4 py-1.5 rounded-full shadow-sm">
                      <Zap className="w-4 h-4 fill-current" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{formData.intensity}</span>
                    </div>
                  </div>
                  <p className="text-stone-500 text-lg leading-relaxed font-serif italic italic-small">"{workout?.description}"</p>
                </header>

                <div className="grid grid-cols-2 gap-6 mb-12">
                  <div className="bg-natural-subtle dark:bg-white/5 p-6 rounded-[30px] border border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-stone-400 mb-2">
                      <Clock className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Durée</span>
                    </div>
                    <p className="text-xl font-bold">{formData.duration} <span className="text-sm font-medium text-stone-400">min</span></p>
                  </div>
                  <div className="bg-natural-subtle dark:bg-white/5 p-6 rounded-[30px] border border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-stone-400 mb-2">
                      <Target className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Cibles</span>
                    </div>
                    <p className="text-xl font-bold truncate">{formData.targetMuscles.join(', ') || 'Corps complet'}</p>
                  </div>
                </div>

                <div className="space-y-16">
                  {/* Échauffement & Retour au calme simplifiés comme précédemment, focus sur les détails d'exercices */}
                  <section>
                    <div className="flex items-center gap-4 mb-10">
                      <div className="h-px bg-stone-100 flex-grow" />
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-stone-400 shrink-0">Exercices & Technique</h3>
                      <div className="h-px bg-stone-100 flex-grow" />
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
                          <div className="p-6 md:p-8">
                            <div className="flex flex-col gap-6">
                              {/* Header: Titre et Actions */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <h4 className="font-serif font-medium text-2xl text-natural-ink leading-tight flex-grow max-w-full sm:max-w-[60%]">
                                  {ex.name}
                                </h4>
                                
                                <div className="flex flex-wrap items-center gap-3 shrink-0">
                                  {/* Dock Vidéo/Image */}
                                  <div className="flex bg-natural-subtle dark:bg-white/5 p-1 rounded-xl border border-stone-100 dark:border-white/5 gap-1 shadow-sm">
                                    {ex.youtubeUrl && (
                                      <a 
                                        href={ex.youtubeUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-natural-subtle text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-stone-50 dark:border-white/5"
                                        title="Vidéo"
                                      >
                                        <Youtube className="w-4 h-4" />
                                      </a>
                                    )}
                                    {ex.googleImageUrl && (
                                      <a 
                                        href={ex.googleImageUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-natural-subtle text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-stone-50 dark:border-white/5"
                                        title="Images"
                                      >
                                        <ImageIcon className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>

                                  {/* Badges de stats - Harmonisation de la largeur */}
                                  <div className="flex gap-2">
                                    <div className="bg-natural-highlight/30 dark:bg-natural-highlight/5 px-3 py-1.5 rounded-xl text-center min-w-[64px] border border-natural-accent/10 dark:border-white/5 shadow-sm">
                                      <span className="block text-[7px] font-bold uppercase tracking-tighter text-stone-400 dark:text-stone-500 mb-0.5">Séries</span>
                                      <span className="font-bold text-natural-accent dark:text-natural-highlight text-sm leading-none">{ex.sets}</span>
                                    </div>
                                    <div className="bg-natural-highlight/30 dark:bg-natural-highlight/5 px-3 py-1.5 rounded-xl text-center min-w-[64px] border border-natural-accent/10 dark:border-white/5 shadow-sm">
                                      <span className="block text-[7px] font-bold uppercase tracking-tighter text-stone-400 dark:text-stone-500 mb-0.5">Reps</span>
                                      <span className="font-bold text-natural-accent dark:text-natural-highlight text-sm leading-none">{ex.reps}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Détails Techniques */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Technique & Forme</label>
                                  <p className="text-sm text-stone-600 leading-relaxed font-serif italic text-balance">{ex.form}</p>
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Adaptation ({formData.experience})</label>
                                  <p className="text-sm text-natural-accent/80 leading-relaxed">{ex.modifications}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="bg-natural-subtle px-8 py-3 flex items-center gap-2 border-t border-stone-100">
                            <Flame className="w-3 h-3 text-orange-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Conseil : {ex.notes}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="mt-20 flex flex-col items-center">
                  <button 
                    onClick={finishSession}
                    className="bg-natural-accent text-white px-16 py-6 rounded-full font-bold shadow-2xl hover:bg-zinc-800 transition-all active:scale-95 uppercase tracking-[0.3em] text-[10px] mb-4"
                  >
                    Séance Terminée
                  </button>
                  <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest">Enregistrer & Quitter</p>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'history' && (
            <motion.div
              key="history-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-natural-subtle rounded-[40px] shadow-2xl shadow-stone-200/50 dark:shadow-black/20 overflow-hidden transition-colors duration-300"
            >
              <div className="p-8 md:p-12 text-center md:text-left">
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 text-stone-400 hover:text-natural-accent transition-colors mb-8 group mx-auto md:mx-0"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-xs font-bold uppercase tracking-widest">Retour</span>
                </button>

                <header className="mb-12 border-b border-stone-100 pb-10">
                  <h2 className="text-4xl font-serif font-medium text-natural-accent tracking-tight mb-2">Historique des Séances</h2>
                  <p className="text-stone-400 text-sm">Retrouvez toutes vos performances passées en un clin d'œil.</p>
                </header>

                <div className="space-y-4">
                  {history.length === 0 ? (
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
                        className="group flex flex-col md:flex-row md:items-center justify-between p-6 bg-natural-subtle hover:bg-white border border-transparent hover:border-natural-accent rounded-[32px] transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-stone-200/40"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-3 mb-2">
                             <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{h.date}</span>
                             <div className="w-1 h-1 rounded-full bg-stone-200" />
                             <span className="text-[10px] font-bold text-natural-accent uppercase tracking-widest">{h.params.goal}</span>
                          </div>
                          <h4 className="text-xl font-serif font-medium text-natural-ink">{h.title}</h4>
                          <p className="text-xs text-stone-400 mt-1 truncate max-w-md">{h.params.targetMuscles.join(', ') || 'Corps complet'}</p>
                        </div>
                        <div className="flex items-center gap-4 mt-4 md:mt-0 justify-between md:justify-end">
                          <div className="flex -space-x-2">
                             <div className="px-3 py-1 bg-white dark:bg-natural-accent/20 border border-stone-100 dark:border-white/5 rounded-lg text-[8px] font-bold uppercase tracking-tighter text-stone-400 dark:text-stone-300 shadow-sm z-10 uppercase">
                               {h.params.intensity}
                             </div>
                             <div className="px-3 py-1 bg-white dark:bg-natural-accent/20 border border-stone-100 dark:border-white/5 rounded-lg text-[8px] font-bold uppercase tracking-tighter text-stone-400 dark:text-stone-300 shadow-sm">
                               {h.params.duration} min
                             </div>
                          </div>
                          <button 
                            onClick={(e) => deleteFromHistory(h.id, e)}
                            className="p-2 text-stone-300 hover:text-red-400 transition-colors"
                          >
                            <Target className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <footer className="w-full text-center py-10 opacity-40">
        <p className="font-serif italic text-sm tracking-widest">
          powered by <span className="font-bold uppercase not-italic text-natural-accent">EL BOUZZAOUI</span>
        </p>
      </footer>
    </div>
  );
}
