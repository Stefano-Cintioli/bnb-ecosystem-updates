import Foundation
import Vision
import CoreImage
import CoreVideo
import ImageIO

let args = CommandLine.arguments
if args.count != 4 {
    fputs("Usage: person-blur input-directory output-directory mask-directory\n", stderr)
    exit(2)
}
let input = URL(fileURLWithPath: args[1], isDirectory: true)
let output = URL(fileURLWithPath: args[2], isDirectory: true)
let masks = URL(fileURLWithPath: args[3], isDirectory: true)
let fm = FileManager.default
try fm.createDirectory(at: output, withIntermediateDirectories: true)
try fm.createDirectory(at: masks, withIntermediateDirectories: true)
let files = try fm.contentsOfDirectory(at: input, includingPropertiesForKeys: nil).filter { $0.pathExtension.lowercased() == "png" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
let context = CIContext(options: [.cacheIntermediates: false])
let deliveryColorSpace = CGColorSpace(name: CGColorSpace.itur_709)!
let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .accurate
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
let started = Date()
for (index, file) in files.enumerated() {
    try autoreleasepool {
        guard let image = CIImage(contentsOf: file, options: [.applyOrientationProperty: true]) else { throw NSError(domain: "BlurProof", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read input frame"]) }
        if index == 0 {
            print("Input colour space: \(String(describing: image.colorSpace?.name)); output colour space: \(String(describing: deliveryColorSpace.name))")
            try context.writePNGRepresentation(of: image, to: output.appendingPathComponent("round-trip.png"), format: .RGBA8, colorSpace: deliveryColorSpace)
        }
        let handler = VNImageRequestHandler(ciImage: image, orientation: .up, options: [:])
        try handler.perform([request])
        guard let observation = request.results?.first else { throw NSError(domain: "BlurProof", code: 2, userInfo: [NSLocalizedDescriptionKey: "No person mask returned"]) }
        let rawMask = CIImage(cvPixelBuffer: observation.pixelBuffer)
        let scale = CGAffineTransform(scaleX: image.extent.width / rawMask.extent.width, y: image.extent.height / rawMask.extent.height)
        let mask = rawMask.transformed(by: scale).cropped(to: image.extent)
        let background = image.clampedToExtent().applyingFilter("CIGaussianBlur", parameters: [kCIInputRadiusKey: 12.0]).cropped(to: image.extent)
        let result = image.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: background, kCIInputMaskImageKey: mask]).cropped(to: image.extent)
        try context.writePNGRepresentation(of: result, to: output.appendingPathComponent(file.lastPathComponent), format: .RGBA8, colorSpace: deliveryColorSpace)
        try context.writePNGRepresentation(of: mask, to: masks.appendingPathComponent(file.lastPathComponent), format: .RGBA8, colorSpace: deliveryColorSpace)
        if index == 0 || (index + 1) % 15 == 0 || index + 1 == files.count {
            let elapsed = Date().timeIntervalSince(started)
            print("Processed \(index + 1)/\(files.count) frames in \(String(format: "%.2f", elapsed))s; mask \(CVPixelBufferGetWidth(observation.pixelBuffer))x\(CVPixelBufferGetHeight(observation.pixelBuffer))")
            fflush(stdout)
        }
    }
}
print("Native local Vision accurate person segmentation; background Gaussian radius 12 pixels; foreground and subtitle layer unchanged. Total seconds: \(Date().timeIntervalSince(started))")
