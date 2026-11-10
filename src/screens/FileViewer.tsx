// Viewer file project: teks mentah (dipotong 64 KB host), nama + ukuran.
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { useRemote } from "../remote/RemoteProvider";
import { C } from "../theme";
import { Card, Chip, Txt, useToast } from "../ui";

export function FileViewer({ projectId, relPath }: { projectId: string; relPath: string }) {
  const { rs } = useRemote();
  const toast = useToast();
  const [file, setFile] = useState<{ content: string; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void rs
      .request<{ ev: "project.file"; content: string; truncated: boolean }>("project.file.read", { projectId, relPath })
      .then((e) => alive && setFile({ content: e.content, truncated: e.truncated }))
      .catch((e: Error) => {
        if (alive) {
          setError(e.message);
          toast(e.message, "danger");
        }
      });
    return () => {
      alive = false;
    };
  }, [rs, projectId, relPath]);

  const name = relPath.split("/").pop() ?? relPath;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt style={{ color: C.text, fontSize: 15, fontWeight: "700", flex: 1 }} numberOfLines={1}>
          {name}
        </Txt>
        {file?.truncated ? <Chip label="truncated" tone="warn" /> : null}
      </View>
      <Txt style={{ color: C.faint, fontSize: 11, fontFamily: "monospace" }}>{relPath}</Txt>
      {file ? (
        <Card style={{ backgroundColor: "#0d0d0d" }}>
          <Txt style={{ color: "#d7e3f4", fontSize: 12, lineHeight: 17.5, fontFamily: "monospace" }} selectable>
            {file.content || "(empty file)"}
          </Txt>
        </Card>
      ) : !error ? (
        <Txt style={{ color: C.faint, fontSize: 12.5 }}>Loading file…</Txt>
      ) : null}
      {file?.truncated ? (
        <Txt style={{ color: C.dim, fontSize: 11.5 }}>Preview shows the first 64 KB. Open the studio for the full file.</Txt>
      ) : null}
    </ScrollView>
  );
}
