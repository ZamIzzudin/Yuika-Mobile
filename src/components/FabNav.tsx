// FAB nav (mockup 2025-11): cluster kanan-bawah — action FAB accent (opsional,
// mis. new chat) + FAB menu (grid -> X morph). Saat terbuka: overlay gelap +
// floating nav card (item icon+label, active accent-soft). Pola dipakai
// ProjectScreen (7 tab) dan SettingsScreen (4 menu).
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "./Icon";
import { C } from "../theme";
import { Txt } from "../ui";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface FabNavItem {
  key: string;
  label: string;
  icon: IconName;
}

export function FabNav({
  items,
  active,
  onPick,
  actionIcon,
  onAction,
}: {
  items: FabNavItem[];
  /** key item aktif (null = landing, tanpa active) */
  active: string | null;
  onPick: (key: string) => void;
  /** FAB action tambahan di atas menu (mis. plus = new chat). */
  actionIcon?: IconName;
  onAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const ovl = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const stagger = useRef(items.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const to = open ? 1 : 0;
    Animated.timing(ovl, { toValue: to, duration: 220, easing: Easing.ease, useNativeDriver: true }).start();
    Animated.timing(card, {
      toValue: to,
      duration: open ? 300 : 220,
      easing: open ? Easing.out(Easing.back(1.4)) : Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();
    stagger.forEach((v, i) => {
      Animated.timing(v, {
        toValue: to,
        duration: 200,
        delay: open ? 40 + i * 32 : 0,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    });
  }, [open, ovl, card, stagger]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* overlay */}
      <AnimatedPressable
        onPress={() => setOpen(false)}
        pointerEvents={open ? "auto" : "none"}
        style={{
          ...StyleSheet.absoluteFill,
          backgroundColor: "rgba(0,0,0,0.55)",
          opacity: ovl,
          zIndex: 55,
          elevation: 55,
        }}
      />

      {/* nav card */}
      <Animated.View
        pointerEvents={open ? "auto" : "none"}
        style={{
          position: "absolute",
          right: 16,
          bottom: insets.bottom + 146,
          width: 228,
          backgroundColor: C.surface,
          borderColor: C.line,
          borderWidth: 1,
          borderRadius: 16,
          padding: 8,
          zIndex: 56,
          elevation: 56,
          opacity: card,
          transform: [
            { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        }}
      >
        {items.map((it, i) => {
          const isActive = it.key === active;
          return (
            <Animated.View key={it.key} style={{ opacity: stagger[i], transform: [{ translateX: stagger[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  onPick(it.key);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  height: 44,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: isActive ? C.accentSoft : "transparent",
                }}
              >
                <Icon name={it.icon} size={20} color={isActive ? C.accent : C.dim} />
                <Txt style={{ color: isActive ? C.accent : C.dim, fontSize: 13.5, fontWeight: "600" }}>{it.label}</Txt>
              </Pressable>
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* FAB cluster */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 16,
          bottom: insets.bottom + 84,
          zIndex: 50,
          elevation: 50,
          alignItems: "flex-end",
          gap: 12,
        }}
      >
        {actionIcon && onAction && !open ? (
          <Pressable
            onPress={onAction}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: 999,
              backgroundColor: C.accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Icon name={actionIcon} size={20} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 999,
            backgroundColor: open ? C.inset : C.surface,
            borderColor: C.line,
            borderWidth: 1,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Icon name={open ? "x" : "grid"} size={20} color={C.text} />
        </Pressable>
      </View>
    </View>
  );
}
