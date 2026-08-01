/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as accountMutations from "../accountMutations.js";
import type * as accountQueries from "../accountQueries.js";
import type * as artistEnrichmentActions from "../artistEnrichmentActions.js";
import type * as artistMutations from "../artistMutations.js";
import type * as auth from "../auth.js";
import type * as blend from "../blend.js";
import type * as blendActions from "../blendActions.js";
import type * as bwendProfileMutations from "../bwendProfileMutations.js";
import type * as bwendProfileQueries from "../bwendProfileQueries.js";
import type * as claimActions from "../claimActions.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as inviteMutations from "../inviteMutations.js";
import type * as inviteQueries from "../inviteQueries.js";
import type * as invites from "../invites.js";
import type * as lib_compatibilityReader from "../lib/compatibilityReader.js";
import type * as lib_inviteCode from "../lib/inviteCode.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as lib_musicGraph from "../lib/musicGraph.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_privacyConstants from "../lib/privacyConstants.js";
import type * as lib_spotify from "../lib/spotify.js";
import type * as lib_spotifyBlend from "../lib/spotifyBlend.js";
import type * as lib_spotifySession from "../lib/spotifySession.js";
import type * as lib_vibeScore from "../lib/vibeScore.js";
import type * as listeningPortrait from "../listeningPortrait.js";
import type * as matchMutations from "../matchMutations.js";
import type * as matchQueries from "../matchQueries.js";
import type * as matches from "../matches.js";
import type * as notificationActions from "../notificationActions.js";
import type * as notifications from "../notifications.js";
import type * as playlistActions from "../playlistActions.js";
import type * as playlistRecords from "../playlistRecords.js";
import type * as playlists from "../playlists.js";
import type * as privacyActions from "../privacyActions.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as spotifyActions from "../spotifyActions.js";
import type * as spotifyBlend from "../spotifyBlend.js";
import type * as spotifyBlendMutations from "../spotifyBlendMutations.js";
import type * as spotifyBlendPlaylist from "../spotifyBlendPlaylist.js";
import type * as spotifyBlendPlaylistActions from "../spotifyBlendPlaylistActions.js";
import type * as spotifyConnect from "../spotifyConnect.js";
import type * as spotifyFeatureActions from "../spotifyFeatureActions.js";
import type * as spotifyFeatures from "../spotifyFeatures.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  accountMutations: typeof accountMutations;
  accountQueries: typeof accountQueries;
  artistEnrichmentActions: typeof artistEnrichmentActions;
  artistMutations: typeof artistMutations;
  auth: typeof auth;
  blend: typeof blend;
  blendActions: typeof blendActions;
  bwendProfileMutations: typeof bwendProfileMutations;
  bwendProfileQueries: typeof bwendProfileQueries;
  claimActions: typeof claimActions;
  crons: typeof crons;
  http: typeof http;
  inviteMutations: typeof inviteMutations;
  inviteQueries: typeof inviteQueries;
  invites: typeof invites;
  "lib/compatibilityReader": typeof lib_compatibilityReader;
  "lib/inviteCode": typeof lib_inviteCode;
  "lib/jwt": typeof lib_jwt;
  "lib/musicGraph": typeof lib_musicGraph;
  "lib/privacy": typeof lib_privacy;
  "lib/privacyConstants": typeof lib_privacyConstants;
  "lib/spotify": typeof lib_spotify;
  "lib/spotifyBlend": typeof lib_spotifyBlend;
  "lib/spotifySession": typeof lib_spotifySession;
  "lib/vibeScore": typeof lib_vibeScore;
  listeningPortrait: typeof listeningPortrait;
  matchMutations: typeof matchMutations;
  matchQueries: typeof matchQueries;
  matches: typeof matches;
  notificationActions: typeof notificationActions;
  notifications: typeof notifications;
  playlistActions: typeof playlistActions;
  playlistRecords: typeof playlistRecords;
  playlists: typeof playlists;
  privacyActions: typeof privacyActions;
  pushSubscriptions: typeof pushSubscriptions;
  spotifyActions: typeof spotifyActions;
  spotifyBlend: typeof spotifyBlend;
  spotifyBlendMutations: typeof spotifyBlendMutations;
  spotifyBlendPlaylist: typeof spotifyBlendPlaylist;
  spotifyBlendPlaylistActions: typeof spotifyBlendPlaylistActions;
  spotifyConnect: typeof spotifyConnect;
  spotifyFeatureActions: typeof spotifyFeatureActions;
  spotifyFeatures: typeof spotifyFeatures;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
