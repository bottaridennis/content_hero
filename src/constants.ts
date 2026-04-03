import { Badge, BonusPenalty, TaskDifficulty } from './types';

export const DIFFICULTY_SCORES: Record<TaskDifficulty, number> = {
  'Rame': 10,
  'Bronzo': 25,
  'Argento': 50,
  'Oro': 100,
  'Platino': 250,
};

export const PENALTIES: BonusPenalty[] = [
  { id: 't_delay_1h', label: 'Ritardo +1h', value: -5, category: 'Penalty' },
  { id: 't_delay_2h', label: 'Ritardo +2h', value: -20, category: 'Penalty' },
  { id: 't_delay_final', label: 'Ritardo progetto finale', value: -50, category: 'Penalty' },
  { id: 'f_name_err', label: 'Nome file errato', value: -5, category: 'Penalty' },
  { id: 'f_folder_err', label: 'Cartella errata/HAL9000', value: -30, category: 'Penalty' },
  { id: 'f_export_err', label: 'Mancata esportazione validazione', value: -15, category: 'Penalty' },
  { id: 'c_text_err', label: 'Errori testuali', value: -5, category: 'Penalty' },
  { id: 'c_ortho_err', label: 'Ortografia', value: -15, category: 'Penalty' },
  { id: 'c_story_del', label: 'Cancellazione Storyboard', value: -50, category: 'Penalty' },
  { id: 'c_partial', label: 'Contenuto parziale', value: -30, category: 'Penalty' },
  { id: 'c_icon_err', label: 'Icone non coerenti', value: -5, category: 'Penalty' },
  { id: 'c_graph_err', label: 'Errori grafici', value: -10, category: 'Penalty' },
  { id: 'o_explain_req', label: 'Richiesta spiegazioni già date', value: -50, category: 'Penalty' },
  { id: 'o_unauth_help', label: 'Richiesta aiuto non autorizzata', value: -30, category: 'Penalty' },
  { id: 'o_story_update', label: 'Mancato aggiornamento storyboard/indice', value: -30, category: 'Penalty' },
  { id: 'o_lie', label: 'Mentire sui task', value: -30, category: 'Penalty' },
  { id: 'o_discord', label: 'Discordia nel team', value: -45, category: 'Penalty' },
  { id: 'o_rejection', label: 'Task Respinto', value: -25, category: 'Penalty' },
];

export const BONUSES: BonusPenalty[] = [
  { id: 't_early_1h', label: 'Anticipo -1h', value: 10, category: 'Bonus' },
  { id: 't_early_2h', label: 'Anticipo -2h', value: 20, category: 'Bonus' },
  { id: 't_punctual', label: 'Puntualità esatta', value: 5, category: 'Bonus' },
  { id: 'q_files_15', label: 'File corretti x15 volte', value: 30, category: 'Bonus' },
  { id: 'q_ortho_15', label: 'Nessun errore ortografia x15 volte', value: 15, category: 'Bonus' },
  { id: 'q_find_err', label: 'Individuazione errori altrui', value: 10, category: 'Bonus' },
  { id: 'e_new_proc', label: 'Suggerimento nuove procedure', value: 25, category: 'Bonus' },
  { id: 'e_plat_perf', label: 'Task Platino perfetto', value: 250, category: 'Bonus' },
  { id: 'e_gold_perf', label: 'Task Oro perfetto', value: 50, category: 'Bonus' },
  { id: 'e_silver_perf', label: 'Task Argento perfetto', value: 25, category: 'Bonus' },
  { id: 'e_bronze_perf', label: 'Task Bronzo perfetto', value: 15, category: 'Bonus' },
];

export const BADGES: Badge[] = [
  {
    id: 'b_rookie',
    name: 'Recluta',
    description: 'Completa il tuo primo task.',
    icon: 'Star',
    color: 'text-slate-400',
    requirement: { type: 'tasks_completed', value: 1 }
  },
  {
    id: 'b_veteran',
    name: 'Veterano',
    description: 'Completa 10 task.',
    icon: 'Shield',
    color: 'text-indigo-500',
    requirement: { type: 'tasks_completed', value: 10 }
  },
  {
    id: 'b_master',
    name: 'Maestro',
    description: 'Completa 50 task.',
    icon: 'Crown',
    color: 'text-amber-500',
    requirement: { type: 'tasks_completed', value: 50 }
  },
  {
    id: 'b_gold_hunter',
    name: 'Cacciatore d\'Oro',
    description: 'Completa un task di difficoltà Oro.',
    icon: 'Trophy',
    color: 'text-yellow-500',
    requirement: { type: 'difficulty_completed', value: 1, difficulty: 'Oro' }
  },
  {
    id: 'b_plat_slayer',
    name: 'Sterminatore di Platino',
    description: 'Completa un task di difficoltà Platino.',
    icon: 'Zap',
    color: 'text-cyan-400',
    requirement: { type: 'difficulty_completed', value: 1, difficulty: 'Platino' }
  },
  {
    id: 'b_high_score_500',
    name: 'Pioniere',
    description: 'Raggiungi 500 XP.',
    icon: 'Target',
    color: 'text-emerald-500',
    requirement: { type: 'score', value: 500 }
  },
  {
    id: 'b_high_score_1000',
    name: 'Leggenda',
    description: 'Raggiungi 1000 XP.',
    icon: 'Flame',
    color: 'text-rose-500',
    requirement: { type: 'score', value: 1000 }
  },
  {
    id: 'b_strategist',
    name: 'Stratega',
    description: 'Completa 5 task di difficoltà Argento.',
    icon: 'Target',
    color: 'text-indigo-400',
    requirement: { type: 'difficulty_completed', value: 5, difficulty: 'Argento' }
  },
  {
    id: 'b_infallible',
    name: 'Infallibile',
    description: 'Raggiungi 2500 XP.',
    icon: 'Medal',
    color: 'text-purple-600',
    requirement: { type: 'score', value: 2500 }
  },
  {
    id: 'b_collaborator',
    name: 'Collaboratore',
    description: 'Completa 20 task.',
    icon: 'UserIcon',
    color: 'text-blue-500',
    requirement: { type: 'tasks_completed', value: 20 }
  },
  {
    id: 'b_elite_plat',
    name: 'Elite di Platino',
    description: 'Completa 3 task di difficoltà Platino.',
    icon: 'Crown',
    color: 'text-cyan-600',
    requirement: { type: 'difficulty_completed', value: 3, difficulty: 'Platino' }
  }
];
