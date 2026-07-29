import Foundation
import Testing
@testable import Bwend

@Suite("Invite summary")
struct InviteSummaryTests {
    @Test("Decodes the invite-management API response")
    func decodesInviteSummary() throws {
        let data = Data(
            """
            {
              "code": "ABC123",
              "url": "https://www.bwend.xyz/m/ABC123",
              "status": "pending",
              "selectedTrack": null,
              "createdAt": "2026-07-29T12:00:00Z",
              "claimedAt": null,
              "expiresAt": "2026-08-05T12:00:00Z",
              "matchId": null,
              "partnerName": null
            }
            """.utf8
        )

        let invite = try JSONDecoder.api.decode(InviteSummary.self, from: data)

        #expect(invite.code == "ABC123")
        #expect(invite.isPending)
        #expect(invite.matchId == nil)
    }

    @Test("Pending links become expired at their deadline")
    func pendingLinkUsesEffectiveExpiry() {
        let expiry = Date(timeIntervalSince1970: 2_000)
        let invite = fixture(status: "pending", expiresAt: expiry)

        #expect(invite.effectiveStatus(at: Date(timeIntervalSince1970: 1_999)) == "pending")
        #expect(invite.effectiveStatus(at: expiry) == "expired")
    }

    @Test(
        "Expiry copy covers hours, days, and elapsed links",
        arguments: [
            (3_600.0, "Expires in 1 hour"),
            (172_800.0, "Expires in 2 days"),
            (-1.0, "Expired"),
        ]
    )
    func expiryDescription(offset: TimeInterval, expected: String) {
        let now = Date(timeIntervalSince1970: 10_000)
        let invite = fixture(status: "pending", expiresAt: now.addingTimeInterval(offset))

        #expect(invite.expiryDescription(at: now) == expected)
    }

    private func fixture(status: String, expiresAt: Date) -> InviteSummary {
        InviteSummary(
            code: "TEST",
            url: "https://www.bwend.xyz/m/TEST",
            status: status,
            selectedTrack: nil,
            createdAt: Date(timeIntervalSince1970: 1_000),
            claimedAt: nil,
            expiresAt: expiresAt,
            matchId: nil,
            partnerName: nil
        )
    }
}
