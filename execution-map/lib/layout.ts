import type { Cluster, ExecNode } from "./types";

export interface Placed {
  x: number;
  y: number;
  r: number;
}

export const HUB_RADIUS = 250;
const LEAF_RADIUS = [420, 540];
const ARC_STEP = 14; // degrees between leaves in a cluster

const rad = (deg: number) => (deg * Math.PI) / 180;

export function hubPosition(c: Cluster): Placed {
  return { x: Math.cos(rad(c.angle)) * HUB_RADIUS, y: Math.sin(rad(c.angle)) * HUB_RADIUS, r: 34 };
}

/**
 * Radial "solar system" layout: the core sits at the origin, each cluster hub on an
 * inner ring, and the cluster's nodes fan out on two staggered outer rings so labels
 * don't collide.
 */
export function layoutNodes(nodes: ExecNode[], clusters: Cluster[]): Record<string, Placed> {
  const out: Record<string, Placed> = {};
  for (const c of clusters) {
    const members = nodes.filter((n) => n.cluster === c.id).sort((a, b) => a.year - b.year);
    const span = (members.length - 1) * ARC_STEP;
    members.forEach((n, i) => {
      const angle = c.angle - span / 2 + i * ARC_STEP;
      const ring = LEAF_RADIUS[i % 2];
      out[n.id] = {
        x: Math.cos(rad(angle)) * ring,
        y: Math.sin(rad(angle)) * ring,
        r: n.weight === 3 ? 26 : n.weight === 2 ? 19 : 13,
      };
    });
  }
  return out;
}
