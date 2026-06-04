// 홈 레지스트리(~/.rona/installed) 단일 발견 소스.
// install 명령이 마커를 이 고정 경로에 복제하므로, 폴더/토큰 수동 등록 없이 자동 발견된다.
// 마커 형태(install route 실측): { practice_id: token, student_token: token, title: slug, installed_at }
import { glob } from "glob";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface DiscoveredSkill {
  token: string;
  title: string;
  markerPath: string;
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
 * 홈 레지스트리 ~/.rona/installed/*.json 스캔 (flat, 1단계).
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
