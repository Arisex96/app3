"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);

      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  // Memoize setValue to prevent unnecessary re-renders
  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        // Allow value to be a function so we have same API as useState
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Save state
        setStoredValue(valueToStore);

        // Save to local storage (but we don't store blobs directly)
        if (typeof window !== "undefined") {
          // For gallery storage, store image metadata but not the blobs
          const storageValue = JSON.stringify(valueToStore, (key, value) => {
            // Skip blob serialization
            if (key === "blob") return undefined;
            return value;
          });

          window.localStorage.setItem(key, storageValue);
        }
      } catch (error) {
        console.log(error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}
