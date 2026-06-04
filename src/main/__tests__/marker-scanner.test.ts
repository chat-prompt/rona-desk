import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scanHomeRegistry } from "../marker-scanner";

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
  it("같은 토큰 중복 제거 (practice_id 우선)", async () => {
    const found = await scanHomeRegistry(regDir);
    expect(found.filter((f) => f.token === "reg-a")).toHaveLength(1);
  });
  it("없는 디렉토리는 조용히 빈 목록", async () => {
    const found = await scanHomeRegistry(path.join(regDir, "nope"));
    expect(found).toEqual([]);
  });
});
