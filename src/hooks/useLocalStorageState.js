import { useEffect, useState } from 'react';

export function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const savedValue = window.localStorage.getItem(key);
      return savedValue ? JSON.parse(savedValue) : initialValue;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
}
