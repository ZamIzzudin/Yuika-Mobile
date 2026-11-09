// Viewer file project: teks mentah (dipotong 64 KB host), nama + ukuran.
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useRemote } from "../remote/RemoteProvider";
import { C } from "../theme";
import { Card, Chip, ErrorBox } from "../ui";

export function FileViewer({ projectId, relPath }: { projectId: string; relPath: string }) {
  const { rs } = useRemote();
  const [file, setFile] = useState<{ content: string; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void rs
      .request<{ ev: "project.file"; content: string; truncated: boolean }>("project.file.read", { projectId, relPath })
      .then((e) => alive && setFile({ content: e.content, truncated: e.truncated }))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [rs, projectId, relPath]);

  const name = relPath.split("/").pop() ?? relPath;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: C.text, fontSize: 15, fontWeight: "700", flex: 1 }} numberOfLines={1}>
          {name}
        </Text>
        {file?.truncated ? <Chip label="truncated" tone="warn" /> : null}
      </View>
      <Text style={{ color: C.faint, fontSize: 11, fontFamily: "monospace" }}>{relPath}</Text>
      {error ? <ErrorBox msg={error} /> : null}
      {file ? (
        <Card style={{ backgroundColor: "#0d0d0d" }}>
          <Text style={{ color: "#d7e3f4", fontSize: 12, lineHeight: 17.5, fontFamily: "monospace" }} selectable>
            {file.content || "(empty file)"}
          </Text>
        </Card>
      ) : !error ? (
        <Text style={{ color: C.faint, fontSize: 12.5 }}>Loading file…</Text>
      ) : null}
      {file?.truncated ? (
        <Text style={{ color: C.dim, fontSize: 11.5 }}>Preview shows the first 64 KB. Open the studio for the full file.</Text>
      ) : null}
    </ScrollView>
  );
}
