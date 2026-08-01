import CoreImage
import CoreImage.CIFilterBuiltins
import SwiftUI

/// A locally generated QR code. The invite URL never leaves the device to create this image.
struct InviteQRCode: View {
    let url: URL

    private static let context = CIContext()

    var body: some View {
        Group {
            if let image = qrImage {
                image
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
            } else {
                Image(systemName: "qrcode")
                    .resizable()
                    .scaledToFit()
                    .foregroundColor(.black)
                    .padding(36)
            }
        }
        .frame(width: 210, height: 210)
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: BwendRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: BwendRadius.lg)
                .stroke(Color.black.opacity(0.08), lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("QR code for Bwend invite \(url.absoluteString)")
        .accessibilityHint("Ask the other person to scan this with their iPhone camera.")
    }

    private var qrImage: Image? {
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(url.absoluteString.utf8)
        filter.correctionLevel = "M"
        guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)),
              let cgImage = Self.context.createCGImage(output, from: output.extent) else {
            return nil
        }
        return Image(decorative: cgImage, scale: 1)
    }
}
