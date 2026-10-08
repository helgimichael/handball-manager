'use client';
import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

// UI only, scoped to the mounted career. Back from a profile should restore
// the manager's filters/selection, without writing them into a career save.
type Memory = { values: Record<string, unknown>; set: (key: string, update: (previous: unknown) => unknown) => void };
const Context = createContext<Memory | null>(null);
export function WorkspaceMemory({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const set = useCallback((key: string, update: (previous: unknown) => unknown) => {
    setValues(previous => ({ ...previous, [key]: update(previous[key]) }));
  }, []);
  const memory = useMemo(() => ({ values, set }), [values, set]);
  return <Context.Provider value={memory}>{children}</Context.Provider>;
}
export function useWorkspaceState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const memory = useContext(Context);
  if (!memory) throw new Error('WorkspaceMemory must wrap a career workspace.');
  const value = key in memory.values ? memory.values[key] as T : initial;
  const setValue: Dispatch<SetStateAction<T>> = update => memory.set(key, previous => {
    const current = previous === undefined ? initial : previous as T;
    return typeof update === 'function' ? (update as (value: T) => T)(current) : update;
  });
  return [value, setValue];
}
