/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bwendProfileMutations from "../bwendProfileMutations.js";
import type * as bwendProfileQueries from "../bwendProfileQueries.js";
import type * as claimActions from "../claimActions.js";
import type * as http from "../http.js";
import type * as inviteMutations from "../inviteMutations.js";
import type * as inviteQueries from "../inviteQueries.js";
import type * as invites from "../invites.js";
import type * as lib_compatibilityReader from "../lib/compatibilityReader.js";
import type * as lib_inviteCode from "../lib/inviteCode.js";
import type * as lib_jwt from "../lib/jwt.js";
import type * as lib_spotify from "../lib/spotify.js";
import type * as lib_vibeScore from "../lib/vibeScore.js";
import type * as matchMutations from "../matchMutations.js";
import type * as matchQueries from "../matchQueries.js";
import type * as matches from "../matches.js";
import type * as spotifyActions from "../spotifyActions.js";
import type * as spotifyConnect from "../spotifyConnect.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bwendProfileMutations: typeof bwendProfileMutations;
  bwendProfileQueries: typeof bwendProfileQueries;
  claimActions: typeof claimActions;
  http: typeof http;
  inviteMutations: typeof inviteMutations;
  inviteQueries: typeof inviteQueries;
  invites: typeof invites;
  "lib/compatibilityReader": typeof lib_compatibilityReader;
  "lib/inviteCode": typeof lib_inviteCode;
  "lib/jwt": typeof lib_jwt;
  "lib/spotify": typeof lib_spotify;
  "lib/vibeScore": typeof lib_vibeScore;
  matchMutations: typeof matchMutations;
  matchQueries: typeof matchQueries;
  matches: typeof matches;
  spotifyActions: typeof spotifyActions;
  spotifyConnect: typeof spotifyConnect;
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
