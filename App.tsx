import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

// Placeholder shell. The mobile app will onboard into a Yuika studio
// instance and pair with the central portal (linked devices); until that
// flow lands, this screen only states the intent.
export default function App() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Text style={styles.wordmark}>YUIKA</Text>
      <Text style={styles.tagline}>Studio Persona for Agentic AI</Text>
      <View style={styles.chip}>
        <Text style={styles.chipText}>Mobile shell under development</Text>
      </View>
      <Text style={styles.footnote}>
        Device pairing with the Yuika portal arrives with linked-device
        support.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  wordmark: {
    color: "#f5f5f5",
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 8,
  },
  tagline: {
    color: "#9e9e9e",
    fontSize: 14,
  },
  chip: {
    marginTop: 24,
    backgroundColor: "#212121",
    borderColor: "#007cf7",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    color: "#007cf7",
    fontSize: 13,
  },
  footnote: {
    marginTop: 8,
    color: "#616161",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 280,
  },
});
