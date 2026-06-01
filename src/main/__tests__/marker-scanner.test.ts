import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanMarkers } from "../marker-scanner";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "rona-desk-scan-"));
  const a = path.join(root, "projA");
  await mkdir(a, { recursive: true });
  await writeFile(
    path.join(a, ".rona-skill.json"),
    JSON.stringify({ practice_id: "tok-a", student_token: "tok-a", title: "skill-a", installed_at: "x" }),
  );
  const b = path.join(root, "projB");
  await mkdir(b, { recursive: true });
  await writeFile(path.join(b, ".rona-skill.json"), JSON.stringify({ practice_id: "tok-b", title: "skill-b" }));
  const c = path.join(root, "projC");
  await mkdir(c, { recursive: true });
  await writeFile(path.join(c, ".rona-skill.json"), "{ broken json");
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("scanMarkers", () => {
  it("마커에서 install_token 추출, 깨진 JSON skip", async () => {
    const found = await scanMarkers([root]);
    const tokens = found.map((f) => f.token).sort();
    expect(tokens).toEqual(["tok-a", "tok-b"]);
    expect(found.find((f) => f.token === "tok-a")?.title).toBe("skill-a");
  });
  it("같은 토큰 중복 제거", async () => {
    const found = await scanMarkers([root, root]);
    expect(found.filter((f) => f.token === "tok-a")).toHaveLength(1);
  });
  it("없는 폴더는 조용히 skip", async () => {
    const found = await scanMarkers([path.join(root, "does-not-exist")]);
    expect(found).toEqual([]);
  });
});
