// 로컬 `.rona-skill.json` 마커 스캔 → install_token 발견.
// 두 소스: (1) 사용자 지정 scanRoots(작업 폴더, 2단계 깊이) — 옆에 rona-progress.html 동반 가능.
//          (2) 홈 레지스트리 ~/.rona/installed (flat) — install 명령이 토큰을 고정 경로로 복제 → $PWD·TCC·깊이 무관.
// 마커 형태(install route 실측): { practice_id: token, student_token: token, title: slug, installed_at }
import { glob } from "glob";
import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RootDiagnostic } from "../shared/types";

export interface DiscoveredSkill {
  token: string;
  title: string;
  markerPath: string;
}

export interface ScanResult {
  skills: DiscoveredSkill[];
  /** scanRoots 별 진단(매치수·접근성). union 후에도 "어느 폴더가 비었나/막혔나" 가시화용. */
  diagnostics: RootDiagnostic[];
}

interface RonaMarker {
  practice_id?: string;
  student_token?: string;
  title?: string;
}

/** 마커 파일 1개 파싱 → DiscoveredSkill. 깨진 JSON·토큰 누락이면 null. */
async function parseMarker(markerPath: string): Promise<DiscoveredSkill | null> {
  try {
    const raw = await readFile(markerPath, "utf8");
    const marker = JSON.parse(raw) as RonaMarker;
    const token = marker.practice_id ?? marker.student_token;
    if (!token) return null;
    return { token, title: marker.title ?? "rona-skill", markerPath };
  } catch {
    return null; // 깨진 JSON/읽기 실패 → skip
  }
}

/**
 * 사용자 지정 루트(작업 폴더) 스캔 + 루트별 진단.
 * glob 은 TCC/권한 거부 시 throw 없이 빈 결과를 주므로(루트 자체 차단), access 로 사전 판정해
 * denied/missing 을 구분한다 — "추가했는데 0건" 과 "권한 거부" 가 같은 빈 결과로 뭉개지지 않게.
 */
export async function scanMarkers(roots: string[]): Promise<ScanResult> {
  const byToken = new Map<string, DiscoveredSkill>();
  const diagnostics: RootDiagnostic[] = [];

  for (const root of roots) {
    try {
      await access(root, fsConstants.R_OK);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      diagnostics.push({ root, matchCount: 0, status: code === "ENOENT" ? "missing" : "denied" });
      continue;
    }

    let matches: string[];
    try {
      matches = await glob("**/.rona-skill.json", {
        cwd: root,
        absolute: true,
        dot: true,
        maxDepth: 3,
        ignore: ["**/node_modules/**", "**/.git/**"],
      });
    } catch {
      diagnostics.push({ root, matchCount: 0, status: "denied" });
      continue;
    }

    let matchCount = 0;
    for (const markerPath of matches) {
      const skill = await parseMarker(markerPath);
      if (skill) {
        byToken.set(skill.token, skill);
        matchCount++;
      }
    }
    diagnostics.push({ root, matchCount, status: "ok" });
  }

  return { skills: [...byToken.values()], diagnostics };
}

/**
 * 홈 레지스트리 ~/.rona/installed/*.json 스캔 (flat, 1단계).
 * install 명령이 마커를 이 고정 경로에도 복제하므로, scanRoots 가 비어 있어도 토큰을 발견한다.
 * 홈 하위라 macOS TCC 권한 prompt 무관, 깊이 함정도 없음.
 * regDir 인자는 테스트 주입용 — 프로덕션은 os.homedir() 기준 기본값.
 */
export async function scanHomeRegistry(
  regDir: string = path.join(os.homedir(), ".rona", "installed"),
): Promise<DiscoveredSkill[]> {
  let matches: string[];
  try {
    matches = await glob("*.json", { cwd: regDir, absolute: true, maxDepth: 1 });
  } catch {
    return []; // 디렉토리 없음/권한 → 조용히 빈 목록
  }

  const byToken = new Map<string, DiscoveredSkill>();
  for (const markerPath of matches) {
    const skill = await parseMarker(markerPath);
    if (skill) byToken.set(skill.token, skill);
  }
  return [...byToken.values()];
}
