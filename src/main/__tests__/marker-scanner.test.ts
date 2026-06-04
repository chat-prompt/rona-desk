import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanMarkers, scanHomeRegistry } from "../marker-scanner";

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
    const { skills } = await scanMarkers([root]);
    const tokens = skills.map((f) => f.token).sort();
    expect(tokens).toEqual(["tok-a", "tok-b"]);
    expect(skills.find((f) => f.token === "tok-a")?.title).toBe("skill-a");
  });
  it("같은 토큰 중복 제거", async () => {
    const { skills } = await scanMarkers([root, root]);
    expect(skills.filter((f) => f.token === "tok-a")).toHaveLength(1);
  });
  it("없는 폴더는 status=missing 진단, skills 빈 배열", async () => {
    const ghost = path.join(root, "does-not-exist");
    const { skills, diagnostics } = await scanMarkers([ghost]);
    expect(skills).toEqual([]);
    expect(diagnostics).toEqual([{ root: ghost, matchCount: 0, status: "missing" }]);
  });
  it("루트별 진단 — 파싱 성공 마커수(깨진 JSON 제외)와 status=ok", async () => {
    const { diagnostics } = await scanMarkers([root]);
    expect(diagnostics).toEqual([{ root, matchCount: 2, status: "ok" }]);
  });
});

describe("scanHomeRegistry", () => {
  let regDir: string;

  beforeAll(async () => {
    regDir = await mkdtemp(path.join(tmpdir(), "rona-desk-reg-"));
    await writeFile(
      path.join(regDir, "rona-aaaaaaaa.json"),
      JSON.stringify({ practice_id: "reg-a", student_token: "reg-a", title: "reg-skill-a", installed_at: "x" }),
    );
    await writeFile(
      path.join(regDir, "rona-bbbbbbbb.json"),
      JSON.stringify({ practice_id: "reg-b", student_token: "reg-b", title: "reg-skill-b", installed_at: "x" }),
    );
    await writeFile(path.join(regDir, "rona-cccccccc.json"), "{ broken");
  });

  afterAll(async () => {
    await rm(regDir, { recursive: true, force: true });
  });

  it("flat *.json 마커에서 토큰 추출, 깨진 JSON skip", async () => {
    const found = await scanHomeRegistry(regDir);
    expect(found.map((f) => f.token).sort()).toEqual(["reg-a", "reg-b"]);
    expect(found.find((f) => f.token === "reg-a")?.title).toBe("reg-skill-a");
  });
  it("없는 디렉토리는 조용히 빈 목록", async () => {
    const found = await scanHomeRegistry(path.join(regDir, "nope"));
    expect(found).toEqual([]);
  });
});
