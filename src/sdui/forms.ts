import { randomUUID } from 'node:crypto';

/**
 * SDUI request bodies (research ticket 01). LinkedIn's profile forms send
 * MemoryNamespace state-references in the payload AND the real literal values
 * in a top-level states[] array — that duplication is what makes them
 * replayable browserless. The keys are minted per request; the states[]
 * entries carry the actual values.
 */

export interface SduiStateEntry {
  key: string;
  namespace: string;
  value: string;
}

export interface SduiRequestBody {
  requestId: string;
  serverRequest: {
    requestId: string;
    requestedArguments: {
      $type: string;
      payload: Record<string, unknown>;
    };
  };
  states: SduiStateEntry[];
}

const PROFILE = 'com.linkedin.sdui.requests.profile';
const NAMESPACE = 'MemoryNamespace';

function ref(states: SduiStateEntry[], label: string, value: string): { key: string; namespace: string } {
  const key = `${label}${randomUUID()}`;
  states.push({ key, namespace: NAMESPACE, value });
  return { key, namespace: NAMESPACE };
}

function build(requestId: string, payload: Record<string, unknown>, states: SduiStateEntry[]): SduiRequestBody {
  return {
    requestId,
    serverRequest: {
      requestId,
      requestedArguments: {
        $type: 'proto.sdui.actions.requests.RequestedArguments',
        payload,
      },
    },
    states,
  };
}

/** saveProfileSkillForm: add a skill by name + typeahead skill id. */
export function skillAddForm(name: string, skillId: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    skillName: ref(states, 'addSkillsTypeaheadSkillName', name),
    skillId: ref(states, 'addSkillsTypeahead', skillId),
  };
  return build(`${PROFILE}.saveProfileSkillForm`, payload, states);
}

/** deleteProfileSkillForm: remove a skill by its profile-skill URN. */
export function skillDeleteForm(skillUrn: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    skill: ref(states, 'skill', skillUrn),
  };
  return build(`${PROFILE}.deleteProfileSkillForm`, payload, states);
}

/** saveProfileAboutForm: headline, about, and the re-orderable top-skills. */
export function aboutForm(changes: { headline?: string; about?: string; topSkills?: string[] }): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload: Record<string, unknown> = {};
  if (changes.headline !== undefined) {
    payload['headline'] = ref(states, 'headline', changes.headline);
  }
  if (changes.about !== undefined) {
    payload['about'] = ref(states, 'about', changes.about);
  }
  if (changes.topSkills !== undefined) {
    payload['topSkills'] = changes.topSkills.map((skill) => ref(states, 'topSkill', skill));
  }
  return build(`${PROFILE}.saveProfileAboutForm`, payload, states);
}

/** deleteProfile<Section>Form: remove an entry that standard deletes miss (ghost entry). */
export function ghostDeleteForm(section: string, urn: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const capitalized = section.charAt(0).toUpperCase() + section.slice(1);
  const payload = {
    entry: ref(states, `${section}Entry`, urn),
  };
  return build(`${PROFILE}.deleteProfile${capitalized}Form`, payload, states);
}

/** com.linkedin.sdui.update.deletePost: delete a post by its numeric activity id. */
export function deletePostForm(activityId: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    activityId: ref(states, 'activityId', activityId),
    trackingId: ref(states, 'trackingId', ''),
  };
  return build('com.linkedin.sdui.update.deletePost', payload, states);
}

/** com.linkedin.sdui.comments.createComment: comment on a post by URN. */
export function commentForm(postUrn: string, text: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    objectUrn: ref(states, 'objectUrn', postUrn),
    comment: ref(states, 'comment', text),
  };
  return build('com.linkedin.sdui.comments.createComment', payload, states);
}

/** mynetwork invitation-action family: accept / ignore / withdraw an invite. */
export function invitationActionForm(action: string, invitationUrn: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    invitationUrn: ref(states, 'invitationUrn', invitationUrn),
  };
  return build(`com.linkedin.sdui.requests.mynetwork.${action}Invitation`, payload, states);
}

/** mynetwork addaUpdateFollowState: follow or unfollow a person. */
export function followPersonForm(urn: string, follow: boolean): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    targetUrn: ref(states, 'targetUrn', urn),
    follow: ref(states, 'follow', String(follow)),
  };
  return build('com.linkedin.sdui.requests.mynetwork.addaUpdateFollowState', payload, states);
}

/** endorseSkill: endorse a skill on someone's profile. */
export function endorseSkillForm(profileUrn: string, skillId: string, vanityName: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    profileId: ref(states, 'profileId', profileUrn),
    skillId: ref(states, 'skillId', skillId),
    vanityName: ref(states, 'vanityName', vanityName),
  };
  return build('com.linkedin.sdui.requests.profile.endorseSkill', payload, states);
}

/** RemoveConnectionVanityName: remove a connection by vanity name. */
export function removeConnectionForm(vanityName: string): SduiRequestBody {
  const states: SduiStateEntry[] = [];
  const payload = {
    vanityName: ref(states, 'vanityName', vanityName),
  };
  return build('com.linkedin.sdui.mynetwork.RemoveConnectionVanityName', payload, states);
}
