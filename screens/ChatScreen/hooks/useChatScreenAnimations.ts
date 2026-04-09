import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export const useChatScreenAnimations = (params: {
  isAiLoading: boolean;
  isStreaming: boolean;
}) => {
  const thinkingOpacity = useRef(new Animated.Value(0)).current;
  const thinkingScale = useRef(new Animated.Value(0.8)).current;
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let animationRef: Animated.CompositeAnimation | null = null;

    if (params.isAiLoading || params.isStreaming) {
      Animated.parallel([
        Animated.timing(thinkingOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(thinkingScale, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      animationRef = Animated.loop(
        Animated.sequence([
          Animated.timing(typingDot1, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(typingDot2, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(typingDot3, {
            toValue: 1,
            duration: 400,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(typingDot1, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot2, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(typingDot3, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      animationRef.start();
    } else {
      Animated.parallel([
        Animated.timing(thinkingOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(thinkingScale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      typingDot1.setValue(0);
      typingDot2.setValue(0);
      typingDot3.setValue(0);
    }

    return () => animationRef?.stop();
  }, [params.isAiLoading, params.isStreaming, thinkingOpacity, thinkingScale, typingDot1, typingDot2, typingDot3]);

  return {
    thinkingOpacity,
    thinkingScale,
    typingDot1,
    typingDot2,
    typingDot3,
    sendButtonScale,
  };
};
