import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

const EXPORT_LIMIT = 500;

/** A portable account snapshot that deliberately excludes OAuth and APNs credentials. */
export const exportSnapshot = internalQuery({
  args: { spotifyUserId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("bwendProfiles")
      .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
      .first();
    if (!profile) return null;

    const [invitesAsInviter, invitesAsInvitee, matchesAsA, matchesAsB, playlists, pushes, portrait] =
      await Promise.all([
        ctx.db
          .query("invites")
          .withIndex("by_inviter", (q) =>
            q.eq("inviterSpotifyUserId", args.spotifyUserId)
          )
          .take(EXPORT_LIMIT),
        ctx.db
          .query("invites")
          .withIndex("by_invitee", (q) => q.eq("inviteeSpotifyUserId", args.spotifyUserId))
          .take(EXPORT_LIMIT),
        ctx.db
          .query("matches")
          .withIndex("by_user_a", (q) => q.eq("userASpotifyUserId", args.spotifyUserId))
          .take(EXPORT_LIMIT),
        ctx.db
          .query("matches")
          .withIndex("by_user_b", (q) => q.eq("userBSpotifyUserId", args.spotifyUserId))
          .take(EXPORT_LIMIT),
        ctx.db
          .query("matchPlaylists")
          .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
          .take(EXPORT_LIMIT),
        ctx.db
          .query("pushSubscriptions")
          .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
          .take(EXPORT_LIMIT),
        ctx.db
          .query("listeningPortraits")
          .withIndex("by_spotify_user_id", (q) => q.eq("spotifyUserId", args.spotifyUserId))
          .first(),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      privacyConsent: {
        version: profile.privacyConsentVersion ?? null,
        consentedAt: profile.privacyConsentedAt
          ? new Date(profile.privacyConsentedAt).toISOString()
          : null,
      },
      termsAcceptance: {
        version: profile.termsVersion ?? null,
        acceptedAt: profile.termsAcceptedAt
          ? new Date(profile.termsAcceptedAt).toISOString()
          : null,
      },
      tasteCard: {
        userId: profile.spotifyUserId,
        alias: profile.displayName,
        topTracks: profile.topTracks,
        topArtists: profile.topArtists,
        tasteProfile: profile.tasteProfile,
        createdAt: new Date(profile.createdAt).toISOString(),
        updatedAt: new Date(profile.updatedAt).toISOString(),
        spotifyConnected: profile.spotifyTokenBlob !== null,
      },
      invites: [
        ...invitesAsInviter.map((invite) => ({
          code: invite.code,
          direction: "sent",
          selectedTrack: invite.selectedTrack ?? null,
          status: invite.status,
          createdAt: new Date(invite.createdAt).toISOString(),
          claimedAt: invite.claimedAt ? new Date(invite.claimedAt).toISOString() : null,
          expiresAt: new Date(invite.expiresAt).toISOString(),
        })),
        ...invitesAsInvitee.map((invite) => ({
          code: invite.code,
          direction: "received",
          selectedTrack: invite.selectedTrack ?? null,
          status: invite.status,
          createdAt: new Date(invite.createdAt).toISOString(),
          claimedAt: invite.claimedAt ? new Date(invite.claimedAt).toISOString() : null,
          expiresAt: new Date(invite.expiresAt).toISOString(),
        })),
      ],
      matches: [...matchesAsA, ...matchesAsB].map((match) => ({
        id: match._id,
        vibeScore: match.vibeScore,
        breakdown: match.breakdown,
        anchorTrack: match.anchorTrack,
        sharedTopArtistNames: match.sharedTopArtistNames,
        sharedTopTrackNames: match.sharedTopTrackNames,
        compatibilityRead: match.compatibilityRead,
        createdAt: new Date(match.createdAt).toISOString(),
      })),
      savedPlaylists: playlists.map((playlist) => ({
        matchId: playlist.matchId,
        spotifyPlaylistId: playlist.spotifyPlaylistId,
        spotifyURL: playlist.spotifyURL,
        createdAt: new Date(playlist.createdAt).toISOString(),
      })),
      notificationSettings: pushes.map((push) => ({
        environment: push.environment,
        timezone: push.timezone,
        dailyHour: push.dailyHour,
        enabled: push.enabled,
        updatedAt: new Date(push.updatedAt).toISOString(),
      })),
      listeningPortrait: portrait
        ? {
            answers: portrait.answers,
            title: portrait.portrait.title,
            summary: portrait.portrait.summary,
            traits: portrait.portrait.traits,
            conversationStarters: portrait.portrait.conversationStarters,
            model: portrait.model,
            promptVersion: portrait.promptVersion,
            aiConsentVersion: portrait.aiConsentVersion,
            aiConsentedAt: new Date(portrait.aiConsentedAt).toISOString(),
            generatedAt: new Date(portrait.generatedAt).toISOString(),
            updatedAt: new Date(portrait.updatedAt).toISOString(),
          }
        : null,
      excludedSecrets: ["Spotify access token", "Spotify refresh token", "APNs device token"],
    };
  },
});
