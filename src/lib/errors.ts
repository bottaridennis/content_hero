import { toast } from 'sonner';
import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

const FRIENDLY: Record<string, string> = {
  'permission-denied': 'Non hai i permessi per eseguire questa operazione.',
  'unavailable': 'Servizio momentaneamente non raggiungibile. Controlla la connessione.',
  'not-found': 'Elemento non trovato: potrebbe essere stato eliminato.',
  'failed-precondition': 'Operazione non possibile nello stato attuale (indice mancante o dati incoerenti).',
  'resource-exhausted': 'Troppe richieste, riprova tra qualche istante.',
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const code = (error as { code?: string })?.code?.replace('firestore/', '') || '';
  const message = error instanceof Error ? error.message : String(error);
  console.error('Firestore Error:', {
    error: message,
    code,
    operationType,
    path,
    uid: auth.currentUser?.uid,
  });
  toast.error(FRIENDLY[code] || 'Si è verificato un errore', {
    description: FRIENDLY[code] ? undefined : `${operationType} · ${path ?? ''} — ${message}`,
  });
}

export const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Credenziali non valide. Controlla username e password.',
  'auth/wrong-password': 'Password errata.',
  'auth/user-not-found': 'Utente non trovato.',
  'auth/email-already-in-use': 'Questo username è già in uso.',
  'auth/weak-password': 'La password deve avere almeno 6 caratteri.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/network-request-failed': 'Errore di rete. Controlla la connessione.',
  'auth/popup-blocked': 'Il popup è stato bloccato dal browser. Abilitalo per questo sito.',
  'auth/popup-closed-by-user': 'Accesso annullato.',
  'auth/requires-recent-login': 'Per sicurezza, esci e accedi di nuovo prima di continuare.',
};

export const authErrorMessage = (error: unknown) => {
  const code = (error as { code?: string })?.code || '';
  return AUTH_ERRORS[code] || (error instanceof Error ? error.message : 'Errore sconosciuto');
};
