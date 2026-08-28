/** The approval layer (ticket 16): plan-then-execute with previews. */

export interface ProfileDiffField {
  field: string;
  /** Absent when the current value is not readable (e.g. top-skills). */
  old?: string;
  new: string;
}

export interface ProfileDiff {
  fields: ProfileDiffField[];
}

export interface RenderedPreview {
  type: 'post' | 'message';
  /** The name the post/message would appear under. */
  author?: string;
  text: string;
  /** The post id or conversation the write targets. */
  target?: string;
}

export interface ActionPreview {
  kind: 'profile-diff' | 'rendered' | 'generic';
  summary: string;
  diff?: ProfileDiff;
  rendered?: RenderedPreview;
  /** The exact args the tool would receive — the raw toggle. */
  raw: Record<string, unknown>;
}

export interface PlannedAction {
  tool: string;
  args: Record<string, unknown>;
  preview: ActionPreview;
}

export type PlanStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface Plan {
  id: string;
  status: PlanStatus;
  actions: PlannedAction[];
  createdAt: string;
}
