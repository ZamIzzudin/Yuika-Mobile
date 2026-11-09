// Primitif UI bersama layar remote — konsisten dengan studio
// (card gelap, chip pill, aksen #007cf7). Tanpa emoji di UI.
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { C, R } from "./theme";

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
    <Text
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
    </Text>
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
      <View style={[style, { borderRadius: R.chip, alignSelf: "flex-start", overflow: "hidden" }]}>
        <Text style={text}>{label}</Text>
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[style, { borderRadius: R.chip, overflow: "hidden" }]}
    >
      <Text style={text}>{label}</Text>
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
}: {
  label: string;
  onPress: () => void;
  tone?: "accent" | "dim" | "danger" | "ok";
  small?: boolean;
  disabled?: boolean;
  outline?: boolean;
}) {
  const color = tone === "accent" ? C.accent : tone === "danger" ? C.danger : tone === "ok" ? C.ok : C.dim;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: small ? 12 : 18,
        paddingVertical: small ? 7 : 11,
        backgroundColor: outline ? "transparent" : color,
        borderWidth: outline ? 1 : 0,
        borderColor: color,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        style={{
          color: outline ? color : "#fff",
          fontSize: small ? 12.5 : 14,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
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
      {label ? <Text style={{ color: C.dim, fontSize: 12 }}>{label}</Text> : null}
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
          fontFamily: mono ? "monospace" : undefined,
          minHeight: multiline ? 64 : undefined,
          textAlignVertical: multiline ? "top" : undefined,
        }}
      />
      {hint ? <Text style={{ color: C.faint, fontSize: 11 }}>{hint}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 40, gap: 6, paddingHorizontal: 24 }}>
      <Text style={{ color: C.text, fontSize: 14.5, fontWeight: "600" }}>{title}</Text>
      {body ? (
        <Text style={{ color: C.dim, fontSize: 12.5, textAlign: "center", lineHeight: 18 }}>{body}</Text>
      ) : null}
    </View>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <View
      style={{
        backgroundColor: C.dangerSoft,
        borderColor: "#5c2a2a",
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: C.danger, fontSize: 12.5 }}>{msg}</Text>
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
            <Text style={{ color: C.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={{ color: C.dim, fontSize: 20, lineHeight: 24 }}>×</Text>
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
