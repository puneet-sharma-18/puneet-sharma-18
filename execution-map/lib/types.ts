export type ClusterId = "operator" | "community" | "brands" | "ai" | "education";

export type Status = "live" | "shipped" | "building" | "experiment" | "archived";

export interface Metric {
  value: string;
  label: string;
  /** Where the number comes from, shown on hover so every claim has a receipt. */
  source?: string;
}

export interface ProofLink {
  label: string;
  url?: string;
}

export interface ExecNode {
  id: string;
  title: string;
  cluster: ClusterId;
  /** Year the thing started — drives the journey timeline. */
  year: number;
  status: Status;
  tagline: string;
  /** What it is, in plain English. */
  brief: string;
  /** What Puneet personally did / executed. */
  executed: string[];
  /** How it works: a short pipeline of steps, rendered as a flow. */
  how?: string[];
  stack?: string[];
  metrics?: Metric[];
  /** How it was figured out — the decision or insight behind it. */
  insight?: string;
  proof?: ProofLink[];
  /** 1 = small, 3 = flagship. Controls node size. */
  weight: 1 | 2 | 3;
}

export interface Cluster {
  id: ClusterId;
  label: string;
  kicker: string;
  color: string;
  /** Angle (degrees, 0 = right, clockwise) where the cluster sits around the core. */
  angle: number;
}

export interface Edge {
  from: string;
  to: string;
  /** Why one thing led to the other — the "execution DNA". */
  label: string;
}

export interface Chapter {
  year: number;
  title: string;
  text: string;
}
