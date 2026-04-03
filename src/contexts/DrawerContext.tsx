import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated } from "react-native";

type DrawerContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  progress: Animated.Value;
};

const DrawerContext = createContext<DrawerContextType | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);

  const open = useCallback(() => {
    if (isOpenRef.current) return;
    isOpenRef.current = true;
    setIsOpen(true);
    Animated.timing(progress, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const close = useCallback(() => {
    if (!isOpenRef.current) return;
    isOpenRef.current = false;
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
    });
  }, [progress]);

  const toggle = useCallback(() => {
    if (isOpenRef.current) close();
    else open();
  }, [open, close]);

  return (
    <DrawerContext.Provider value={{ isOpen, open, close, toggle, progress }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error("useDrawer must be used within DrawerProvider");
  return ctx;
}
