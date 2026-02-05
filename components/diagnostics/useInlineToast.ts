import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";

export function useInlineToast() {
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 140, useNativeDriver: true }).start();
    setMessage(null);
  }, [anim]);

  const show = useCallback(
    (msg: string, ttlMs: number = 1400) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setMessage(msg);
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timeoutRef.current = setTimeout(() => hide(), ttlMs);
    },
    [anim, hide],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { message, anim, show, hide };
}
