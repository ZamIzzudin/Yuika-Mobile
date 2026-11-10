// Primitif UI bersama layar remote — konsisten dengan studio (card gelap,
// chip pill, aksen #007cf7) + mockup 2025-11: font Nunito, icon SVG Lucide,
// toast floating untuk error. Tanpa emoji di UI.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextProps,
  View,
} from "react-native";

import { Icon, type IconName } from "./components/Icon";
import { C, F, R } from "./theme";

/** Text dengan font Nunito otomatis per fontWeight (fontWeight -> file font).
 *  Pakai ini, bukan Text, agar semua teks konsisten mockup. */
export function Txt({ style, children, ...rest }: TextProps) {
  const st = StyleSheet.flatten(style) || {};
  let fam = (st as { fontFamily?: string }).fontFamily;
  if (!fam || fam === "System" || fam === "sans-serif") {
    const w = (st as { fontWeight?: string | number }).fontWeight;
    fam = F[w != null ? String(w) : "400"] ?? F["400"];
  }
  return (
    <Text {...rest} style={[style, { fontFamily: fam }]}>
      {children}
    </Text>
  );
}

// ── Toast (floating, menggantikan ErrorBox inline) ──────────────────────

interface ToastApi {
  (msg: string, tone?: "dim" | "danger" | "ok"): void;
}

const ToastCtx = createContext<ToastApi>(() => undefined);

/** `const toast = useToast()` — tampilkan pesan floating di bawah (auto-hide). */
export function useToast(): ToastApi {
  return useContext(ToastCtx);
}

interface ToastItem {
  id: number;
  msg: string;
  tone: "dim" | "danger" | "ok";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback<ToastApi>((msg, tone = "dim") => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-1), { id, msg, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3400);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {items.map((t) => (
        <ToastView key={t.id} msg={t.msg} tone={t.tone} />
      ))}
    </ToastCtx.Provider>
  );
}

function ToastView({ msg, tone }: { msg: string; tone: "dim" | "danger" | "ok" }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [a]);
  const icon: IconName = tone === "danger" ? "triangle" : tone === "ok" ? "check-c" : "info";
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 44, zIndex: 60, elevation: 60 }} pointerEvents="none">
      <Animated.View
        style={{
          marginHorizontal: 16,
          opacity: a,
          transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            backgroundColor: tone === "danger" ? C.dangerSoft : "#1d1d1d",
            borderColor: tone === "danger" ? "#5c2a2a" : C.line,
          }}
        >
          <Icon name={icon} size={18} color={tone === "danger" ? C.danger : tone === "ok" ? C.ok : C.dim} />
          <Txt style={{ color: tone === "danger" ? "#ffb4b4" : C.text, fontSize: 13, flex: 1 }}>{msg}</Txt>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Primitif ────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: C.surface,
          borderColor: C.line,
          borderWidth: 1,
          borderRadius: R.card,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Txt
      style={{
        color: C.dim,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        marginBottom: 8,
        marginTop: 6,
      }}
    >
      {children}
    </Txt>
  );
}

export function Chip({
  label,
  tone = "dim",
  solid = false,
  onPress,
  active = false,
}: {
  label: string;
  tone?: "dim" | "accent" | "ok" | "warn" | "danger";
  solid?: boolean;
  onPress?: () => void;
  active?: boolean;
}) {
  const color = tone === "accent" ? C.accent : tone === "ok" ? C.ok : tone === "warn" ? C.warn : tone === "danger" ? C.danger : C.dim;
  const style: object = solid
    ? { backgroundColor: color, paddingHorizontal: 10, paddingVertical: 4 }
    : { borderColor: active ? color : C.line, borderWidth: 1, backgroundColor: active ? C.accentSoft : "transparent", paddingHorizontal: 10, paddingVertical: 4 };
  const text = { color: solid ? "#fff" : color, fontSize: 11.5, fontWeight: "600" as const };
  if (!onPress)
    return (
      <View style={[style, { borderRadius: R.chip, alignSelf: "center", overflow: "hidden" }]}>
        <Txt style={text}>{label}</Txt>
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[style, { borderRadius: R.chip, overflow: "hidden" }]}
    >
      <Txt style={text}>{label}</Txt>
    </Pressable>
  );
}

export function Btn({
  label,
  onPress,
  tone = "accent",
  small = false,
  disabled = false,
  outline = false,
  icon,
}: {
  label?: string;
  onPress: () => void;
  tone?: "accent" | "dim" | "danger" | "ok";
  small?: boolean;
  disabled?: boolean;
  outline?: boolean;
  /** Icon-only button (mockup: Run -> send icon): beri icon tanpa label. */
  icon?: IconName;
}) {
  const color = tone === "accent" ? C.accent : tone === "danger" ? C.danger : tone === "ok" ? C.ok : C.dim;
  const iconOnly = icon != null && label == null;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: iconOnly ? 8 : small ? 12 : 18,
        paddingVertical: iconOnly ? 8 : small ? 7 : 11,
        backgroundColor: outline ? "transparent" : color,
        borderWidth: outline ? 1 : 0,
        borderColor: color,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {icon ? (
        <Icon name={icon} size={18} color={outline ? color : "#fff"} />
      ) : (
        <Txt style={{ color: outline ? color : "#fff", fontSize: small ? 12.5 : 14, fontWeight: "700" }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  mono = false,
  secure = false,
  multiline = false,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  secure?: boolean;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      {label ? <Txt style={{ color: C.dim, fontSize: 12 }}>{label}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.faint}
        secureTextEntry={secure}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        style={{
          color: C.text,
          backgroundColor: C.inset,
          borderColor: C.line,
          borderWidth: 1,
          borderRadius: R.input,
          paddingHorizontal: 11,
          paddingVertical: multiline ? 8 : 9,
          fontSize: mono ? 12.5 : 14,
          fontFamily: mono ? "monospace" : F["400"],
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? "top" : undefined,
        }}
      />
      {hint ? <Txt style={{ color: C.faint, fontSize: 11 }}>{hint}</Txt> : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, gap: 6, paddingHorizontal: 24 }}>
      <Txt style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }}>{title}</Txt>
      {body ? (
        <Txt style={{ color: C.dim, fontSize: 12.5, textAlign: "center", lineHeight: 18 }}>{body}</Txt>
      ) : null}
    </View>
  );
}

/** Bottom sheet modal sederhana (pilih persona, konfirmasi reset, dll). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: C.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderColor: C.line,
            borderTopWidth: 1,
            maxHeight: "78%",
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomColor: C.line,
              borderBottomWidth: 1,
            }}
          >
            <Txt style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>{title}</Txt>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={18} color={C.dim} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Row({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={style}>
      {children}
    </Pressable>
  );
}
