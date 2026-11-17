import { useCallback, useState } from 'react';
import { useApp } from '../../context';
import { acceptTask, submitTask, withdrawSubmission } from '../../lib/actions';
import type { Task } from '../../types';

/** Azioni del player sul task, con stato di caricamento per evitare doppi click. */
export function useTaskActions() {
  const { profile, isSimulating } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const wrap = useCallback(
    (fn: (t: Task, uid: string) => Promise<void>) => async (task: Task) => {
      if (busy) return;
      setBusy(task.id);
      try {
        await fn(task, profile.uid);
      } finally {
        setBusy(null);
      }
    },
    [busy, profile.uid],
  );

  return {
    busy,
    readOnly: isSimulating,
    accept: wrap(acceptTask),
    submit: wrap(submitTask),
    withdraw: wrap(withdrawSubmission),
  };
}
