// 로컬 `.rona-skill.json` 마커 스캔 → install_token 발견.
// 마커 형태(install route 실측): { practice_id: token, student_token: token, title: slug, installed_at }
// 전역 ~/ 재귀 스캔은 과복잡/성능 → 사용자 지정 루트 2단계 깊이까지만.
import { glob } from "glob";
import { readFile } from "node:fs/promises";

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

export async function scanMarkers(roots: string[]): Promise<DiscoveredSkill[]> {
  const byToken = new Map<string, DiscoveredSkill>();

  for (const root of roots) {
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
      continue; // 권한 없음/없는 폴더 → 조용히 skip
    }

    for (const markerPath of matches) {
      try {
        const raw = await readFile(markerPath, "utf8");
        const marker = JSON.parse(raw) as RonaMarker;
        const token = marker.practice_id ?? marker.student_token;
        if (!token) continue;
        byToken.set(token, {
          token,
          title: marker.title ?? "rona-skill",
          markerPath,
        });
      } catch {
        continue; // 깨진 JSON → skip
      }
    }
  }

  return [...byToken.values()];
}
