import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function TransportBanner({ state }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, bounciness: 8, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, state]);

  return (
    <Animated.View style={[styles.box, { opacity, transform: [{ translateY }] }]}>
      <Text style={styles.txt}>Transport: {state}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: C.surfaceAlt,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  txt: {
    color: C.textSub,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
