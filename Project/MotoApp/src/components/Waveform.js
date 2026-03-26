import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { C } from '../constants/colors';

export default function Waveform({ active }) {
  const bars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.2))).current;

  useEffect(() => {
    const loops = bars.map((bar, idx) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(idx * 60),
          Animated.timing(bar, { toValue: active ? 1 : 0.2, duration: 220, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.2, duration: 220, useNativeDriver: true }),
        ]),
      ),
    );

    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [active, bars]);

  return (
    <View style={styles.row}>
      {bars.map((bar, i) => (
        <Animated.View
          key={String(i)}
          style={[
            styles.bar,
            {
              transform: [
                {
                  scaleY: bar.interpolate({
                    inputRange: [0.2, 1],
                    outputRange: [0.4, 1.2],
                  }),
                },
              ],
              opacity: active ? 1 : 0.35,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
  },
  bar: {
    width: 5,
    height: 18,
    borderRadius: 2,
    backgroundColor: C.primary,
  },
});
