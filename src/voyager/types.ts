/**
 * Clean domain shapes for the read side (ticket 10). These are what tools
 * return — raw Voyager response shapes never leak past the client's mappers.
 */

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  vanityName: string;
}

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  headline: string;
  location: string;
  about: string;
}

export interface Post {
  id: string;
  authorUrn: string;
  text: string;
  publishedAt: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastActivityAt: string;
}

export interface ConnectionsSummary {
  connections: number;
}

export interface JobSearchFilters {
  keywords?: string;
  locationId?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
}

export interface Analytics {
  profileViews: number;
}
